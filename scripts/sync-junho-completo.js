// ========================================
// SINCRONIZAÇÃO JUNHO COMPLETO - Shopping Metrópole
// ========================================
//
// INSTRUÇÕES:
// 1. Abra o WordPress: https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers
// 2. Faça login se necessário
// 3. Abra o Console do Chrome (F12 → Console)
// 4. Cole este script completo e pressione Enter
//
// O script vai sincronizar TODO o mês de junho (01/06 a 30/06)
// ========================================

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 SINCRONIZANDO JUNHO COMPLETO - Shopping Metrópole');
  console.log('═══════════════════════════════════════════════════════\n');

  const API_URL = 'http://localhost:3000/api/vouchers/sync';
  const AFFILIATION = '894555'; // Shopping Metrópole
  const dataIni = '2026-06-01';
  const dataFim = '2026-06-30'; // MÊS COMPLETO

  // Belle (para validação automática)
  const BELLE_CREDENCIAIS = {
    email: 'adm.shoppingmetropole@buddhaspa.com.br',
    senha: 'Metr@1056',
    estabelecimento: 1
  };

  const tipos = [
    { nome: 'SITE (E-commerce)', tipo: 'site', usaBelle: true },
    { nome: 'OMNICHANNEL', tipo: 'omnichannel', usaBelle: true },
    { nome: 'CORTESIA', tipo: 'cortesia', usaBelle: false }
  ];

  let totalGeral = 0;
  let valorGeral = 0;

  for (const config of tipos) {
    console.log(`\n📦 Processando: ${config.nome}`);
    console.log('─'.repeat(50));

    // Monta URL WordPress
    let url;
    if (config.tipo === 'omnichannel') {
      // Omnichannel: filtro por data de venda + flag omnichannel
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=${AFFILIATION}`;
    } else if (config.tipo === 'cortesia') {
      // Cortesia: mesma URL do site, mas filtra por valorReembolso=0 no backend
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;
    } else {
      // Site: filtro por data de utilização
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;
    }

    try {
      // Busca HTML do WordPress
      console.log('   Buscando dados do WordPress...');
      const resp = await fetch(url, { credentials: 'include' });

      if (!resp.ok) {
        console.log(`   ❌ Erro HTTP ${resp.status} - Verifique se está logado`);
        continue;
      }

      const html = await resp.text();
      console.log(`   ✓ HTML baixado: ${(html.length / 1024).toFixed(1)} KB`);

      // Verifica se está logado (procura por "wp-admin" no HTML)
      if (!html.includes('wp-admin') && !html.includes('vouchers')) {
        console.log('   ❌ Você não está logado no WordPress!');
        console.log('   👉 Faça login e execute o script novamente');
        return;
      }

      // Envia para API
      console.log('   Enviando para API local...');

      const payload = {
        dataIni,
        dataFim,
        html,
        tipo: config.tipo
      };

      // Adiciona credenciais Belle se necessário
      if (config.usaBelle) {
        payload.belleCredenciais = BELLE_CREDENCIAIS;
      }

      const result = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await result.json();

      if (data.ok) {
        const total = data.totalValidados || 0;
        const valor = data.totalReembolso || data.totalValor || 0;

        totalGeral += total;
        valorGeral += valor;

        console.log(`   ✅ SUCESSO!`);
        console.log(`      Total de vouchers: ${total}`);
        console.log(`      Valor total: R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

        if (config.usaBelle) {
          console.log(`      Validação Automática: ${data.validacaoAutomatica || 0}`);
          console.log(`      Validação Manual: ${data.validacaoManual || 0}`);
        }
      } else {
        console.log(`   ❌ Erro na API:`, data.error);
      }

    } catch (err) {
      console.log(`   ❌ Erro ao processar:`, err.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ SINCRONIZAÇÃO CONCLUÍDA!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📊 RESUMO GERAL:`);
  console.log(`   Total de vouchers: ${totalGeral}`);
  console.log(`   Valor total: R$ ${valorGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`\n🌐 Acesse a tabela:`);
  console.log(`   http://localhost:3000/dashboard/shopping-metropole/vouchers`);
  console.log(`\n💡 Atualize a página com Ctrl+F5\n`);

})();
