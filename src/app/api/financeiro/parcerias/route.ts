import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Reembolso de parcerias: cada ATENDIMENTO do mês é pago no dia 20 do mês seguinte.
// Valor FLAT por atendimento (não o do Belle), líquido já sem royalties+mkt. Controle
// idêntico por parceria — só mudam os valores.
const PARCERIAS: Record<string, { nome: string; forma: string; bruto: number; liquido: number }> = {
  totalpass: { nome: 'TotalPass', forma: 'Parcerias Comerciais - TotalPass', bruto: 225, liquido: 207 },
  gympass: { nome: 'Gympass', forma: 'Parcerias Comerciais - Gympass', bruto: 86.40, liquido: 79.48 },
}

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]

// GET /api/financeiro/parcerias?parceria=totalpass|gympass&ano=&mes=
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(request.url)
  const chave = (searchParams.get('parceria') || 'totalpass').toLowerCase()
  const cfg = PARCERIAS[chave]
  if (!cfg) return NextResponse.json({ error: 'Parceria inválida' }, { status: 400 })

  const ano = Number(searchParams.get('ano')) || new Date().getFullYear()
  const mes = Number(searchParams.get('mes')) || new Date().getMonth() + 1
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`

  const permitidas = unidadesPermitidas(session)
  const visiveis = permitidas == null ? UNIDADES : UNIDADES.filter((u) => permitidas.includes(u.slug))
  const unidades = await prisma.unidade.findMany({ where: { slug: { in: visiveis.map((u) => u.slug) } }, select: { id: true, slug: true, nome: true } })

  const linhas = []
  for (const u of unidades) {
    const movs = await prisma.movimentacaoBelle.findMany({
      where: { unidadeId: u.id, formaPagamento: cfg.forma, data: { startsWith: prefixo } },
      select: { belleMovId: true, data: true, clienteNome: true, servico: true, responsavel: true, tipoMovimento: true },
      orderBy: { data: 'asc' },
    })
    // 1 atendimento = 1 belleMovId (Day Spa pode gerar várias linhas com o mesmo id).
    const porAtendimento = new Map<string, { data: string; cliente: string; servico: string; responsavel: string }>()
    for (const m of movs) {
      if ((m.tipoMovimento ?? 'E').toUpperCase() === 'S') continue
      if (!porAtendimento.has(m.belleMovId)) {
        porAtendimento.set(m.belleMovId, { data: m.data, cliente: m.clienteNome, servico: m.servico ?? '', responsavel: m.responsavel ?? '' })
      } else if (m.servico) {
        const a = porAtendimento.get(m.belleMovId)!
        if (!a.servico.includes(m.servico)) a.servico += ` + ${m.servico}`
      }
    }
    const atendimentos = [...porAtendimento.values()]
    const qtd = atendimentos.length
    linhas.push({
      slug: u.slug, nome: u.nome, qtd,
      bruto: Math.round(qtd * cfg.bruto * 100) / 100,
      liquido: Math.round(qtd * cfg.liquido * 100) / 100,
      atendimentos,
    })
  }
  linhas.sort((a, b) => b.qtd - a.qtd)

  const totais = {
    qtd: linhas.reduce((s, l) => s + l.qtd, 0),
    bruto: Math.round(linhas.reduce((s, l) => s + l.bruto, 0) * 100) / 100,
    liquido: Math.round(linhas.reduce((s, l) => s + l.liquido, 0) * 100) / 100,
  }
  const pagMes = mes === 12 ? 1 : mes + 1
  const pagAno = mes === 12 ? ano + 1 : ano

  return NextResponse.json({
    parceria: chave, parceriaNome: cfg.nome,
    ano, mes,
    valores: { bruto: cfg.bruto, liquido: cfg.liquido },
    pagamentoEm: `${pagAno}-${String(pagMes).padStart(2, '0')}-20`,
    linhas, totais,
  })
}
