import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade, unidadesPermitidas } from '@/lib/auth/guard'
import { montarCalendarioMes } from '@/lib/rotinas/calendario'
import { hojeISO } from '@/lib/rotinas/motor'

export const dynamic = 'force-dynamic'

// GET /api/rotinas/calendario?unidade=slug&ano=YYYY&mes=M
// Projeta as rotinas semanais/mensais do catálogo sobre o mês, no escopo do usuário.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const hoje = hojeISO()
  const ano = parseInt(searchParams.get('ano') || hoje.slice(0, 4), 10)
  const mes = parseInt(searchParams.get('mes') || hoje.slice(5, 7), 10)
  if (!(ano >= 2020 && ano <= 2100) || !(mes >= 1 && mes <= 12)) {
    return NextResponse.json({ error: 'Mês/ano inválido.' }, { status: 400 })
  }

  const permitidas = unidadesPermitidas(session) // null = todas (DONA)
  const unidades = await prisma.unidade.findMany({
    where: permitidas === null ? { ativa: true } : { slug: { in: permitidas } },
    orderBy: { id: 'asc' },
    select: { id: true, nome: true, slug: true },
  })

  const slug = resolveUnidade(session, searchParams.get('unidade'))
  const unidade = unidades.find((u) => u.slug === slug) ?? unidades[0]
  if (!unidade) {
    return NextResponse.json({ error: 'Nenhuma unidade no escopo do usuário.' }, { status: 403 })
  }

  const calendario = await montarCalendarioMes(unidade.id, ano, mes, hoje)

  // RECEPÇÃO só enxerga o que é da recepção; DONA e COORDENAÇÃO veem os dois níveis.
  if (session.perfil === 'RECEPCAO') {
    calendario.dias = calendario.dias.map((d) => ({
      ...d,
      eventos: d.eventos.filter((e) => e.area === 'RECEPCAO'),
    }))
    calendario.diarias = calendario.diarias.filter((x) => x.area === 'RECEPCAO')
  }

  return NextResponse.json({
    perfil: session.perfil,
    unidadeAtual: { id: unidade.id, nome: unidade.nome, slug: unidade.slug },
    unidades,
    calendario,
  })
}
