import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/validacao/resolver  { belleId, resolucao: 'AJUSTADO' | 'REJEITADO', respostaCoord? }
// A coordenadora resolve uma contestação: AJUSTADO (conta na comissão) ou
// REJEITADO (não conta). Guarda a resposta da coordenação.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA' && session.perfil !== 'COORDENACAO') {
    return NextResponse.json({ error: 'Acesso restrito à coordenação.' }, { status: 403 })
  }

  const { belleId, resolucao, respostaCoord } = await req.json().catch(() => ({}))
  if (!belleId || !['AJUSTADO', 'REJEITADO'].includes(resolucao)) {
    return NextResponse.json({ error: 'Informe belleId e a resolução (AJUSTADO ou REJEITADO).' }, { status: 400 })
  }

  const at = await prisma.atendimento.findUnique({ where: { belleId: String(belleId) } })
  if (!at) return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })

  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(at.unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  const atualizado = await prisma.atendimento.update({
    where: { belleId: at.belleId },
    data: {
      statusValidacao: resolucao,
      respostaCoord: respostaCoord ? String(respostaCoord).trim() : null,
    },
  })

  return NextResponse.json({ ok: true, statusValidacao: atualizado.statusValidacao })
}
