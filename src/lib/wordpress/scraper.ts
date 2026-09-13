import puppeteer from 'puppeteer'

const WP_URL = 'https://buddhaspa.com.br'
const WP_LOGIN_URL = `${WP_URL}/wp-login.php`

interface ScraperOptions {
  username: string
  password: string
  affiliation: string
}

/**
 * Faz scraping automático dos vouchers do WordPress usando Puppeteer
 * Login automático + navegação + extração de dados
 */
export async function scrapeVouchersFromWordPress(
  dataIni: string,
  dataFim: string,
  tipo: 'site' | 'omnichannel' | 'cortesia',
  options: ScraperOptions
): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
    ],
  })

  try {
    const page = await browser.newPage()

    // Define user agent realista
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    )

    // Define viewport
    await page.setViewport({ width: 1920, height: 1080 })

    console.log('🔐 Fazendo login no WordPress...')

    // Faz login com retry para aguardar Cloudflare
    await page.goto(WP_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 })

    // Aguarda Cloudflare liberar (se houver)
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Aguarda campo de login aparecer
    await page.waitForSelector('#user_login', { timeout: 30000 })

    await page.type('#user_login', options.username, { delay: 100 })
    await page.type('#user_pass', options.password, { delay: 100 })
    await page.click('#wp-submit')
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })

    console.log('✓ Login realizado')

    // Monta URL de acordo com o tipo
    let vouchersUrl: string

    if (tipo === 'omnichannel') {
      // Omnichannel: filtro por data de VENDA
      vouchersUrl = `${WP_URL}/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&affilliation_id=${options.affiliation}`
    } else {
      // Site e Cortesia: filtro por data de UTILIZAÇÃO
      vouchersUrl = `${WP_URL}/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${options.affiliation}`
    }

    console.log(`📄 Buscando vouchers ${tipo} (${dataIni} a ${dataFim})...`)

    // Navega para a página de vouchers
    await page.goto(vouchersUrl, { waitUntil: 'networkidle2', timeout: 60000 })

    // Aguarda a tabela de vouchers carregar
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
      console.log('⚠️ Tabela de vouchers não encontrada (pode estar vazia)')
    })

    // Extrai o HTML completo da página
    const html = await page.content()

    console.log('✓ HTML extraído com sucesso')

    return html
  } finally {
    await browser.close()
  }
}

/**
 * Busca vouchers de todos os tipos para um período específico
 */
export async function scrapeAllVoucherTypes(
  dataIni: string,
  dataFim: string,
  options: ScraperOptions
): Promise<{
  site: string
  omnichannel: string
  cortesia: string
}> {
  console.log(`\n🔄 Iniciando scraping completo para ${dataIni} a ${dataFim}\n`)

  const [siteHtml, omniHtml, cortesiaHtml] = await Promise.all([
    scrapeVouchersFromWordPress(dataIni, dataFim, 'site', options),
    scrapeVouchersFromWordPress(dataIni, dataFim, 'omnichannel', options),
    scrapeVouchersFromWordPress(dataIni, dataFim, 'cortesia', options),
  ])

  return {
    site: siteHtml,
    omnichannel: omniHtml,
    cortesia: cortesiaHtml,
  }
}
