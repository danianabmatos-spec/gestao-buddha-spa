import { NextRequest } from 'next/server'
import { getToken, BASE_URL, HEADERS } from '@/lib/belle/client-auth'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Lista todos os reports disponíveis no Belle BI
 * para encontrar o ID correto do "Relatório de Uso de Vouchers"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const unidade = searchParams.get('unidade')

  if (!unidade) {
    return Response.json(
      { error: 'Parâmetro unidade é obrigatório' },
      { status: 400 }
    )
  }

  const config = getUnidadeCredenciais(unidade)
  if (!config) {
    return Response.json({ error: 'Unidade não encontrada' }, { status: 404 })
  }

  try {
    console.log(`📋 Listando reports disponíveis no Belle: ${unidade}`)

    const token = await getToken(config.email, config.password)

    // Endpoint para listar reports
    const resp = await fetch(
      `${BASE_URL}/BI/v1.0/report/list?estabGeral=${config.estab}`,
      {
        method: 'GET',
        headers: { ...HEADERS, Authorization: token }
      }
    )

    if (!resp.ok) {
      throw new Error(`Belle list reports failed: ${resp.status}`)
    }

    const data = await resp.json()

    // Filtra por nome "voucher"
    const reportsVoucher = (data.reports || data || []).filter((r: any) =>
      r.name?.toLowerCase().includes('voucher') ||
      r.title?.toLowerCase().includes('voucher') ||
      r.description?.toLowerCase().includes('voucher')
    )

    console.log(`✅ Reports encontrados: ${(data.reports || data || []).length} total`)
    console.log(`🎫 Reports com "voucher": ${reportsVoucher.length}`)

    return Response.json({
      total: (data.reports || data || []).length,
      reportsVoucher,
      todosReports: data.reports || data || []
    })
  } catch (error) {
    console.error('❌ Erro ao listar reports do Belle:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
