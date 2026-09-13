import { ScrapingBeeClient } from 'scrapingbee'

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ''

/**
 * Scraper usando ScrapingBee - contorna Cloudflare automaticamente
 * Serviço pago mas 100% confiável
 */
export async function scrapeWithScrapingBee(url: string): Promise<string> {
  if (!SCRAPINGBEE_API_KEY) {
    throw new Error('SCRAPINGBEE_API_KEY não configurada. Cadastre em https://scrapingbee.com')
  }

  const client = new ScrapingBeeClient(SCRAPINGBEE_API_KEY)

  const response = await client.get({
    url,
    params: {
      render_js: true, // Executa JavaScript
      wait: 3000, // Aguarda 3 segundos
      premium_proxy: true, // Usa proxies premium (contorna Cloudflare)
    },
  })

  return response.data.toString()
}

/**
 * Busca vouchers usando ScrapingBee
 */
export async function scrapeVouchersWithScrapingBee(
  dataIni: string,
  dataFim: string,
  tipo: 'site' | 'omnichannel' | 'cortesia',
  affiliation: string
): Promise<string> {
  let url: string

  if (tipo === 'omnichannel') {
    url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&affilliation_id=${affiliation}`
  } else {
    url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${affiliation}`
  }

  console.log(`📡 Buscando via ScrapingBee: ${tipo} (${dataIni} a ${dataFim})`)

  const html = await scrapeWithScrapingBee(url)

  console.log(`✅ HTML recebido: ${html.length} bytes`)

  return html
}
