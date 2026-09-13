/**
 * Script LOCAL para sincronização automática de vouchers
 * Roda no SEU computador (não no servidor) para contornar Cloudflare
 *
 * COMO USAR:
 * 1. Execute: node scripts/local-sync.js
 * 2. OU agende no Task Scheduler para rodar automaticamente todo dia 1º do mês
 */

const puppeteer = require('puppeteer')

const WP_USER = 'adm.shoppingmetropole@buddhaspa.com.br'
const WP_PASS = 'Metro@1056'
const WP_AFFILIATION = '894555'
const API_URL = 'http://localhost:3000/api/vouchers/sync'

async function syncVouchers(dataIni, dataFim, tipo) {
  console.log(`\n📅 Sincronizando ${tipo}: ${dataIni} a ${dataFim}...`)

  const browser = await puppeteer.launch({
    headless: false, // Mostra o browser para você ver
    defaultViewport: null
  })

  try {
    const page = await browser.newPage()

    // Login no WordPress
    console.log('🔐 Fazendo login...')
    await page.goto('https://buddhaspa.com.br/wp-login.php')
    await page.waitForSelector('#user_login', { timeout: 30000 })
    await page.type('#user_login', WP_USER)
    await page.type('#user_pass', WP_PASS)
    await page.click('#wp-submit')
    await page.waitForNavigation()

    // Monta URL conforme o tipo
    let url
    if (tipo === 'omnichannel') {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&affilliation_id=${WP_AFFILIATION}`
    } else {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${WP_AFFILIATION}`
    }

    // Busca vouchers
    console.log('📄 Buscando vouchers...')
    await page.goto(url, { waitUntil: 'networkidle2' })
    const html = await page.content()

    // Envia para API local
    console.log('💾 Salvando no sistema...')
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataIni, dataFim, html, tipo })
    })

    const result = await response.json()
    console.log(`✅ ${tipo}: ${result.totalValidados || 0} vouchers salvos`)

    return result
  } finally {
    await browser.close()
  }
}

async function syncMesAtual() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()

  const dataIni = `${ano}-${mes}-01`
  const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`

  console.log(`\n🚀 Iniciando sync automático - ${mes}/${ano}\n`)

  // Sincroniza os 3 tipos
  await syncVouchers(dataIni, dataFim, 'site')
  await syncVouchers(dataIni, dataFim, 'omnichannel')
  await syncVouchers(dataIni, dataFim, 'cortesia')

  console.log('\n✅ Sincronização concluída!')
  console.log('Acesse http://localhost:3000/vouchers para visualizar\n')
}

// Executa
syncMesAtual().catch(console.error)
