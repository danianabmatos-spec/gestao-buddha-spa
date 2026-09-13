import { NextRequest } from 'next/server'
import { getVouchersUsados, filtrarVouchersEcommerce } from '@/lib/belle/relatorio-vouchers'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const dataIni = searchParams.get('dataIni')
  const dataFim = searchParams.get('dataFim')
  const unidade = searchParams.get('unidade')
  const debug = searchParams.get('debug') === 'true'

  if (!dataIni || !dataFim || !unidade) {
    return Response.json(
      { error: 'Parâmetros dataIni, dataFim e unidade são obrigatórios' },
      { status: 400 }
    )
  }

  const config = getUnidadeCredenciais(unidade)
  if (!config) {
    return Response.json({ error: 'Unidade não encontrada' }, { status: 404 })
  }

  try {
    console.log(`🎫 Buscando vouchers usados (Belle Report 2422): ${unidade} - ${dataIni} a ${dataFim}`)

    const todosVouchers = await getVouchersUsados(
      config.email,
      config.password,
      dataIni,
      dataFim,
      config.estab
    )

    const vouchersEcommerce = filtrarVouchersEcommerce(todosVouchers, dataIni, dataFim)

    console.log(`✅ Vouchers encontrados: ${todosVouchers.length} total | ${vouchersEcommerce.length} e-commerce`)

    // Modo debug: mostra distribuição de datas
    if (debug) {
      const distribuicao: Record<string, number> = {}
      todosVouchers.forEach(v => {
        const data = v.dataExecucao || 'sem-data'
        distribuicao[data] = (distribuicao[data] || 0) + 1
      })

      const datas = Object.keys(distribuicao).sort()
      console.log('\n📊 Distribuição de datas:')
      datas.forEach(data => {
        console.log(`  ${data}: ${distribuicao[data]} vouchers`)
      })

      return Response.json({
        periodo: { ini: dataIni, fim: dataFim },
        unidade: config.nome,
        total: todosVouchers.length,
        ecommerce: vouchersEcommerce.length,
        distribuicaoDatas: distribuicao,
        datasUnicas: datas,
        primeiraData: datas[0],
        ultimaData: datas[datas.length - 1],
        vouchers: vouchersEcommerce,
        todosVouchers: todosVouchers,
      })
    }

    return Response.json({
      periodo: { ini: dataIni, fim: dataFim },
      unidade: config.nome,
      total: todosVouchers.length,
      ecommerce: vouchersEcommerce.length,
      vouchers: vouchersEcommerce,
      todosVouchers: todosVouchers, // Para debug
    })
  } catch (error) {
    console.error('❌ Erro ao buscar vouchers do Belle:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
