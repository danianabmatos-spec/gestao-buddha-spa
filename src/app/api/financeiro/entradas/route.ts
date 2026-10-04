import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/financeiro/entradas?unidade=&ano=&mes=
// Entradas do banco (Pix) que NÃO são de cliente (sem par no Belle): as a classificar
// (SEM_PAR) e as já classificadas (CLASSIFICADA). As de cliente (CASADA) são receita
// operacional via Belle e não entram aqui.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const unidadeSlug = resolveUnidade(session, searchParams.get('unidade'))
  if (!unidadeSlug) return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })

  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug }, select: { id: true } })
  if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })

  const ano = Number(searchParams.get('ano')) || new Date().getFullYear()
  const mes = Number(searchParams.get('mes')) || new Date().getMonth() + 1
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`

  const fontes = await prisma.fonteExterna.findMany({
    where: { unidadeId: unidade.id, origem: 'BANCO_PIX', data: { startsWith: prefixo }, statusMatch: { in: ['SEM_PAR', 'CLASSIFICADA'] } },
    orderBy: [{ data: 'asc' }, { valor: 'desc' }],
    include: { planoConta: { select: { id: true, nome: true } } },
  })

  const entradas = fontes.map((f) => ({
    id: f.id,
    data: f.data,
    valor: f.valor,
    descricao: f.descricao,
    classificada: f.statusMatch === 'CLASSIFICADA',
    planoContaId: f.planoContaId,
    planoContaNome: f.planoConta?.nome ?? null,
    classificadoPor: f.classificadoPor,
  }))

  const totalAClassificar = entradas.filter((e) => !e.classificada).reduce((s, e) => s + e.valor, 0)
  const totalClassificado = entradas.filter((e) => e.classificada).reduce((s, e) => s + e.valor, 0)

  return NextResponse.json({ entradas, totalAClassificar, totalClassificado })
}
