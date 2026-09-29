import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Coluna extra (eixo do serviço): atendimentos sem lastro financeiro / cortesia / desconto.
const COL_ATEND = 'Atend. s/ financeiro'
// Tipos de divergência do eixo de ATENDIMENTOS (Parte 2) → caem na coluna COL_ATEND.
const ATEND_TIPOS = ['ATENDIMENTO_SEM_JUSTIFICATIVA', 'CORTESIA', 'DESCONTO']

// Colunas do resumo (ordem de exibição). Formas de pagamento + a coluna de atendimentos.
const COLUNAS_FORMA = ['Dinheiro', 'Cartão', 'Pix', 'TotalPass', 'Gympass', 'Voucher'] as const
const COLUNAS = [...COLUNAS_FORMA, COL_ATEND] as const
type Coluna = (typeof COLUNAS)[number]

// Mapeia a forma de pagamento do Belle → coluna do resumo.
function colunaDaForma(forma: string | null): Coluna | null {
  if (!forma) return null
  if (forma === 'Dinheiro') return 'Dinheiro'
  if (forma.startsWith('Cartão')) return 'Cartão'
  if (forma.startsWith('PIX')) return 'Pix'
  if (forma.includes('TotalPass')) return 'TotalPass'
  if (forma.includes('Gympass')) return 'Gympass'
  if (forma.includes('Voucher')) return 'Voucher'
  return null
}

const STATUS_ABERTOS = ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA']

interface Celula {
  status: 'ok' | 'divergente' | 'pendente' | 'vazio'
  diferenca: number
  qtdDivergencias: number
  total: number // movimentado (líquido) no dia/forma
}

function celulaVazia(): Celula {
  return { status: 'vazio', diferenca: 0, qtdDivergencias: 0, total: 0 }
}

/**
 * GET /api/conciliacao/mes?unidade=slug&ano=2026&mes=9
 * Resumo do mês: uma linha por dia (com movimento), colunas por forma de pagamento.
 * Cada célula traz status (ok/divergente/pendente/vazio) e a diferença.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const sp = request.nextUrl.searchParams
    const unidadeSlug = resolveUnidade(session, sp.get('unidade'))
    if (!unidadeSlug) return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })

    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    const ano = Number(sp.get('ano')) || Number(hoje.slice(0, 4))
    const mes = Number(sp.get('mes')) || Number(hoje.slice(5, 7))
    if (mes < 1 || mes > 12) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}` // "2026-09"

    const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
    if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    const unidadeId = unidade.id

    const [movs, divs, atendDias] = await Promise.all([
      prisma.movimentacaoBelle.findMany({
        where: { unidadeId, data: { startsWith: prefixo } },
        select: { data: true, formaPagamento: true, statusConcil: true, valorLiquido: true, tipoMovimento: true },
      }),
      prisma.divergencia.findMany({
        where: { unidadeId, data: { startsWith: prefixo }, status: { in: STATUS_ABERTOS } },
        select: { id: true, data: true, tipo: true, formaPagamento: true, diferenca: true, descricao: true },
        orderBy: [{ data: 'asc' }, { id: 'asc' }],
      }),
      // Dias que tiveram atendimentos (p/ marcar verde quando o dia está limpo).
      prisma.atendimentoConc.groupBy({ by: ['data'], where: { unidadeId, data: { startsWith: prefixo } }, _count: { _all: true } }),
    ])

    // dia -> coluna -> Celula
    const grade = new Map<string, Record<Coluna, Celula>>()
    const garantirDia = (dia: string) => {
      if (!grade.has(dia)) {
        grade.set(dia, Object.fromEntries(COLUNAS.map((c) => [c, celulaVazia()])) as Record<Coluna, Celula>)
      }
      return grade.get(dia)!
    }

    const totalDia = new Map<string, number>() // dia -> total movimentado (líquido, entradas)
    for (const m of movs) {
      if ((m.tipoMovimento ?? 'E').toUpperCase() === 'S') continue
      totalDia.set(m.data, (totalDia.get(m.data) ?? 0) + (m.valorLiquido || 0))
      const col = colunaDaForma(m.formaPagamento)
      if (!col) continue
      const cel = garantirDia(m.data)[col]
      cel.total += m.valorLiquido || 0
      // status provisório pelos movimentos (divergência sobrescreve depois)
      if (cel.status === 'vazio') cel.status = m.statusConcil === 'CONCILIADA' ? 'ok' : 'pendente'
    }

    // Marca verde os dias que tiveram atendimentos (será sobrescrito por divergência abaixo).
    for (const ad of atendDias) {
      const cel = garantirDia(ad.data)[COL_ATEND]
      if (cel.status === 'vazio') cel.status = 'ok'
    }

    for (const dv of divs) {
      // Divergência do eixo de atendimentos → coluna COL_ATEND; senão, coluna da forma.
      const col = ATEND_TIPOS.includes(dv.tipo) ? COL_ATEND : colunaDaForma(dv.formaPagamento)
      if (!col) continue
      const cel = garantirDia(dv.data)[col]
      cel.status = 'divergente'
      cel.diferenca += dv.diferenca || 0
      cel.qtdDivergencias += 1
    }

    const dias = [...grade.keys()].sort().map((dia) => ({
      dia,
      diaNum: Number(dia.slice(8, 10)),
      celulas: grade.get(dia)!,
      total: Number((totalDia.get(dia) ?? 0).toFixed(2)),
    }))

    // Totais do mês por coluna (nº de divergências abertas).
    const totaisDivergencias = Object.fromEntries(
      COLUNAS.map((c) => [c, dias.reduce((s, d) => s + d.celulas[c].qtdDivergencias, 0)]),
    )

    // Lista plana de TODAS as divergências abertas do mês (quadro lateral).
    const divergencias = divs.map((dv) => ({
      id: dv.id,
      data: dv.data,
      diaNum: Number(dv.data.slice(8, 10)),
      tipo: dv.tipo,
      formaPagamento: dv.formaPagamento,
      coluna: ATEND_TIPOS.includes(dv.tipo) ? COL_ATEND : (colunaDaForma(dv.formaPagamento) ?? null),
      diferenca: dv.diferenca || 0,
      descricao: dv.descricao,
    }))

    return NextResponse.json({ unidade: unidadeSlug, ano, mes, colunas: COLUNAS, colAtend: COL_ATEND, dias, totaisDivergencias, divergencias })
  } catch (error) {
    console.error('[Conciliação/Mês] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao carregar o resumo do mês'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
