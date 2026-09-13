import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizadoErp } from '@/lib/erp/auth'
import { liberar } from '@/lib/inteligencia/reservas'
import { resolverCluster } from '@/lib/inteligencia/mensagens'
import type { StatusFrequencia, StatusPacote } from '@/lib/inteligencia/mensagens'

// POST /api/erp/tarefas/concluir — callback da Central: confirma que a mensagem
// SAIU pelo número da Central. Grava o contato no ERP (histórico + teto do dia,
// via `criadoEm`) e tira o cliente da fila (`ultimoContato`). Header: x-erp-key.
//
// Body: { clienteScoreId, unidade?, textoEnviado, canal?, atendente?, enviadoEm?, idempotencyKey? }
//
// Notas de projeto:
// - O TEXTO enviado vive na Central (dona da conversa/histórico). Aqui registramos
//   o EVENTO + o motivo canônico + snapshot para os Resultados; não persistimos o texto.
// - Idempotente por (cliente, dia): retry não duplica contato nem infla o teto.
// - Diferente do /api/inteligencia/contato: NÃO aplica a trava anti-mensagem-errada
//   (a mensagem já foi enviada — só registramos o ocorrido) e NÃO espelha de volta
//   no LeadFlow (a Central já é a origem/dona do histórico).

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!autorizadoErp(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const clienteScoreId = Number(body.clienteScoreId)
  const textoEnviado = String(body.textoEnviado || '').trim()
  if (!Number.isInteger(clienteScoreId)) {
    return NextResponse.json({ error: 'clienteScoreId inválido' }, { status: 400 })
  }
  if (!textoEnviado) {
    return NextResponse.json({ error: 'textoEnviado obrigatório (comprova o envio)' }, { status: 400 })
  }

  const cliente = await prisma.clienteScore.findUnique({ where: { id: clienteScoreId } })
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  // Se a Central informou a unidade, precisa bater com a do cliente
  if (body.unidade && body.unidade !== cliente.unidadeSlug) {
    return NextResponse.json({ error: 'unidade não corresponde ao cliente' }, { status: 409 })
  }

  const quandoRaw = body.enviadoEm ? new Date(body.enviadoEm) : new Date()
  const quando = isNaN(quandoRaw.getTime()) ? new Date() : quandoRaw

  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)

  // Idempotência por (cliente, dia): já registrado hoje → não duplica
  const jaHoje = await prisma.historicoContato.findFirst({
    where: { clienteScoreId, criadoEm: { gte: inicioDia } },
    select: { id: true },
  })
  if (jaHoje) {
    liberar(clienteScoreId)
    return NextResponse.json({ ok: true, jaRegistrado: true })
  }

  // Motivo canônico (mesmo cluster que a fila expôs)
  const motivo = resolverCluster(
    cliente.statusFrequencia as StatusFrequencia,
    cliente.statusPacote as StatusPacote | null,
    cliente.isFrequenteSemPacote,
  )

  await Promise.all([
    prisma.clienteScore.update({
      where: { id: clienteScoreId },
      data: { ultimoContato: quando, motivoContato: motivo },
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
        criadoEm: quando,
      },
    }),
  ])

  liberar(clienteScoreId)
  return NextResponse.json({ ok: true })
}
