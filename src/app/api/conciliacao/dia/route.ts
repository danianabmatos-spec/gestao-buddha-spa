import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/conciliacao/dia?unidade=slug&data=YYYY-MM-DD
 * Estado da conciliação de um dia: resumo, caixa, quebra por forma e divergências.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const sp = request.nextUrl.searchParams
    const unidadeSlug = resolveUnidade(session, sp.get('unidade'))
    if (!unidadeSlug) {
      return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })
    }
    const data = sp.get('data') || hojeBrasilia()
    if (!ISO.test(data)) {
      return NextResponse.json({ error: 'Data deve estar no formato YYYY-MM-DD' }, { status: 400 })
    }

    const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
    if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    const unidadeId = unidade.id

    const [resumo, movs, caixa, saidasAgg, divergencias] = await Promise.all([
      prisma.conciliacaoDia.findUnique({ where: { unidadeId_data: { unidadeId, data } } }),
      prisma.movimentacaoBelle.groupBy({
        by: ['formaPagamento'],
        where: { unidadeId, data },
        _count: { _all: true },
        _sum: { valorLiquido: true },
      }),
      prisma.contagemCaixa.findUnique({ where: { unidadeId_data: { unidadeId, data } } }),
      prisma.saidaCaixa.aggregate({ where: { unidadeId, data }, _sum: { valor: true } }),
      prisma.divergencia.findMany({
        where: { unidadeId, data },
        orderBy: [{ status: 'asc' }, { id: 'asc' }],
        include: { movimentacao: { select: { vendaRef: true, clienteNome: true, servico: true } } },
      }),
    ])

    // Enriquece as divergências com o código (voucher/NSU), cliente e serviço, pra
    // facilitar a correção. Vem da movimentação ligada; se for do lado externo
    // (ex.: validado sem uso), busca na FonteExterna.
    const fonteIds = divergencias.map((d) => d.fonteExternaId).filter((v): v is number => v != null)
    const fontes = fonteIds.length
      ? await prisma.fonteExterna.findMany({ where: { id: { in: fonteIds } }, select: { id: true, refExterna: true, descricao: true } })
      : []
    const fonteById = new Map(fontes.map((f) => [f.id, f]))
    const divergenciasEnriq = divergencias.map((d) => {
      const fonte = d.fonteExternaId != null ? fonteById.get(d.fonteExternaId) : undefined
      return {
        ...d,
        movimentacao: undefined,
        codigo: d.movimentacao?.vendaRef ?? fonte?.refExterna ?? null,
        cliente: d.movimentacao?.clienteNome ?? null,
        servico: d.movimentacao?.servico ?? fonte?.descricao ?? null,
      }
    })

    const porForma = movs
      .map((m) => ({
        formaPagamento: m.formaPagamento ?? '(sem forma)',
        qtd: m._count._all,
        total: Number((m._sum.valorLiquido ?? 0).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      unidade: unidadeSlug,
      data,
      resumo,
      caixa: caixa
        ? {
            fundoAbertura: caixa.fundoAbertura,
            valorFechamento: caixa.valorFechamento,
            saidas: Number((saidasAgg._sum.valor ?? 0).toFixed(2)),
          }
        : null,
      porForma,
      divergencias: divergenciasEnriq,
    })
  } catch (error) {
    console.error('[Conciliação/Dia] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao carregar conciliação'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
