import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadeEfetiva } from '@/lib/auth/guard'
import { resolverClusterTotalPass } from '@/lib/inteligencia/mensagens'
import { enfileirarMensagem, processarOutbox } from '@/lib/integracoes/leadflow'

export const dynamic = 'force-dynamic'

// GET — lista os clientes TotalPass da unidade (fila do mês).
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const unidade = unidadeEfetiva(session, searchParams.get('unidade'), 'shopping-metropole')

  const hoje = new Date()
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0)

  const rows = await prisma.clienteTotalPass.findMany({
    where: {
      unidadeSlug: unidade,
      // esconde quem já foi contatado hoje
      OR: [{ ultimoContato: null }, { ultimoContato: { lt: inicioDia } }],
    },
    orderBy: [{ sessoesMes: 'asc' }, { usosAno: 'desc' }],
    take: 2000,
  })

  const clientes = rows.map((c) => {
    const completo = c.sessoesMes >= 2
    const cluster = resolverClusterTotalPass(c.sessoesMes)
    const bloqueado = c.planoCancelado
    const motivoBloqueio = c.planoCancelado ? 'Cancelou o plano TotalPass' : (completo ? 'Já agendou as 2 do mês' : null)
    return {
      ...c,
      faltam: Math.max(0, 2 - c.sessoesMes),
      completo,
      cluster,
      bloqueado: bloqueado || completo,
      motivoBloqueio,
    }
  })

  // Contagens (total, incluindo contatados)
  const todos = await prisma.clienteTotalPass.groupBy({
    by: ['sessoesMes', 'planoCancelado'],
    where: { unidadeSlug: unidade },
    _count: { _all: true },
  })
  const resumo = { s0: 0, s1: 0, s2: 0, cancelados: 0 }
  for (const g of todos) {
    if (g.planoCancelado) { resumo.cancelados += g._count._all; continue }
    if (g.sessoesMes <= 0) resumo.s0 += g._count._all
    else if (g.sessoesMes === 1) resumo.s1 += g._count._all
    else resumo.s2 += g._count._all
  }

  return NextResponse.json({ clientes, resumo, unidade })
}

// POST — ações: marcar contatado OU marcar/desmarcar cancelamento do plano.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { id, acao } = body
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const cliente = await prisma.clienteTotalPass.findUnique({ where: { id } })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  if (session.perfil !== 'DONA' && cliente.unidadeSlug !== session.unidadeSlug) {
    return NextResponse.json({ error: 'Sem permissão para esta unidade' }, { status: 403 })
  }

  if (acao === 'cancelar') {
    await prisma.clienteTotalPass.update({
      where: { id },
      data: { planoCancelado: !!body.cancelado },
    })
    return NextResponse.json({ ok: true, planoCancelado: !!body.cancelado })
  }

  if (acao === 'contatado') {
    await prisma.clienteTotalPass.update({
      where: { id },
      data: { ultimoContato: new Date(), motivoContato: 'TOTALPASS' },
    })
    // Espelha no LeadFlow (outbox) se veio o texto — nunca contata o cliente, só registra
    if (body.mensagem && String(body.mensagem).trim()) {
      try {
        await enfileirarMensagem({
          unidadeSlug: cliente.unidadeSlug,
          nomeCliente: cliente.nomeCliente,
          telefone: cliente.telefone,
          texto: String(body.mensagem),
          motivo: 'TOTALPASS',
        })
        setImmediate(() => { processarOutbox().catch(() => {}) })
      } catch { /* não quebra o registro */ }
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}
