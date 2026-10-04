import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Reembolso de parcerias: cada ATENDIMENTO do mês é pago no dia 20 do mês seguinte.
// Valor FLAT por atendimento (não o do Belle), líquido já sem royalties+mkt. Controle
// idêntico por parceria — só mudam os valores.
const PARCERIAS = [
  { chave: 'totalpass', nome: 'TotalPass', forma: 'Parcerias Comerciais - TotalPass', bruto: 225, liquido: 207 },
  { chave: 'gympass', nome: 'Gympass', forma: 'Parcerias Comerciais - Gympass', bruto: 86.40, liquido: 79.48 },
] as const

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]

const cent = (n: number) => Math.round(n * 100) / 100

interface Atend { data: string; cliente: string; servico: string; responsavel: string }
interface Bloco { qtd: number; bruto: number; liquido: number; atendimentos: Atend[] }
interface LinhaParceria { slug: string; nome: string; totalpass: Bloco; gympass: Bloco }

// GET /api/financeiro/parcerias?ano=&mes=  → TotalPass E Gympass juntos, por unidade.
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

  const linhas: LinhaParceria[] = []
  for (const u of unidades) {
    const porParceria: Record<string, Bloco> = {}
    for (const p of PARCERIAS) {
      const movs = await prisma.movimentacaoBelle.findMany({
        where: { unidadeId: u.id, formaPagamento: p.forma, data: { startsWith: prefixo } },
        select: { belleMovId: true, data: true, clienteNome: true, servico: true, responsavel: true, tipoMovimento: true },
        orderBy: { data: 'asc' },
      })
      // 1 atendimento = 1 belleMovId (Day Spa pode gerar várias linhas com o mesmo id).
      const atd = new Map<string, Atend>()
      for (const m of movs) {
        if ((m.tipoMovimento ?? 'E').toUpperCase() === 'S') continue
        if (!atd.has(m.belleMovId)) atd.set(m.belleMovId, { data: m.data, cliente: m.clienteNome, servico: m.servico ?? '', responsavel: m.responsavel ?? '' })
        else if (m.servico) { const a = atd.get(m.belleMovId)!; if (!a.servico.includes(m.servico)) a.servico += ` + ${m.servico}` }
      }
      const atendimentos = [...atd.values()]
      const qtd = atendimentos.length
      porParceria[p.chave] = { qtd, bruto: cent(qtd * p.bruto), liquido: cent(qtd * p.liquido), atendimentos }
    }
    linhas.push({ slug: u.slug, nome: u.nome, totalpass: porParceria.totalpass, gympass: porParceria.gympass })
  }
  linhas.sort((a, b) => (b.totalpass.qtd + b.gympass.qtd) - (a.totalpass.qtd + a.gympass.qtd))

  const somaP = (chave: 'totalpass' | 'gympass', campo: 'qtd' | 'bruto' | 'liquido') => cent(linhas.reduce((s, l) => s + l[chave][campo], 0))
  const totais = {
    totalpass: { qtd: somaP('totalpass', 'qtd'), bruto: somaP('totalpass', 'bruto'), liquido: somaP('totalpass', 'liquido') },
    gympass: { qtd: somaP('gympass', 'qtd'), bruto: somaP('gympass', 'bruto'), liquido: somaP('gympass', 'liquido') },
    geral: {
      qtd: somaP('totalpass', 'qtd') + somaP('gympass', 'qtd'),
      bruto: cent(somaP('totalpass', 'bruto') + somaP('gympass', 'bruto')),
      liquido: cent(somaP('totalpass', 'liquido') + somaP('gympass', 'liquido')),
    },
  }
  const pagMes = mes === 12 ? 1 : mes + 1
  const pagAno = mes === 12 ? ano + 1 : ano

  return NextResponse.json({
    ano, mes,
    parcerias: PARCERIAS.map((p) => ({ chave: p.chave, nome: p.nome, bruto: p.bruto, liquido: p.liquido })),
    pagamentoEm: `${pagAno}-${String(pagMes).padStart(2, '0')}-20`,
    linhas, totais,
  })
}
