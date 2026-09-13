import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { telefoneCanonico } from '@/lib/inteligencia/central-clusters'

// POST /api/tarefas-do-dia/:id/cancelar — a Central remove o cliente da fila com um MOTIVO.
// `id` é o mesmo do GET (clienteScoreId, ou "tp-<n>" para TotalPass). Mesma auth Bearer.
//
// Body: { motivo: string, obs?: string, desfazer?: boolean }
//   motivo canônico:
//     • SEM_PLANO → cliente informou que não tem mais o plano (ex.: TotalPass). Escopo: unidade.
//     • OPT_OUT   → cliente não quer receber mensagens. Escopo: GLOBAL (todas as unidades).
//     • OUTRO     → outro motivo (use `obs` para detalhar). Escopo: unidade.
//   (qualquer outra string é aceita e tratada como escopo de unidade.)
//   desfazer: true → reverte o cancelamento (reativa o cliente).
//
// Efeito: grava/remove um bloqueio por TELEFONE em ContatoBloqueado; o GET tira quem
// está bloqueado de TODOS os clusters. Para tarefas TotalPass, também espelha o
// planoCancelado (mantém a aba "Cancelados" da tela TotalPass consistente).

export const dynamic = 'force-dynamic'

function autorizado(req: NextRequest): boolean {
  const token = process.env.CENTRAL_BEARER_TOKEN
  if (!token) return false
  return req.headers.get('authorization') === `Bearer ${token}`
}

const soDigitos = (t: string | null) => telefoneCanonico(t) // canônico (sem DDI 55)

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'nao_autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const motivo = String((body as Record<string, unknown>).motivo ?? '').trim() || 'OUTRO'
  const obs = (body as Record<string, unknown>).obs != null ? String((body as Record<string, unknown>).obs) : null
  const desfazer = (body as Record<string, unknown>).desfazer === true

  // Resolve a tarefa → telefone + unidade + nome (mesma semântica de id do /concluir).
  let telefone = ''
  let unidadeSlug = ''
  let nomeCliente = ''
  let ehTotalPass = false
  let tpId: number | null = null

  if (id.startsWith('tp-')) {
    tpId = Number(id.slice(3))
    if (!Number.isInteger(tpId)) return NextResponse.json({ erro: 'id_invalido' }, { status: 400 })
    const tp = await prisma.clienteTotalPass.findUnique({ where: { id: tpId } })
    if (!tp) return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404 })
    telefone = soDigitos(tp.telefone)
    unidadeSlug = tp.unidadeSlug
    nomeCliente = tp.nomeCliente
    ehTotalPass = true
  } else {
    const clienteScoreId = Number(id)
    if (!Number.isInteger(clienteScoreId)) return NextResponse.json({ erro: 'id_invalido' }, { status: 400 })
    const c = await prisma.clienteScore.findUnique({ where: { id: clienteScoreId } })
    if (!c) return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404 })
    telefone = soDigitos(c.telefone)
    unidadeSlug = c.unidadeSlug
    nomeCliente = c.nomeCliente
  }

  if (telefone.length < 10) return NextResponse.json({ erro: 'sem_telefone' }, { status: 400 })

  // OPT_OUT bloqueia em TODA a rede ("*"); os demais motivos só na unidade.
  const escopo = motivo.toUpperCase() === 'OPT_OUT' ? '*' : unidadeSlug

  if (desfazer) {
    await prisma.contatoBloqueado.deleteMany({ where: { telefone, unidadeSlug: { in: [escopo, unidadeSlug, '*'] } } })
    if (ehTotalPass && tpId != null) {
      await prisma.clienteTotalPass.update({ where: { id: tpId }, data: { planoCancelado: false } }).catch(() => {})
    }
    return NextResponse.json({ ok: true, desfeito: true })
  }

  await prisma.contatoBloqueado.upsert({
    where: { unidadeSlug_telefone: { unidadeSlug: escopo, telefone } },
    create: { unidadeSlug: escopo, telefone, nomeCliente, motivo, obs },
    update: { motivo, obs, nomeCliente },
  })

  // Tarefa TotalPass → espelha o planoCancelado (tela TotalPass mostra em "Cancelados").
  if (ehTotalPass && tpId != null) {
    await prisma.clienteTotalPass
      .update({ where: { id: tpId }, data: { planoCancelado: true, motivoContato: motivo } })
      .catch(() => {})
  }

  return NextResponse.json({ ok: true, escopo: escopo === '*' ? 'global' : 'unidade', motivo })
}
