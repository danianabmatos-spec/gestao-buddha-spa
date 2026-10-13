import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { montarCancelamentoBola, enviarAnuncioGrupo } from '@/lib/bola/whatsapp'

export const dynamic = 'force-dynamic'

// POST /api/bola/cancelar?unidade=slug   body: { atendimentoId }
// Cancela uma bola JÁ PASSADA: avisa o grupo (❌) e apaga o atendimento — o que
// reverte a rodada da terapeuta e devolve o cliente pra lista "Chegou cliente".
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const unidade = resolveUnidade(session, new URL(req.url).searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const atendimentoId = Number(body?.atendimentoId)
  if (!atendimentoId) return NextResponse.json({ error: 'Informe atendimentoId.' }, { status: 400 })

  const atend = await prisma.bolaAtendimento.findUnique({
    where: { id: atendimentoId },
    include: { terapeuta: { select: { nome: true } } },
  })
  if (!atend || atend.unidadeSlug !== unidade) {
    return NextResponse.json({ error: 'Atendimento não encontrado nesta unidade.' }, { status: 404 })
  }

  // avisa o grupo (dry-run se a trava estiver desligada)
  const mensagem = montarCancelamentoBola({
    terapeutaNome: atend.terapeuta?.nome ?? '',
    clienteNome: atend.clienteNome,
    servicoNome: atend.servicoNome,
  })
  const envio = await enviarAnuncioGrupo(unidade, mensagem)

  // apaga o atendimento → reverte a rodada e devolve o cliente pra "Chegou cliente"
  await prisma.bolaAtendimento.delete({ where: { id: atendimentoId } })

  return NextResponse.json({ ok: true, mensagem, whatsapp: { enviado: envio.enviado, motivo: envio.motivo } })
}
