import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Reembolso TotalPass: cada ATENDIMENTO realizado no mês é pago no dia 20 do mês seguinte.
// Valor FLAT por atendimento (não o valor do Belle): bruto e líquido (já descontado royalties+mkt).
const BRUTO_POR_ATENDIMENTO = 225
const LIQUIDO_POR_ATENDIMENTO = 207
const FORMA_TOTALPASS = 'Parcerias Comerciais - TotalPass'

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]

// GET /api/financeiro/totalpass?ano=&mes=
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const ano = Number(searchParams.get('ano')) || new Date().getFullYear()
  const mes = Number(searchParams.get('mes')) || new Date().getMonth() + 1
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`

  const permitidas = unidadesPermitidas(session)
  const visiveis = permitidas == null ? UNIDADES : UNIDADES.filter((u) => permitidas.includes(u.slug))
  const unidades = await prisma.unidade.findMany({ where: { slug: { in: visiveis.map((u) => u.slug) } }, select: { id: true, slug: true, nome: true } })

  const linhas = []
  for (const u of unidades) {
    const movs = await prisma.movimentacaoBelle.findMany({
      where: { unidadeId: u.id, formaPagamento: FORMA_TOTALPASS, data: { startsWith: prefixo } },
      select: { belleMovId: true, data: true, clienteNome: true, servico: true, responsavel: true, tipoMovimento: true },
      orderBy: { data: 'asc' },
    })
    // 1 atendimento = 1 belleMovId (Day Spa pode gerar várias linhas com o mesmo id).
    const porAtendimento = new Map<string, { data: string; cliente: string; servico: string; responsavel: string }>()
    for (const m of movs) {
      if ((m.tipoMovimento ?? 'E').toUpperCase() === 'S') continue
      const chave = m.belleMovId
      if (!porAtendimento.has(chave)) {
        porAtendimento.set(chave, { data: m.data, cliente: m.clienteNome, servico: m.servico ?? '', responsavel: m.responsavel ?? '' })
      } else if (m.servico) {
        const a = porAtendimento.get(chave)!
        if (!a.servico.includes(m.servico)) a.servico += ` + ${m.servico}`
      }
    }
    const atendimentos = [...porAtendimento.values()]
    const qtd = atendimentos.length
    linhas.push({
      slug: u.slug, nome: u.nome, qtd,
      bruto: qtd * BRUTO_POR_ATENDIMENTO,
      liquido: qtd * LIQUIDO_POR_ATENDIMENTO,
      atendimentos,
    })
  }
  linhas.sort((a, b) => b.qtd - a.qtd)

  const totais = {
    qtd: linhas.reduce((s, l) => s + l.qtd, 0),
    bruto: linhas.reduce((s, l) => s + l.bruto, 0),
    liquido: linhas.reduce((s, l) => s + l.liquido, 0),
  }
  // Pagamento no dia 20 do mês seguinte.
  const pagMes = mes === 12 ? 1 : mes + 1
  const pagAno = mes === 12 ? ano + 1 : ano

  return NextResponse.json({
    ano, mes,
    valores: { bruto: BRUTO_POR_ATENDIMENTO, liquido: LIQUIDO_POR_ATENDIMENTO },
    pagamentoEm: `${pagAno}-${String(pagMes).padStart(2, '0')}-20`,
    linhas, totais,
  })
}
