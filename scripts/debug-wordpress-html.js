#!/usr/bin/env node

/**
 * Captura e analisa HTML do WordPress para debug do parser
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '../.wordpress-cookies.json');
const AFFILIATION = '894555';
const dataIni = '2026-06-01';
const dataFim = '2026-06-30';

async function debugWordPressHTML() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DEBUG: Capturando HTML do WordPress');
  console.log('═══════════════════════════════════════════════════════\n');

  let browser;

  try {
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox'],
      userDataDir: './puppeteer-profile'
    });

    const page = await browser.newPage();

    // Carrega cookies
    if (fs.existsSync(COOKIES_FILE)) {
      console.log('🍪 Carregando cookies...');
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
      await page.setCookie(...cookies);
    }

    // URL dos vouchers SITE
    const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

    console.log('📄 Acessando página de vouchers...');
    console.log(`   URL: ${url}\n`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Aguarda carregar
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Scroll completo
    console.log('⏬ Fazendo scroll...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve(undefined);
          }
        }, 100);
      });
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extrai informações da página
    const analise = await page.evaluate(() => {
      const result = {
        temTabela: false,
        numLinhas: 0,
        primeirasLinhas: [],
        estrutura: {},
        html: ''
      };

      // Procura tabela
      const tbody = document.querySelector('tbody#the-list') ||
                   document.querySelector('table tbody');

      if (tbody) {
        result.temTabela = true;
        const rows = tbody.querySelectorAll('tr');
        result.numLinhas = rows.length;

        // Analisa primeiras 3 linhas
        for (let i = 0; i < Math.min(3, rows.length); i++) {
          const row = rows[i];
          const linhaInfo = {
            html: row.outerHTML.substring(0, 500),
            colunas: []
          };

          const cells = row.querySelectorAll('td');
          cells.forEach((cell, idx) => {
            const colName = cell.getAttribute('data-colname') || `col${idx}`;
            const text = cell.textContent.trim().substring(0, 100);
            linhaInfo.colunas.push({
              index: idx,
              dataColname: colName,
              texto: text,
              classes: cell.className
            });
          });

          result.primeirasLinhas.push(linhaInfo);
        }

        // Salva HTML completo da tabela
        result.html = tbody.innerHTML;
      }

      // Procura cards de resumo
      const cards = document.querySelectorAll('.card, .summary, [class*="total"]');
      if (cards.length > 0) {
        result.estrutura.cards = Array.from(cards).slice(0, 3).map(c => ({
          className: c.className,
          text: c.textContent.trim().substring(0, 200)
        }));
      }

      return result;
    });

    console.log('✅ ANÁLISE DA PÁGINA:');
    console.log(`   Tem tabela: ${analise.temTabela}`);
    console.log(`   Número de linhas: ${analise.numLinhas}`);
    console.log();

    if (analise.primeirasLinhas.length > 0) {
      console.log('📋 ESTRUTURA DAS PRIMEIRAS LINHAS:\n');
      analise.primeirasLinhas.forEach((linha, i) => {
        console.log(`   Linha ${i + 1}:`);
        linha.colunas.forEach(col => {
          console.log(`      Col ${col.index} [${col.dataColname}]: ${col.texto.substring(0, 50)}`);
        });
        console.log();
      });
    }

    // Salva HTML completo
    const htmlFile = 'wordpress-vouchers-debug.html';
    fs.writeFileSync(htmlFile, analise.html);
    console.log(`💾 HTML da tabela salvo em: ${htmlFile}`);
    console.log(`   Tamanho: ${(analise.html.length / 1024).toFixed(1)} KB`);

    // Salva análise
    const analiseFile = 'wordpress-analise.json';
    fs.writeFileSync(analiseFile, JSON.stringify({
      ...analise,
      html: `${analise.html.length} bytes`
    }, null, 2));
    console.log(`💾 Análise salva em: ${analiseFile}`);

    console.log('\n💡 Navegador ficará aberto por 10 segundos...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugWordPressHTML().catch(console.error);
