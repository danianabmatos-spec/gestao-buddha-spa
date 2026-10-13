import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const PERFIS_OK = ['DONA', 'RECEPCAO', 'COORDENACAO']

// POST /api/pos-venda/excluir-venda   { belleId }
//   A recepção exclui um lançamento de venda feito errado. Remove a Venda (e seus
//   itens, em cascata) e devolve a recomendação pra "A trabalhar" (PENDENTE_VENDA),
//   zerando os pontos daquela venda. A recomendação em si permanece.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_OK.includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito à recepção/coordenação.' }, { status: 403 })
  }

  const { belleId } = await req.json().catch(() => ({}))
  if (!belleId) return NextResponse.json({ error: 'Informe o atendimento.' }, { status: 400 })

  const rec = await prisma.recomendacao.findUnique({ where: { belleId: String(belleId) }, include: { venda: true } })
  if (!rec) return NextResponse.json({ error: 'Recomendação não encontrada.' }, { status: 404 })
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(rec.unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  if (rec.venda) {
    await prisma.venda.delete({ where: { id: rec.venda.id } }) // VendaItem cai em cascata
  }
  await prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'PENDENTE_VENDA' } })

  return NextResponse.json({ ok: true })
}
