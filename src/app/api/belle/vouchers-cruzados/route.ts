import { NextRequest } from 'next/server'
import { getVouchersUsados, filtrarVouchersEcommerce } from '@/lib/belle/relatorio-vouchers'
import { cruzarVouchersBelleComWordPress } from '@/lib/belle/cross-vouchers'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const dataIni = searchParams.get('dataIni')
  const dataFim = searchParams.get('dataFim')
  const unidade = searchParams.get('unidade')

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
    console.log(`🔄 Cruzando vouchers Belle × WordPress: ${unidade} (${dataIni} a ${dataFim})`)

    // 1. Busca vouchers do Belle
    const todosVouchers = await getVouchersUsados(
      config.email,
      config.password,
      dataIni,
      dataFim,
      config.estab
    )

    const vouchersEcommerce = filtrarVouchersEcommerce(todosVouchers, dataIni, dataFim)

    console.log(`📦 Belle: ${todosVouchers.length} total | ${vouchersEcommerce.length} e-commerce`)

    // 2. Cruza com WordPress
    const vouchersCruzados = cruzarVouchersBelleComWordPress(
      vouchersEcommerce,
      dataIni,
      dataFim
    )

    // 3. Estatísticas (padrão Navvii)
    const stats = {
      total: vouchersCruzados.length,
      validacaoManual: vouchersCruzados.filter(v => v.formaValidacao === 'Manualmente').length,
      validacaoAutomatica: vouchersCruzados.filter(v => v.formaValidacao === 'Automatico').length,
      valorTotal: vouchersCruzados.reduce((sum, v) => sum + v.valorReembolso, 0),
    }

    console.log(`✅ Cruzamento concluído (Navvii):`, stats)

    return Response.json({
      periodo: { ini: dataIni, fim: dataFim },
      unidade: config.nome,
      estatisticas: stats,
      vouchers: vouchersCruzados,
    })
  } catch (error) {
    console.error('❌ Erro ao cruzar vouchers:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
