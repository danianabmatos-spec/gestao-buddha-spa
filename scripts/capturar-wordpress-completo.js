#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '../.wordpress-cookies.json');
const AFFILIATION = '894555';
const dataIni = '2026-06-01';
const dataFim = '2026-06-30';

async function capturarWordPress() {
  console.log('🔍 Capturando WordPress com espera inteligente...\n');

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox'],
      userDataDir: './puppeteer-profile'
    });

    const page = await browser.newPage();

    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
      await page.setCookie(...cookies);
    }

    const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

    console.log('📄 Carregando página...');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

    // Screenshot inicial
    await page.screenshot({ path: 'wp-step1-inicial.png', fullPage: true });
    console.log('📸 Screenshot 1: wp-step1-inicial.png');

    // Aguarda até 30 segundos pela tabela aparecer
    console.log('\n⏳ Aguardando tabela aparecer (até 30s)...');

    try {
      await page.waitForSelector('table', { timeout: 30000 });
      console.log('✅ Tabela encontrada!');
    } catch (e) {
      console.log('⚠️  Timeout aguardando tabela');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Screenshot após espera
    await page.screenshot({ path: 'wp-step2-pos-espera.png', fullPage: true });
    console.log('📸 Screenshot 2: wp-step2-pos-espera.png');

    // Scroll
    console.log('\n⏬ Fazendo scroll...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Screenshot após scroll
    await page.screenshot({ path: 'wp-step3-pos-scroll.png', fullPage: true });
    console.log('📸 Screenshot 3: wp-step3-pos-scroll.png');

    // Analisa TUDO na página
    const analiseCompleta = await page.evaluate(() => {
      const result = {
        url: window.location.href,
        title: document.title,
        tabelas: [],
        totalElementos: document.querySelectorAll('*').length,
        textoVisivel: document.body.innerText.substring(0, 1000)
      };

      // Procura TODAS as tabelas
      const tables = document.querySelectorAll('table');
      tables.forEach((table, idx) => {
        const rows = table.querySelectorAll('tr');
        result.tabelas.push({
          index: idx,
          id: table.id,
          classes: table.className,
          numLinhas: rows.length,
          primeiraLinha: rows[0] ? rows[0].innerHTML.substring(0, 300) : ''
        });
      });

      return result;
    });

    console.log('\n📊 ANÁLISE COMPLETA:');
    console.log(`   URL: ${analiseCompleta.url}`);
    console.log(`   Title: ${analiseCompleta.title}`);
    console.log(`   Total elementos: ${analiseCompleta.totalElementos}`);
    console.log(`   Número de tabelas: ${analiseCompleta.tabelas.length}`);

    if (analiseCompleta.tabelas.length > 0) {
      console.log('\n   Tabelas encontradas:');
      analiseCompleta.tabelas.forEach(t => {
        console.log(`     ${t.index}: id="${t.id}" class="${t.classes}" linhas=${t.numLinhas}`);
      });
    }

    console.log('\n   Texto visível (primeiros 500 chars):');
    console.log(`   ${analiseCompleta.textoVisivel.substring(0, 500)}...\n`);

    // Salva HTML completo
    const html = await page.content();
    fs.writeFileSync('wordpress-page-completa.html', html);
    console.log(`💾 HTML completo salvo: wordpress-page-completa.html (${(html.length / 1024).toFixed(1)} KB)`);

    fs.writeFileSync('wordpress-analise-completa.json', JSON.stringify(analiseCompleta, null, 2));
    console.log('💾 Análise salva: wordpress-analise-completa.json');

    console.log('\n💡 Navegador ficará aberto por 20 segundos para inspeção manual...');
    await new Promise(resolve => setTimeout(resolve, 20000));

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

capturarWordPress().catch(console.error);
