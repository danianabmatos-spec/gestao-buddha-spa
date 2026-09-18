import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const PERFIS_OK = ['DONA', 'RECEPCAO', 'COORDENACAO']

// POST /api/pos-venda/sem-venda  { belleId, motivo?, reabrir? }
// Marca a recomendação como SEM_VENDA (ou reabre para PENDENTE_VENDA). Remove a venda
// registrada, se houver.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_OK.includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito à recepção/coordenação.' }, { status: 403 })
  }

  const { belleId, motivo, reabrir } = await req.json().catch(() => ({}))
  if (!belleId) return NextResponse.json({ error: 'Informe o atendimento.' }, { status: 400 })

  const rec = await prisma.recomendacao.findUnique({ where: { belleId: String(belleId) } })
  if (!rec) return NextResponse.json({ error: 'Recomendação não encontrada.' }, { status: 404 })
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(rec.unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  await prisma.venda.deleteMany({ where: { recomendacaoId: rec.id } })
  await prisma.recomendacao.update({
    where: { id: rec.id },
    data: {
      status: reabrir ? 'PENDENTE_VENDA' : 'SEM_VENDA',
      observacao: !reabrir && motivo ? String(motivo) : rec.observacao,
    },
  })

  return NextResponse.json({ ok: true, status: reabrir ? 'PENDENTE_VENDA' : 'SEM_VENDA' })
}
