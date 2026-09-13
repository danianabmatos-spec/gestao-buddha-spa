#!/usr/bin/env node

/**
 * Inspeciona o backend do Navvii para descobrir como ele busca dados do Belle
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const NAVVII_URL = 'https://app.navvii.com.br/validacao-voucher-wordpress';
const NAVVII_CREDENCIAIS = {
  email: 'adm@buddhaspa-shoppingmetropole.com.br',
  senha: 'Buddha'
};

async function inspecionarBackend() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 INSPECIONANDO BACKEND DO NAVVII');
  console.log('═══════════════════════════════════════════════════════\n');

  let browser;

  try {
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--start-maximized'],
      defaultViewport: null
    });

    const page = await browser.newPage();

    // Arrays para capturar requisições
    const allRequests = [];
    const belleRequests = [];
    const apiResponses = [];

    // Intercepta TODAS as requisições
    page.on('request', request => {
      const url = request.url();
      const method = request.method();

      const requestData = {
        url,
        method,
        headers: request.headers(),
        postData: request.postData(),
        resourceType: request.resourceType()
      };

      allRequests.push(requestData);

      // Detecta requisições para Belle
      if (url.includes('belle') ||
          url.includes('api') ||
          url.includes('voucher') ||
          url.includes('relatorio') ||
          method === 'POST') {
        console.log(`\n📡 REQUEST: ${method} ${url}`);
        if (request.postData()) {
          console.log(`   Payload: ${request.postData().substring(0, 200)}...`);
        }
        belleRequests.push(requestData);
      }
    });

    // Intercepta TODAS as respostas
    page.on('response', async response => {
      const url = response.url();
      const status = response.status();

      // Captura respostas de API
      if (url.includes('api') ||
          url.includes('belle') ||
          url.includes('voucher') ||
          url.includes('relatorio')) {

        console.log(`\n📦 RESPONSE: ${status} ${url}`);

        try {
          const contentType = response.headers()['content-type'] || '';
          let responseData = null;

          if (contentType.includes('application/json')) {
            responseData = await response.json();
            console.log(`   JSON (${JSON.stringify(responseData).length} bytes):`);
            console.log(`   ${JSON.stringify(responseData).substring(0, 500)}...`);
          } else if (contentType.includes('text')) {
            const text = await response.text();
            console.log(`   Text (${text.length} chars)`);
          }

          apiResponses.push({
            url,
            status,
            headers: response.headers(),
            data: responseData
          });

        } catch (e) {
          console.log(`   ⚠️  Não foi possível ler resposta: ${e.message}`);
        }
      }
    });

    // Login no Navvii
    console.log('\n🔐 Fazendo login no Navvii...');
    await page.goto(NAVVII_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Faz login
    const allInputs = await page.$$('input');
    let emailField = null;
    let passwordField = null;

    for (const input of allInputs) {
      const type = await input.evaluate(el => el.type);
      if (type === 'text' && !emailField) {
        emailField = input;
      } else if (type === 'password' && !passwordField) {
        passwordField = input;
      }
    }

    if (emailField && passwordField) {
      await emailField.type(NAVVII_CREDENCIAIS.email, { delay: 50 });
      await passwordField.type(NAVVII_CREDENCIAIS.senha, { delay: 50 });

      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent);
        if (text && text.trim().toUpperCase().includes('ENTRAR')) {
          await button.click();
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('✅ Login realizado!\n');
    }

    // Navega para Validação Vouchers Wordpress
    console.log('📄 Navegando para Validação Vouchers Wordpress...');

    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.includes('Validação Vouchers') || (text.includes('Validação') && text.includes('Wordpress'))) {
          if (el.tagName === 'A' || el.tagName === 'DIV' || el.onclick || el.getAttribute('href')) {
            el.click();
            return true;
          }
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tenta URL direta se não funcionou
    const currentUrl = page.url();
    if (!currentUrl.includes('validacao-voucher')) {
      await page.goto('https://app.navvii.com.br/validacao-voucher-wordpress', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }

    console.log('✅ Página de vouchers carregada!\n');

    // Aguarda carregar dados (mais requisições devem aparecer)
    console.log('⏳ Aguardando requisições de API (15 segundos)...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Faz scroll para forçar carregar mais dados
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Salva resultados em arquivo
    const resultado = {
      timestamp: new Date().toISOString(),
      totalRequests: allRequests.length,
      belleRequests: belleRequests.length,
      apiResponses: apiResponses.length,
      requests: belleRequests,
      responses: apiResponses
    };

    fs.writeFileSync('navvii-backend-inspection.json', JSON.stringify(resultado, null, 2));
    console.log('\n💾 Dados salvos em: navvii-backend-inspection.json');

    // Mostra resumo
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMO DA INSPEÇÃO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total de requisições: ${allRequests.length}`);
    console.log(`Requisições Belle/API: ${belleRequests.length}`);
    console.log(`Respostas capturadas: ${apiResponses.length}\n`);

    if (belleRequests.length > 0) {
      console.log('🔍 REQUISIÇÕES BELLE/API DETECTADAS:\n');
      belleRequests.forEach((req, i) => {
        console.log(`${i + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`   Payload: ${req.postData.substring(0, 150)}...`);
        }
      });
    }

    console.log('\n💡 Navegador permanecerá aberto por 30 segundos...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

inspecionarBackend().catch(console.error);
