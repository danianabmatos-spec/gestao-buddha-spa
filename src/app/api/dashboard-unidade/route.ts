import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getFaturamentoMensal, getVendasRecepcao } from '@/lib/belle/bi'
import { getNPSRelatorio } from '@/lib/belle/relatorio-nps'
import { getCaixaDiario } from '@/lib/belle/caixa-diario'
import { getVoucherReembolso } from '@/lib/reembolso/voucher-unidade'
import { format, startOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const chave = (u: string, i: string, f: string) => `${u}_${i}_${f}`

// Calcula o bundle do dashboard AO VIVO (pesado: faturamento + vendas + nps + diário).
async function computar(unidade: string, dataIni: string, dataFim: string) {
  const c = getUnidadeCredenciais(unidade)
  if (!c) throw new Error('Unidade não encontrada')
  const ano = Number(dataIni.slice(0, 4))
  const mes = Number(dataIni.slice(5, 7))

  const [fat, vendas, nps, caixaDiario, voucherSite] = await Promise.all([
    getFaturamentoMensal(c.email, c.password, String(c.estab), dataIni, dataFim),
    getVendasRecepcao(c.email, c.password, String(c.estab), dataIni, dataFim),
    getNPSRelatorio(c.email, c.password, dataIni, dataFim, c.estab),
    getCaixaDiario(unidade, dataIni, dataFim),
    getVoucherReembolso(unidade, ano, mes),
  ])

  return {
    faturamento: {
      caixa: fat.caixa,
      totalPass: fat.totalPass,
      gympass: fat.gympass,
      horasAtendimento: fat.horasAtendimento,
      voucherSite,
    },
    vendas,
    nps,
    caixaDiario,
  }
}

async function atualizar(unidade: string, dataIni: string, dataFim: string) {
  const dados = await computar(unidade, dataIni, dataFim)
  const row = await prisma.dashboardCache.upsert({
    where: { chave: chave(unidade, dataIni, dataFim) },
    create: { chave: chave(unidade, dataIni, dataFim), dados: JSON.stringify(dados) },
    update: { dados: JSON.stringify(dados) },
  })
  return { ...dados, atualizadoEm: row.atualizadoEm.toISOString() }
}

// GET — serve do CACHE (instantâneo). Só calcula ao vivo se ainda não houver cache.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const unidade = searchParams.get('unidade')
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')
    if (!unidade || !dataIni || !dataFim) {
      return NextResponse.json({ error: 'Parâmetros: unidade, dataIni, dataFim' }, { status: 400 })
    }
    if (!getUnidadeCredenciais(unidade)) {
      return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    }
    const cache = await prisma.dashboardCache.findUnique({ where: { chave: chave(unidade, dataIni, dataFim) } })
    if (cache) {
      return NextResponse.json({ ...JSON.parse(cache.dados), atualizadoEm: cache.atualizadoEm.toISOString(), fromCache: true })
    }
    const dados = await atualizar(unidade, dataIni, dataFim)
    return NextResponse.json({ ...dados, fromCache: false })
  } catch (error: any) {
    console.error('[dashboard-unidade] erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao montar o dashboard' }, { status: 500 })
  }
}

// POST (refresh) — recalcula ao vivo e atualiza o cache. Botão "Atualizar agora" e cron.
// Sem unidade = refresca as 7 (usado pelo cron). Sem datas = mês atual até hoje.
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const hoje = new Date()
    const dataIni = searchParams.get('dataIni') || format(startOfMonth(hoje), 'yyyy-MM-dd')
    const dataFim = searchParams.get('dataFim') || format(hoje, 'yyyy-MM-dd')
    const unidadeParam = searchParams.get('unidade')

    const unidades = unidadeParam
      ? [unidadeParam]
      : ['higienopolis', 'perdizes', 'analia-franco', 'shopping-analia-franco', 'mooca-plaza', 'shopping-metropole', 'tatuape-gomescardim']

    const resultados: Record<string, string> = {}
    for (const u of unidades) {
      try { const r = await atualizar(u, dataIni, dataFim); resultados[u] = r.atualizadoEm }
      catch (e: any) { resultados[u] = `erro: ${e.message}` }
    }
    return NextResponse.json({ ok: true, periodo: { inicio: dataIni, fim: dataFim }, resultados })
  } catch (error: any) {
    console.error('[dashboard-unidade] refresh erro:', error)
    return NextResponse.json({ error: error.message || 'Erro no refresh' }, { status: 500 })
  }
}
