import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolverCluster } from '@/lib/inteligencia/mensagens'
import type { StatusFrequencia, StatusPacote } from '@/lib/inteligencia/mensagens'

// POST /api/tarefas-do-dia/:id/concluir — a recepção marcou a tarefa como feita.
// `id` é o id devolvido pelo GET (o clienteScoreId). Mesma auth Bearer.
// Registra o contato (histórico + teto) e tira o cliente da fila. Idempotente por dia.

export const dynamic = 'force-dynamic'

function autorizado(req: NextRequest): boolean {
  const token = process.env.CENTRAL_BEARER_TOKEN
  if (!token) return false
  return req.headers.get('authorization') === `Bearer ${token}`
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'nao_autorizado' }, { status: 401 })

  const { id } = await ctx.params

  // Tarefa de TotalPass (id "tp-<n>") → registra o contato na ClienteTotalPass
  if (id.startsWith('tp-')) {
    const tpId = Number(id.slice(3))
    if (!Number.isInteger(tpId)) return NextResponse.json({ erro: 'id_invalido' }, { status: 400 })
    const tp = await prisma.clienteTotalPass.findUnique({ where: { id: tpId } })
    if (!tp) return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404 })
    await prisma.clienteTotalPass.update({
      where: { id: tpId },
      data: { ultimoContato: new Date(), motivoContato: 'TOTALPASS' },
    })
    return NextResponse.json({ ok: true })
  }

  const clienteScoreId = Number(id)
  if (!Number.isInteger(clienteScoreId)) return NextResponse.json({ erro: 'id_invalido' }, { status: 400 })

  const cliente = await prisma.clienteScore.findUnique({ where: { id: clienteScoreId } })
  if (!cliente) return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404 })

  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
  const jaHoje = await prisma.historicoContato.findFirst({
    where: { clienteScoreId, criadoEm: { gte: inicioDia } },
    select: { id: true },
  })
  if (jaHoje) return NextResponse.json({ ok: true, jaRegistrado: true })

  const motivo = resolverCluster(
    cliente.statusFrequencia as StatusFrequencia,
    cliente.statusPacote as StatusPacote | null,
    cliente.isFrequenteSemPacote,
  )
  const agora = new Date()
  await Promise.all([
    prisma.clienteScore.update({
      where: { id: clienteScoreId },
      data: { ultimoContato: agora, motivoContato: motivo },
    }),
    prisma.historicoContato.create({
      data: {
        unidadeSlug: cliente.unidadeSlug,
        clienteScoreId,
        nomeCliente: cliente.nomeCliente,
        telefone: cliente.telefone,
        motivoContato: motivo,
        statusPacoteSnap: cliente.statusPacote,
        statusFreqSnap: cliente.statusFrequencia,
        sessoesRestSnap: cliente.sessoesRestantes,
        ultimaSessaoSnap: cliente.ultimaSessao,
        criadoEm: agora,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
