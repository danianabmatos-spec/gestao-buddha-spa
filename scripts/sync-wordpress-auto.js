#!/usr/bin/env node

/**
 * Sincronização Automática WordPress → Sistema
 * Usa Puppeteer para fazer login e sincronizar vouchers de junho
 */

const puppeteer = require('puppeteer');

// Configurações
const WORDPRESS_URL = 'https://buddhaspa.com.br/wp-admin';
const WORDPRESS_USER = 'adm.shoppingmetropole@buddhaspa.com.br';
const WORDPRESS_PASS = 'Metro@1056';
const AFFILIATION = '894555'; // Shopping Metrópole
const API_URL = 'http://localhost:3000/api/vouchers/sync';

const BELLE_CREDENCIAIS = {
  email: 'adm.shoppingmetropole@buddhaspa.com.br',
  senha: 'Metr@1056',
  estabelecimento: 1
};

const dataIni = '2026-06-01';
const dataFim = '2026-06-30';

async function syncWordPress() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🤖 SINCRONIZAÇÃO AUTOMÁTICA - WordPress → Sistema');
  console.log('═══════════════════════════════════════════════════════\n');

  let browser;

  try {
    // Inicia Puppeteer
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: true, // true = sem interface gráfica
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 1. Login no WordPress
    console.log('🔐 Fazendo login no WordPress...');
    await page.goto(WORDPRESS_URL + '/wp-login.php', { waitUntil: 'networkidle2', timeout: 60000 });

    // Aguarda um pouco para página carregar completamente
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verifica se já está logado (redirecionou para dashboard)
    const currentUrl = page.url();
    console.log(`   URL atual: ${currentUrl}`);

    if (currentUrl.includes('wp-admin') && !currentUrl.includes('wp-login')) {
      console.log('✅ Já está logado!\n');
    } else {
      // Precisa fazer login
      console.log('   Preenchendo formulário de login...');

      // Tenta diferentes seletores (WordPress pode variar)
      const loginSelector = await page.$('#user_login') || await page.$('input[name="log"]');
      const passSelector = await page.$('#user_pass') || await page.$('input[name="pwd"]');

      if (!loginSelector || !passSelector) {
        // Salva screenshot para debug
        await page.screenshot({ path: 'login-debug.png' });
        throw new Error('Formulário de login não encontrado. Screenshot salvo em login-debug.png');
      }

      await page.type('#user_login', WORDPRESS_USER);
      await page.type('#user_pass', WORDPRESS_PASS);

      // Clica em entrar
      await Promise.all([
        page.click('#wp-submit'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
      ]);

      console.log('✅ Login realizado com sucesso!\n');
    }

    // 2. Sincroniza cada tipo de voucher
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
        // Acessa página de vouchers
        console.log('   Carregando página...');
        await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Aguarda a tabela carregar
        await page.waitForSelector('table', { timeout: 10000 });

        // Extrai HTML da página
        const html = await page.content();
        console.log(`   ✓ HTML extraído: ${(html.length / 1024).toFixed(1)} KB`);

        // Envia para API
        console.log('   Enviando para API local...');

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
          console.log(`   ❌ Erro na API:`, data.error);
        }

      } catch (err) {
        console.log(`   ❌ Erro ao processar:`, err.message);
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`\n📊 RESUMO GERAL:`);
    console.log(`   Total de vouchers: ${totalGeral}`);
    console.log(`   Valor total: R$ ${valorGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`\n🌐 Acesse:`);
    console.log(`   http://localhost:3000/dashboard/shopping-metropole/vouchers\n`);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('\nDetalhes:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executa
syncWordPress().catch(console.error);
