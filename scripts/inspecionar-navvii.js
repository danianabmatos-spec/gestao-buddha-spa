#!/usr/bin/env node

/**
 * Inspeciona o Navvii para entender a lógica de filtragem
 */

const puppeteer = require('puppeteer');

const NAVVII_URL = 'https://app.navvii.com.br/validacao-voucher-wordpress';
const NAVVII_CREDENCIAIS = {
  email: 'adm@buddhaspa-shoppingmetropole.com.br',
  senha: 'Buddha'
};

async function inspecionarNavvii() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 INSPECIONANDO NAVVII - Como ele filtra vouchers?');
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

    // Login no Navvii
    console.log('🔐 Acessando Navvii...');
    await page.goto(NAVVII_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tira screenshot para debug
    await page.screenshot({ path: 'navvii-inicial.png', fullPage: true });
    console.log('   📸 Screenshot salvo: navvii-inicial.png');

    // Extrai todos os inputs disponíveis
    const inputsDisponiveis = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className
      }));
    });

    console.log('\n   Inputs disponíveis na página:');
    console.log(JSON.stringify(inputsDisponiveis, null, 2));

    const currentUrl = page.url();
    console.log(`\n   URL atual: ${currentUrl}`);

    // Verifica se precisa fazer login
    if (currentUrl.includes('login') || inputsDisponiveis.some(i => i.type === 'email' || i.type === 'password')) {
      console.log('\n   📝 Fazendo login...');

      try {
        // Tenta encontrar campos de login de várias formas
        // Navvii usa Quasar com IDs dinâmicos
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

        // Fallback para seletores tradicionais
        if (!emailField) {
          emailField = await page.$('input[type="email"]') ||
                      await page.$('input[name="email"]') ||
                      await page.$('input[id*="email"]');
        }

        if (!passwordField) {
          passwordField = await page.$('input[type="password"]') ||
                         await page.$('input[name="password"]');
        }

        if (emailField && passwordField) {
          console.log('   ✓ Campos encontrados, preenchendo...');
          await emailField.click();
          await emailField.type(NAVVII_CREDENCIAIS.email, { delay: 50 });

          await passwordField.click();
          await passwordField.type(NAVVII_CREDENCIAIS.senha, { delay: 50 });

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Procura botão ENTRAR
          const buttons = await page.$$('button');
          let submitButton = null;

          for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent);
            if (text && text.trim().toUpperCase().includes('ENTRAR')) {
              submitButton = button;
              break;
            }
          }

          if (!submitButton) {
            submitButton = await page.$('button[type="submit"]') || await page.$('button');
          }

          if (submitButton) {
            console.log('   ✓ Botão ENTRAR encontrado, clicando...');

            await submitButton.click();

            // Aguarda navegação ou mudança de URL
            await new Promise(resolve => setTimeout(resolve, 5000));

            const urlAposLogin = page.url();
            console.log(`   ✓ URL após login: ${urlAposLogin}`);

            if (urlAposLogin !== currentUrl && !urlAposLogin.includes('login')) {
              console.log('   ✅ Login bem-sucedido!');
              await page.screenshot({ path: 'navvii-pos-login.png', fullPage: true });
              console.log('   📸 Screenshot pós-login salvo: navvii-pos-login.png');
            } else {
              console.log('   ⚠️  Credenciais inválidas!');
              console.log('   💡 O navegador ficará aberto - faça login manualmente');
              console.log('   ⏳ Aguardando login manual (60 segundos)...\n');
              await page.screenshot({ path: 'navvii-erro-login.png', fullPage: true });

              // Aguarda login manual ou mudança de URL
              const startTime = Date.now();
              while (Date.now() - startTime < 60000) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const currentUrlCheck = page.url();
                if (!currentUrlCheck.includes('login')) {
                  console.log('   ✅ Login manual detectado!');
                  await page.screenshot({ path: 'navvii-pos-login-manual.png', fullPage: true });
                  break;
                }
              }
            }
          }
        } else {
          console.log('   ⚠️  Campos de login não encontrados');
          console.log('   💡 O navegador ficará aberto - faça login manualmente');
          await new Promise(resolve => setTimeout(resolve, 60000)); // 60 segundos para login manual
        }
      } catch (err) {
        console.log('   ⚠️  Erro no login:', err.message);
        console.log('   💡 O navegador ficará aberto - faça login manualmente');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } else {
      console.log('   ✅ Já está logado ou não precisa de login!');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Navega para a página de Validação Vouchers Wordpress
    console.log('\n📄 Navegando para Validação Vouchers Wordpress...');

    try {
      // Tenta clicar no menu lateral
      const menuClicado = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Validação Vouchers') || text.includes('Validação') && text.includes('Wordpress')) {
            if (el.tagName === 'A' || el.tagName === 'DIV' || el.onclick || el.getAttribute('href')) {
              el.click();
              return true;
            }
          }
        }
        return false;
      });

      if (menuClicado) {
        console.log('   ✓ Clicou no menu Validação Vouchers Wordpress');
      } else {
        console.log('   ⚠️  Menu não encontrado via click, tentando URL direta...');
      }

      // Aguarda navegação
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Se ainda não estiver na página certa, tenta URL direta
      const currentUrl = page.url();
      if (!currentUrl.includes('validacao-voucher')) {
        console.log('   → Navegando via URL direta...');
        await page.goto('https://app.navvii.com.br/validacao-voucher-wordpress', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      await page.screenshot({ path: 'navvii-validacao-vouchers.png', fullPage: true });
      console.log('   📸 Screenshot da página de vouchers salvo');

    } catch (err) {
      console.log('   ⚠️  Erro ao navegar:', err.message);
    }

    // Aguarda a página carregar
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Procura pela unidade Shopping Metrópole
    console.log('\n🏢 Verificando unidade...');

    // Tenta encontrar e clicar no seletor de unidade
    try {
      // Aguarda o seletor de unidade aparecer
      await page.waitForSelector('select, .select, [role="combobox"]', { timeout: 5000 });

      // Tenta encontrar Shopping Metrópole nas opções
      const metropoleOption = await page.evaluate(() => {
        const selects = document.querySelectorAll('select option, [role="option"]');
        for (const option of selects) {
          if (option.textContent.toLowerCase().includes('metropole') ||
              option.textContent.toLowerCase().includes('metrópole')) {
            return option.value || option.textContent;
          }
        }
        return null;
      });

      if (metropoleOption) {
        console.log('   ✓ Unidade encontrada!');
      } else {
        console.log('   ⚠️  Unidade não encontrada automaticamente');
      }
    } catch (err) {
      console.log('   ⚠️  Seletor de unidade não encontrado:', err.message);
    }

    // Procura pelo filtro de data e tipo
    console.log('\n📅 Configurando filtros (Junho 2026, E-commerce)...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Tenta identificar os filtros presentes
    const filtrosInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select'));
      return inputs.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        value: input.value
      })).filter(info => info.name || info.id || info.placeholder);
    });

    console.log('\n📋 Filtros encontrados na página:');
    console.log(JSON.stringify(filtrosInfo, null, 2));

    // Aguarda processamento e intercepta requisições
    console.log('\n📡 Interceptando requisições de API...');

    const requests = [];
    page.on('request', request => {
      if (request.url().includes('api') || request.url().includes('voucher')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    const responses = [];
    page.on('response', async response => {
      if (response.url().includes('api') || response.url().includes('voucher')) {
        try {
          const json = await response.json();
          responses.push({
            url: response.url(),
            status: response.status(),
            data: json
          });
        } catch (e) {
          // Não é JSON
        }
      }
    });

    // Aguarda carregar dados
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tenta extrair informações da tabela visível
    console.log('\n📊 Extraindo dados da tabela...');

    const dadosTabela = await page.evaluate(() => {
      const tabela = document.querySelector('table');
      if (!tabela) return null;

      const headers = Array.from(tabela.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim());
      const rows = Array.from(tabela.querySelectorAll('tbody tr'));

      const dados = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const rowData = {};
        cells.forEach((cell, i) => {
          rowData[headers[i] || `col${i}`] = cell.textContent.trim();
        });
        return rowData;
      });

      // Procura totalizadores
      const totais = Array.from(document.querySelectorAll('.total, .sum, [class*="total"], [class*="sum"]')).map(el => ({
        text: el.textContent.trim(),
        class: el.className
      }));

      return {
        headers,
        totalVouchers: dados.length,
        vouchers: dados.slice(0, 10), // Primeiros 10 para análise
        totais
      };
    });

    if (dadosTabela) {
      console.log('\n✅ DADOS EXTRAÍDOS:');
      console.log(`   Total de vouchers: ${dadosTabela.totalVouchers}`);
      console.log(`   Colunas: ${dadosTabela.headers.join(', ')}`);
      console.log('\n   Primeiros vouchers:');
      dadosTabela.vouchers.forEach((v, i) => {
        console.log(`   ${i + 1}. ${JSON.stringify(v)}`);
      });

      if (dadosTabela.totais.length > 0) {
        console.log('\n   Totalizadores:');
        dadosTabela.totais.forEach(t => console.log(`   - ${t.text}`));
      }

      // Verifica se o código problemático está presente
      const codigoProblematico = '1511779504827395048280';
      const temCodigoProblematico = await page.evaluate((codigo) => {
        return document.body.textContent.includes(codigo);
      }, codigoProblematico);

      console.log(`\n   ⚠️  Código ${codigoProblematico} está presente? ${temCodigoProblematico ? 'SIM' : 'NÃO'}`);
    }

    // Mostra requisições capturadas
    if (requests.length > 0) {
      console.log('\n📡 Requisições capturadas:');
      requests.forEach((req, i) => {
        console.log(`\n   ${i + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`      Payload: ${req.postData.substring(0, 200)}`);
        }
      });
    }

    if (responses.length > 0) {
      console.log('\n📦 Respostas capturadas:');
      responses.forEach((res, i) => {
        console.log(`\n   ${i + 1}. ${res.url} (${res.status})`);
        console.log(`      Data: ${JSON.stringify(res.data).substring(0, 200)}`);
      });
    }

    console.log('\n\n💡 Navegador permanecerá aberto por 30 segundos para inspeção manual...');
    console.log('   Use este tempo para verificar filtros, valores e tabela.');
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

inspecionarNavvii().catch(console.error);
