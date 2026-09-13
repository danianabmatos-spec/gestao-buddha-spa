import { NextRequest } from 'next/server'
import { parseVouchersHTML } from '@/lib/wordpress/vouchers'
import { saveVoucherCacheByType } from '@/lib/cache-vouchers-multi'

/**
 * Endpoint para upload de HTML das páginas de vouchers do WordPress
 * Permite sincronização offline sem precisar de browser relay
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const htmlFile = formData.get('html') as File
    const dataIni = formData.get('dataIni') as string
    const dataFim = formData.get('dataFim') as string
    const tipo = formData.get('tipo') as 'site' | 'omnichannel' | 'cortesia'

    if (!htmlFile || !dataIni || !dataFim || !tipo) {
      return Response.json({
        error: 'Parâmetros obrigatórios: html (arquivo), dataIni, dataFim, tipo'
      }, { status: 400 })
    }

    const html = await htmlFile.text()
    const resultado = parseVouchersHTML(html, dataIni, dataFim)

    // Filtra cortesias se tipo === 'cortesia'
    let vouchers = resultado.vouchers
    let totalReembolso = resultado.totalReembolso
    let totalValor = undefined

    if (tipo === 'cortesia') {
      vouchers = resultado.vouchers.filter((v: any) => v.valorReembolso === 0)
      totalReembolso = 0
      totalValor = vouchers.reduce((sum: number, v: any) => sum + (v.valor || 0), 0)
    }

    saveVoucherCacheByType(tipo, {
      dataIni,
      dataFim,
      totalReembolso,
      totalValor,
      totalValidados: vouchers.length,
      pendentesValidacao: 0,
      validacaoManual: resultado.validacaoManual || 0,
      validacaoAutomatica: resultado.validacaoAutomatica || 0,
      vouchers,
      savedAt: new Date().toISOString(),
    })

    return Response.json({
      ok: true,
      tipo,
      periodo: `${dataIni} até ${dataFim}`,
      totalReembolso,
      totalValor,
      totalVouchers: vouchers.length,
      savedAt: new Date().toISOString(),
    })
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}
