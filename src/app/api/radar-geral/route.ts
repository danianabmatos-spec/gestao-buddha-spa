import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { RadarGeralData, IndicadoresUnidade } from '@/types/radar-geral'
import { UNIDADES_CONFIG } from '@/types/radar-geral'

// Voucher do site (por unidade) = valor de REEMBOLSO do mês, vindo do módulo de
// reembolso (o único caminho autenticado que passa pelo Cloudflare do WordPress).
// mapeado pela data do filtro (deriva ano/mês de dataIni).
async function getVoucherReembolsoPorUnidade(ano: number, mes: number): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  try {
    const mesRow = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true } })
    if (!mesRow) return map
    const linhas = await prisma.reembolsoUnidade.findMany({
      where: { reembolsoMesId: mesRow.id },
      select: { vouchers: true, unidade: { select: { slug: true } } },
    })
    for (const l of linhas) map[l.unidade.slug] = l.vouchers
  } catch (e) {
    console.error('[radar-geral] falha ao ler voucher reembolso:', e)
  }
  return map
}

/**
 * API Consolidada - Radar Geral
 *
 * Busca dados de todas as 7 unidades e retorna consolidado
 *
 * Query params:
 * - dataIni: Data inicial (YYYY-MM-DD)
 * - dataFim: Data final (YYYY-MM-DD)
 */
// Calcula o Radar AO VIVO (pesado: ~40 chamadas Belle/APIs).
async function computarRadar(dataIni: string, dataFim: string): Promise<RadarGeralData> {
  const ano = Number(dataIni.slice(0, 4))
  const mes = Number(dataIni.slice(5, 7))
  const voucherPorSlug = await getVoucherReembolsoPorUnidade(ano, mes)

  const unidades = await Promise.all(
    UNIDADES_CONFIG.map((config) => buscarDadosUnidade(config.slug, dataIni, dataFim, voucherPorSlug[config.slug] || 0))
  )

  const unidadesAtivas = unidades.filter(u => u.status === 'ativo')
  const totalizadores = {
    faturamentoTotal: unidadesAtivas.reduce((s, u) => s + u.faturamento.total, 0),
    horasTotais: unidadesAtivas.reduce((s, u) => s + u.horasAtendimento, 0),
    npsMedia: unidadesAtivas.length > 0 ? Math.round(unidadesAtivas.reduce((s, u) => s + u.nps, 0) / unidadesAtivas.length) : 0,
    notaGoogleMedia: unidadesAtivas.length > 0 ? Number((unidadesAtivas.reduce((s, u) => s + u.notaGoogle, 0) / unidadesAtivas.length).toFixed(1)) : 0,
  }
  return { periodo: { inicio: dataIni, fim: dataFim }, unidades, totalizadores }
}

const chavePeriodo = (dataIni: string, dataFim: string) => `${dataIni}_${dataFim}`
function periodoPadrao(): { dataIni: string; dataFim: string } {
  const h = new Date()
  const mm = String(h.getMonth() + 1).padStart(2, '0')
  return { dataIni: `${h.getFullYear()}-${mm}-01`, dataFim: `${h.getFullYear()}-${mm}-${String(h.getDate()).padStart(2, '0')}` }
}

async function atualizarCache(dataIni: string, dataFim: string): Promise<RadarGeralData & { atualizadoEm: string; parcial?: boolean }> {
  const dados = await computarRadar(dataIni, dataFim)
  const periodo = chavePeriodo(dataIni, dataFim)

  // Trava de segurança: se metade ou mais das unidades falhou (ex.: Belle fora
  // no momento do refresh), NÃO sobrescreve um cache bom com um resultado ruim.
  // Mantém o número anterior e sinaliza 'parcial' — a Daniana pode tentar de novo.
  const erros = dados.unidades.filter(u => u.status === 'erro').length
  if (erros >= Math.ceil(dados.unidades.length / 2)) {
    const anterior = await prisma.radarCache.findUnique({ where: { periodo } })
    if (anterior) {
      console.warn(`[radar-geral] refresh de ${periodo} com ${erros} unidade(s) em erro — mantendo cache anterior`)
      return { ...(JSON.parse(anterior.dados) as RadarGeralData), atualizadoEm: anterior.atualizadoEm.toISOString(), parcial: true }
    }
  }

  const row = await prisma.radarCache.upsert({
    where: { periodo }, create: { periodo, dados: JSON.stringify(dados) }, update: { dados: JSON.stringify(dados) },
  })
  return { ...dados, atualizadoEm: row.atualizadoEm.toISOString() }
}

// GET — serve do CACHE (instantâneo). Só calcula ao vivo se ainda não houver cache pro período.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')
    if (!dataIni || !dataFim) {
      return NextResponse.json({ error: 'Parâmetros dataIni e dataFim são obrigatórios' }, { status: 400 })
    }
    const cache = await prisma.radarCache.findUnique({ where: { periodo: chavePeriodo(dataIni, dataFim) } })
    if (cache) {
      return NextResponse.json({ ...JSON.parse(cache.dados), atualizadoEm: cache.atualizadoEm.toISOString(), fromCache: true })
    }
    const dados = await atualizarCache(dataIni, dataFim)
    return NextResponse.json({ ...dados, fromCache: false })
  } catch (error) {
    console.error('Erro ao buscar dados do radar geral:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados consolidados' }, { status: 500 })
  }
}

// POST (refresh) — recalcula ao vivo e atualiza o cache. Sem params = mês atual até hoje.
// Usado pelo botão "Atualizar agora" e pelo cron diário da manhã.
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let dataIni = searchParams.get('dataIni')
    let dataFim = searchParams.get('dataFim')
    if (!dataIni || !dataFim) { const p = periodoPadrao(); dataIni = p.dataIni; dataFim = p.dataFim }
    const dados = await atualizarCache(dataIni, dataFim)
    return NextResponse.json({ ok: true, atualizadoEm: dados.atualizadoEm, periodo: { inicio: dataIni, fim: dataFim } })
  } catch (error) {
    console.error('Erro ao atualizar radar geral:', error)
    return NextResponse.json({ ok: false, error: 'Erro ao atualizar' }, { status: 500 })
  }
}

/**
 * Busca dados de uma unidade específica
 */
async function buscarDadosUnidade(
  unidadeSlug: string,
  dataIni: string,
  dataFim: string,
  voucherReembolso = 0
): Promise<IndicadoresUnidade> {
  const config = UNIDADES_CONFIG.find(u => u.slug === unidadeSlug)

  if (!config) {
    return criarUnidadeSemDados(unidadeSlug)
  }

  // Todas as 7 unidades agora têm dados configurados
  const unidadesAtivas = [
    'shopping-metropole',
    'analia-franco',
    'shopping-analia-franco',
    'perdizes',
    'tatuape-gomescardim',
    'mooca-plaza',
    'higienopolis'
  ]

  if (unidadesAtivas.includes(unidadeSlug)) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'

      // Busca dados em paralelo
      const [faturamentoRes, npsRes, googleRes, vendasRes] = await Promise.all([
        fetch(`${baseUrl}/api/belle/faturamento?unidade=${unidadeSlug}&dataIni=${dataIni}&dataFim=${dataFim}`, {
          cache: 'no-store'
        }),
        fetch(`${baseUrl}/api/belle/nps?unidade=${unidadeSlug}&dataIni=${dataIni}&dataFim=${dataFim}`, {
          cache: 'no-store'
        }),
        fetch(`${baseUrl}/api/google/reviews?unidade=${unidadeSlug}`, {
          cache: 'no-store'
        }),
        fetch(`${baseUrl}/api/belle/vendas-recepcao?unidade=${unidadeSlug}&dataIni=${dataIni}&dataFim=${dataFim}`, {
          cache: 'no-store'
        })
      ])

      const faturamento = faturamentoRes.ok ? await faturamentoRes.json() : null
      // Faturamento é o número-chave. Se o Belle falhou (HTTP != ok) ou devolveu
      // um marcador de erro, a unidade NÃO deve aparecer como 0 mudo: marca 'erro'.
      const faturamentoFalhou = !faturamentoRes.ok || !faturamento || faturamento.error != null
      const nps = npsRes.ok ? await npsRes.json() : null
      const google = googleRes.ok ? await googleRes.json() : null
      const vendas = vendasRes.ok ? await vendasRes.json() : null

      const totalVendas = (vendas?.vouchers?.valorLiquido || 0) +
                          (vendas?.planos?.valorLiquido || 0) +
                          (vendas?.produtos?.valorLiquido || 0)
      const quantidadeTotal = (vendas?.vouchers?.quantidade || 0) +
                              (vendas?.planos?.quantidade || 0) +
                              (vendas?.produtos?.quantidade || 0)

      const vendasRecepcao = totalVendas
      const ticketMedio = quantidadeTotal > 0 ? vendasRecepcao / quantidadeTotal : 0

      return {
        slug: unidadeSlug,
        nome: config.nome,
        faturamento: {
          caixa: faturamento?.caixa || 0,
          parcerias: (faturamento?.totalPass || 0) + (faturamento?.gympass || 0),
          totalPass: faturamento?.totalPass || 0,
          gympass: faturamento?.gympass || 0,
          voucherSite: voucherReembolso,
          total: (faturamento?.caixa || 0) +
                 ((faturamento?.totalPass || 0) + (faturamento?.gympass || 0)) +
                 voucherReembolso
        },
        vendasRecepcao,
        ticketMedio,
        horasAtendimento: faturamento?.horasAtendimento || 0,
        nps: nps?.unidade?.nps || 0,
        notaGoogle: google?.rating || 0,
        totalAvaliacoesGoogle: google?.totalReviews || 0,
        status: faturamentoFalhou ? 'erro' : 'ativo'
      }
    } catch (error) {
      console.error(`Erro ao buscar dados de ${unidadeSlug}:`, error)
      return {
        ...criarUnidadeSemDados(unidadeSlug),
        status: 'erro'
      }
    }
  }

  // Outras unidades: retorna sem dados (aguardando configuração)
  return criarUnidadeSemDados(unidadeSlug)
}

/**
 * Cria estrutura de unidade sem dados
 */
function criarUnidadeSemDados(slug: string): IndicadoresUnidade {
  const config = UNIDADES_CONFIG.find(u => u.slug === slug)

  return {
    slug,
    nome: config?.nome || slug,
    faturamento: {
      caixa: 0,
      parcerias: 0,
      totalPass: 0,
      gympass: 0,
      voucherSite: 0,
      total: 0
    },
    vendasRecepcao: 0,
    ticketMedio: 0,
    horasAtendimento: 0,
    nps: 0,
    notaGoogle: 0,
    totalAvaliacoesGoogle: 0,
    status: 'sem-dados'
  }
}
