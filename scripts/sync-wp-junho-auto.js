/**
 * Sincroniza vouchers do WordPress (Shopping Metrópole - Junho 2026)
 *
 * USO: node scripts/sync-wp-junho-auto.js
 */

const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const CONFIG = {
  wpUser: process.env.WP_METROPOLE_USER || 'adm.shoppingmetropole@buddhaspa.com.br',
  wpPass: process.env.WP_METROPOLE_PASS || 'Metro@1056',
  affiliation: process.env.WP_METROPOLE_AFFILIATION || '894555',
  dataIni: '2026-06-01',
  dataFim: '2026-06-15', // Apenas junho 01-15
  apiUrl: 'http://localhost:3000/api/vouchers/sync'
}

async function syncWordPress() {
  console.log('🚀 Iniciando sincronização WordPress → Belle')
  console.log(`📅 Período: ${CONFIG.dataIni} a ${CONFIG.dataFim}\n`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    // 1. Login no WordPress
    console.log('🔐 Fazendo login no WordPress...')
    await page.goto('https://buddhaspa.com.br/wp-login.php', { waitUntil: 'networkidle2' })

    await page.type('#user_login', CONFIG.wpUser)
    await page.type('#user_pass', CONFIG.wpPass)
    await page.click('#wp-submit')
    await page.waitForNavigation({ waitUntil: 'networkidle2' })

    console.log('   ✓ Login realizado\n')

    // 2. Buscar cada tipo de voucher
    const tipos = [
      {
        nome: 'SITE (E-commerce)',
        tipo: 'site',
        url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${CONFIG.dataIni}&date_used_end=${CONFIG.dataFim}&affilliation_id=${CONFIG.affiliation}`
      },
      {
        nome: 'OMNICHANNEL',
        tipo: 'omnichannel',
        url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${CONFIG.dataIni}&date_sell_end=${CONFIG.dataFim}&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=${CONFIG.affiliation}`
      },
      {
        nome: 'CORTESIA',
        tipo: 'cortesia',
        url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${CONFIG.dataIni}&date_used_end=${CONFIG.dataFim}&affilliation_id=${CONFIG.affiliation}`
      }
    ]

    for (const config of tipos) {
      console.log(`📦 Processando: ${config.nome}`)
      console.log('─'.repeat(50))

      // Navega para a URL
      await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 })

      // Aguarda tabela carregar
      await page.waitForSelector('#the-list', { timeout: 10000 }).catch(() => {
        console.log('   ⚠️  Tabela não encontrada (pode estar vazia)')
      })

      // Pega HTML da página
      const html = await page.content()

      console.log(`   ✓ HTML capturado: ${(html.length / 1024).toFixed(1)} KB`)

      // Envia para API local
      console.log('   📤 Enviando para API...')

      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataIni: CONFIG.dataIni,
          dataFim: CONFIG.dataFim,
          html: html,
          tipo: config.tipo
        })
      })

      const result = await response.json()

      if (result.error) {
        console.log(`   ❌ Erro: ${result.error}\n`)
      } else {
        console.log(`   ✅ Sincronizado!`)
        console.log(`      Total: ${result.totalValidados || 0} vouchers`)
        console.log(`      Valor: R$ ${(result.totalReembolso || 0).toFixed(2)}\n`)
      }
    }

    console.log('✅ Sincronização concluída!\n')

  } catch (error) {
    console.error('❌ Erro:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

// Executa
syncWordPress().catch(err => {
  console.error('Falha na sincronização:', err)
  process.exit(1)
})
