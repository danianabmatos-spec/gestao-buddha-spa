import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { enfileirarMensagem, processarOutbox } from '@/lib/integracoes/leadflow'
import { motivoSupressao } from '@/lib/inteligencia/mensagens'
import type { StatusPacote } from '@/lib/inteligencia/mensagens'

// POST — registra um contato e grava histórico
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { clienteScoreId, motivoContato, mensagem } = await req.json()
  if (!clienteScoreId) return NextResponse.json({ error: 'clienteScoreId obrigatório' }, { status: 400 })

  // Busca o cliente para gravar o snapshot
  const cliente = await prisma.clienteScore.findUnique({ where: { id: clienteScoreId } })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  // RECEPÇÃO só pode registrar contato de clientes da própria unidade
  if (session.perfil !== 'DONA' && cliente.unidadeSlug !== session.unidadeSlug) {
    return NextResponse.json({ error: 'Sem permissão para esta unidade' }, { status: 403 })
  }

  // Trava anti-mensagem-errada (autoritativa): não registra/espelha contato
  // se o cliente não deve ser contatado (pacote ativo, ou já agendou).
  const bloqueio = motivoSupressao(cliente.statusPacote as StatusPacote | null, {
    temAgendamentoFuturo: cliente.temAgendamentoFuturo,
  })
  if (bloqueio) {
    return NextResponse.json({ error: `Cliente não deve ser contatado: ${bloqueio}`, bloqueado: true, motivo: bloqueio }, { status: 409 })
  }

  await Promise.all([
    // Atualiza o cliente
    prisma.clienteScore.update({
      where: { id: clienteScoreId },
      data: { ultimoContato: new Date(), motivoContato },
    }),
    // Grava registro histórico
    prisma.historicoContato.create({
      data: {
        unidadeSlug:     cliente.unidadeSlug,
        clienteScoreId:  clienteScoreId,
        nomeCliente:     cliente.nomeCliente,
        telefone:        cliente.telefone,
        motivoContato:   motivoContato || 'DESCONHECIDO',
        statusPacoteSnap: cliente.statusPacote,
        statusFreqSnap:  cliente.statusFrequencia,
        sessoesRestSnap: cliente.sessoesRestantes,
        ultimaSessaoSnap: cliente.ultimaSessao,
      },
    }),
  ])

  // Espelhamento no LeadFlow (outbox). Sempre enfileira; só envia se LIGADO.
  // Nunca contata o cliente — apenas registra o histórico da mensagem.
  if (mensagem && String(mensagem).trim()) {
    try {
      await enfileirarMensagem({
        unidadeSlug: cliente.unidadeSlug,
        nomeCliente: cliente.nomeCliente,
        telefone: cliente.telefone,
        texto: String(mensagem),
        motivo: motivoContato || 'DESCONHECIDO',
      })
      // Tenta espelhar em background (no-op se desligado); não bloqueia a resposta
      setImmediate(() => { processarOutbox().catch(() => {}) })
    } catch { /* falha ao enfileirar não pode quebrar o registro de contato */ }
  }

  return NextResponse.json({ ok: true })
}

// GET — stats de ações da recepção (por dia, semana, mês)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  // RECEPÇÃO travada na própria unidade; DONA opcionalmente filtra via ?unidade=
  const unidadeSlug = (session.perfil === 'DONA' || session.perfil === 'FINANCEIRO')
    ? (searchParams.get('unidade') || undefined)
    : session.unidadeSlug ?? undefined

  const agora   = new Date()
  const d0 = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
  const inicioDia    = d0(agora)
  const inicioSemana = (() => { const d = d0(agora); d.setDate(d.getDate() - d.getDay()); return d })()
  const inicioMes    = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicio30d    = new Date(agora); inicio30d.setDate(agora.getDate() - 29); d0(inicio30d)

  const where = unidadeSlug ? { unidadeSlug } : {}

  const [hoje, semana, mes, total30d, porMotivo, porUnidade] = await Promise.all([
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicioDia } } }),
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicioSemana } } }),
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicioMes } } }),
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicio30d } } }),
    prisma.historicoContato.groupBy({
      by: ['motivoContato'],
      where: { ...where, criadoEm: { gte: inicioMes } },
      _count: { motivoContato: true },
    }),
    prisma.historicoContato.groupBy({
      by: ['unidadeSlug'],
      // Comparativo entre unidades é só para a DONA; recepção vê apenas a sua
      where: { ...where, criadoEm: { gte: inicioMes } },
      _count: { unidadeSlug: true },
    }),
  ])

  return NextResponse.json({
    hoje, semana, mes, total30d,
    porMotivo: Object.fromEntries(porMotivo.map(r => [r.motivoContato, r._count.motivoContato])),
    porUnidade: Object.fromEntries(porUnidade.map(r => [r.unidadeSlug, r._count.unidadeSlug])),
  })
}
