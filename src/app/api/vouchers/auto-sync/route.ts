import { NextRequest } from 'next/server'
import { scrapeVouchersWithScrapingBee } from '@/lib/wordpress/scrapingbee-scraper'
import { parseVouchersHTML } from '@/lib/wordpress/vouchers'
import { saveVoucherCacheByType } from '@/lib/cache-vouchers-multi'

export async function POST(request: NextRequest) {
  try {
    const { dataIni, dataFim } = await request.json()

    if (!dataIni || !dataFim) {
      return Response.json({ error: 'dataIni e dataFim são obrigatórios' }, { status: 400 })
    }

    const affiliation = process.env.WP_METROPOLE_AFFILIATION || '894555'

    console.log(`🚀 Auto-sync via ScrapingBee: ${dataIni} a ${dataFim}`)

    // Busca HTML dos 3 tipos usando ScrapingBee
    const [htmlSite, htmlOmni, htmlCortesia] = await Promise.all([
      scrapeVouchersWithScrapingBee(dataIni, dataFim, 'site', affiliation),
      scrapeVouchersWithScrapingBee(dataIni, dataFim, 'omnichannel', affiliation),
      scrapeVouchersWithScrapingBee(dataIni, dataFim, 'cortesia', affiliation),
    ])

    const htmls = { site: htmlSite, omnichannel: htmlOmni, cortesia: htmlCortesia }

    const siteData = parseVouchersHTML(htmls.site, dataIni, dataFim)
    saveVoucherCacheByType('site', {
      dataIni, dataFim,
      totalReembolso: siteData.totalReembolso,
      totalValidados: siteData.vouchers.length,
      pendentesValidacao: 0,
      validacaoManual: siteData.validacaoManual || 0,
      validacaoAutomatica: siteData.validacaoAutomatica || 0,
      vouchers: siteData.vouchers,
      savedAt: new Date().toISOString(),
    })

    const omniData = parseVouchersHTML(htmls.omnichannel, dataIni, dataFim)
    saveVoucherCacheByType('omnichannel', {
      dataIni, dataFim,
      totalReembolso: omniData.totalReembolso,
      totalValidados: omniData.vouchers.length,
      pendentesValidacao: 0,
      validacaoManual: 0,
      validacaoAutomatica: 0,
      vouchers: omniData.vouchers,
      savedAt: new Date().toISOString(),
    })

    const cortesiaRaw = parseVouchersHTML(htmls.cortesia, dataIni, dataFim)
    const vouchersCortesia = cortesiaRaw.vouchers.filter((v: any) => v.valorReembolso === 0)
    const totalValor = vouchersCortesia.reduce((sum: number, v: any) => sum + (v.valor || 0), 0)
    saveVoucherCacheByType('cortesia', {
      dataIni, dataFim,
      totalReembolso: 0,
      totalValor,
      totalValidados: vouchersCortesia.length,
      pendentesValidacao: 0,
      validacaoManual: 0,
      validacaoAutomatica: 0,
      vouchers: vouchersCortesia,
      savedAt: new Date().toISOString(),
    })

    return Response.json({
      ok: true,
      periodo: { ini: dataIni, fim: dataFim },
      site: { totalReembolso: siteData.totalReembolso, totalVouchers: siteData.vouchers.length },
      omnichannel: { totalReembolso: omniData.totalReembolso, totalVouchers: omniData.vouchers.length },
      cortesia: { totalValor, totalVouchers: vouchersCortesia.length },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
