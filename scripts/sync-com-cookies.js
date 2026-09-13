#!/usr/bin/env node

/**
 * Sincronização usando cookies de sessão do WordPress
 * Execute este script DEPOIS de estar logado no WordPress no Chrome
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '../.wordpress-cookies.json');
const API_URL = 'http://localhost:3000/api/vouchers/sync';
const AFFILIATION = '894555';
const BELLE_CREDENCIAIS = {
  email: 'adm.shoppingmetropole@buddhaspa.com.br',
  senha: 'Metr@1056',
  estabelecimento: 1
};

const dataIni = '2026-06-01';
const dataFim = '2026-06-30';

console.log(`\n📅 Período: ${dataIni} a ${dataFim}\n`);

async function syncWithCookies() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🍪 SINCRONIZAÇÃO COM COOKIES - WordPress → Sistema');
  console.log('═══════════════════════════════════════════════════════\n');

  let browser;

  try {
    // Inicia navegador
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: false, // Mostra o navegador para você ver
      args: ['--no-sandbox'],
      userDataDir: './puppeteer-profile' // Usa perfil persistente
    });

    const page = await browser.newPage();

    // Carrega cookies se existirem
    if (fs.existsSync(COOKIES_FILE)) {
      console.log('🍪 Carregando cookies salvos...');
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
      await page.setCookie(...cookies);
      console.log('✅ Cookies carregados!\n');
    } else {
      console.log('⚠️  Nenhum cookie salvo encontrado.');
      console.log('   O navegador vai abrir para você fazer login...\n');
    }

    // Testa acesso ao WordPress
    console.log('🔐 Testando acesso ao WordPress...');
    await page.goto('https://buddhaspa.com.br/wp-admin', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const currentUrl = page.url();
    console.log(`   URL atual: ${currentUrl}`);

    // Verifica se precisa fazer login
    if (currentUrl.includes('wp-login')) {
      console.log('\n⚠️  VOCÊ PRECISA FAZER LOGIN!');
      console.log('   1. O navegador está aberto');
      console.log('   2. Faça login no WordPress manualmente');
      console.log('   3. Aguarde... (detectarei automaticamente)\n');

      // Aguarda login
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 300000 // 5 minutos para fazer login
      });

      console.log('✅ Login detectado!\n');

      // Salva cookies para próximas execuções
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
      console.log('💾 Cookies salvos para próximas execuções!\n');
    } else {
      console.log('✅ Já está logado!\n');
    }

    // Agora sincroniza os vouchers
    const tipos = [
      {
        nome: 'SITE (E-commerce)',
        tipo: 'site',
        url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`,
        usaBelle: true
      },
      {
        nome: 'OMNICHANNEL',
        tipo: 'omnichannel',
        url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=${AFFILIATION}`,
        usaBelle: true
      },
      {
        nome: 'CORTESIA',
        tipo: 'cortesia',
        url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`,
        usaBelle: false
      }
    ];

    let totalGeral = 0;
    let valorGeral = 0;

    for (const config of tipos) {
      console.log(`📦 Processando: ${config.nome}`);
      console.log('─'.repeat(50));

      try {
        console.log('   Carregando página...');
        await page.goto(config.url, {
          waitUntil: 'domcontentloaded',
          timeout: 90000
        });

        // Aguarda página carregar completamente
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Tenta encontrar a tabela, mas não falha se não encontrar
        try {
          await page.waitForSelector('table, .wrap', { timeout: 15000 });
        } catch {
          console.log('   ⚠️  Tabela não encontrada, tentando continuar...');
        }

        // Faz scroll até o final da página para garantir que todos os dados carregaram
        console.log('   ⏬ Fazendo scroll para carregar todos os dados...');
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

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verifica se há botão "Show more" ou paginação
        try {
          const moreButton = await page.$('button:contains("more"), a:contains("more"), .show-more, .load-more');
          if (moreButton) {
            console.log('   ⏬ Clicando em "Show more"...');
            await moreButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch {}

        const html = await page.content();
        console.log(`   ✓ HTML extraído: ${(html.length / 1024).toFixed(1)} KB`);

        console.log('   Enviando para API...');

        const payload = {
          dataIni,
          dataFim,
          html,
          tipo: config.tipo
        };

        if (config.usaBelle) {
          payload.belleCredenciais = BELLE_CREDENCIAIS;
        }

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.ok) {
          const total = data.totalValidados || 0;
          const valor = data.totalReembolso || data.totalValor || 0;

          totalGeral += total;
          valorGeral += valor;

          console.log(`   ✅ SUCESSO!`);
          console.log(`      Vouchers: ${total}`);
          console.log(`      Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

          if (config.usaBelle) {
            console.log(`      Automático: ${data.validacaoAutomatica || 0}`);
            console.log(`      Manual: ${data.validacaoManual || 0}`);
          }
        } else {
          console.log(`   ❌ Erro:`, data.error);
        }

      } catch (err) {
        console.log(`   ❌ Erro:`, err.message);
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`\n📊 RESUMO:`);
    console.log(`   Total: ${totalGeral} vouchers`);
    console.log(`   Valor: R$ ${valorGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`\n🌐 Acesse:`);
    console.log(`   http://localhost:3000/dashboard/shopping-metropole/vouchers\n`);

    console.log('💡 Os cookies foram salvos.');
    console.log('   Próximas execuções serão automáticas!\n');

    // Mantém navegador aberto por 5 segundos para você ver o resultado
    console.log('Fechando navegador em 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

syncWithCookies().catch(console.error);
