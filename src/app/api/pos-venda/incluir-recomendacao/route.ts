import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const PERFIS_OK = ['DONA', 'RECEPCAO', 'COORDENACAO']

// POST /api/pos-venda/incluir-recomendacao  { belleId, itens: string[], retorno?, observacao? }
// A recepção inclui a recomendação que a terapeuta indicou VERBALMENTE (não preencheu
// o bloquinho digital), pra o atendimento entrar no fluxo de pós-venda (venda/sem venda).
// A recomendação fica atribuída à TERAPEUTA do atendimento (ela ganha os pontos).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_OK.includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito à recepção/coordenação.' }, { status: 403 })
  }

  const { belleId, itens, retorno, observacao } = await req.json().catch(() => ({}))
  if (!belleId) return NextResponse.json({ error: 'Informe o atendimento.' }, { status: 400 })

  const at = await prisma.atendimento.findUnique({ where: { belleId: String(belleId) } })
  if (!at) return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(at.unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  // Atribui à terapeuta do atendimento (usuarioId dela, se existir).
  let usuarioId = session.sub
  if (at.terapeutaId) {
    const ter = await prisma.terapeuta.findUnique({ where: { id: at.terapeutaId }, select: { usuarioId: true } })
    if (ter?.usuarioId) usuarioId = ter.usuarioId
  }

  const limpos = Array.isArray(itens) ? itens.map(String).filter(Boolean) : []

  const base = {
    unidadeSlug: at.unidadeSlug,
    usuarioId,
    terapeutaNome: at.terapeutaNome,
    clienteNome: at.clienteNome,
    dataAtendimento: at.data,
    servico: at.servico,
    retorno: retorno ? String(retorno).trim() : null,
    observacao: observacao ? String(observacao).trim() : null,
  }

  const rec = await prisma.recomendacao.upsert({
    where: { belleId: String(belleId) },
    create: { belleId: String(belleId), status: 'PENDENTE_VENDA', ...base },
    update: base, // não reseta o status se já existir
  })
  await prisma.recomendacaoItem.deleteMany({ where: { recomendacaoId: rec.id } })
  if (limpos.length) {
    await prisma.recomendacaoItem.createMany({ data: limpos.map((tipo) => ({ recomendacaoId: rec.id, tipo })) })
  }

  return NextResponse.json({ ok: true, recomendacaoId: rec.id })
}
