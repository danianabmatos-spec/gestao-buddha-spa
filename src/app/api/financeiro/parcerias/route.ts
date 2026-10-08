import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { PARCERIAS } from '@/lib/parcerias/reembolso'

export const dynamic = 'force-dynamic'

// Reembolso de parcerias: cada ATENDIMENTO do mês é pago no dia 20 do mês seguinte.
// Valor FLAT por atendimento (não o do Belle), líquido já sem royalties+mkt. Os valores
// vêm de @/lib/parcerias/reembolso (fonte única, compartilhada com o NF Salão Parceiro).

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
// recebido/justificativa/conciliado = validação: o que de fato entrou na conta vs o
// líquido calculado (diferença justificável). Vem da tabela ParceriaConciliacao.
interface Bloco { qtd: number; bruto: number; liquido: number; recebido: number; justificativa: string; conciliado: boolean; atendimentos: Atend[] }
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

  // Conciliação já lançada (valor recebido + justificativa) do mês, por unidade/parceria.
  const conc = await prisma.parceriaConciliacao.findMany({
    where: { ano, mes, unidadeId: { in: unidades.map((u) => u.id) } },
    select: { unidadeId: true, parceria: true, recebido: true, justificativa: true, conciliado: true },
  })
  const concMap = new Map(conc.map((c) => [`${c.unidadeId}:${c.parceria}`, c]))

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
      const c = concMap.get(`${u.id}:${p.chave}`)
      porParceria[p.chave] = {
        qtd, bruto: cent(qtd * p.bruto), liquido: cent(qtd * p.liquido),
        recebido: c?.recebido ?? 0, justificativa: c?.justificativa ?? '', conciliado: c?.conciliado ?? false,
        atendimentos,
      }
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

// POST /api/financeiro/parcerias → lança/valida o RECEBIDO de fato de uma parceria
// (+ justificativa da diferença) de uma unidade/mês. Body:
// { ano, mes, slug, parceria: 'totalpass'|'gympass', recebido, justificativa?, conciliado? }
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await request.json().catch(() => ({})) as {
    ano?: number; mes?: number; slug?: string; parceria?: string
    recebido?: number; justificativa?: string; conciliado?: boolean
  }
  const ano = Number(body.ano)
  const mes = Number(body.mes)
  const parceria = String(body.parceria ?? '')
  if (!ano || !mes || mes < 1 || mes > 12) return NextResponse.json({ error: 'ano/mes inválidos' }, { status: 400 })
  if (!PARCERIAS.some((p) => p.chave === parceria)) return NextResponse.json({ error: 'parceria inválida' }, { status: 400 })

  const slug = String(body.slug ?? '')
  const permitidas = unidadesPermitidas(session)
  if (permitidas != null && !permitidas.includes(slug)) return NextResponse.json({ error: 'Sem permissão para esta unidade' }, { status: 403 })
  const unidade = await prisma.unidade.findUnique({ where: { slug }, select: { id: true } })
  if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })

  const recebido = Math.round((Number(body.recebido) || 0) * 100) / 100
  const justificativa = String(body.justificativa ?? '').slice(0, 1000)
  const conciliado = body.conciliado ?? recebido > 0

  const row = await prisma.parceriaConciliacao.upsert({
    where: { ano_mes_unidadeId_parceria: { ano, mes, unidadeId: unidade.id, parceria } },
    create: { ano, mes, unidadeId: unidade.id, parceria, recebido, justificativa, conciliado },
    update: { recebido, justificativa, conciliado },
  })
  return NextResponse.json({ ok: true, recebido: row.recebido, justificativa: row.justificativa, conciliado: row.conciliado })
}
