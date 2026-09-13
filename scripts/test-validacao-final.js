// Teste final da validação com Belle (Relatório de Uso)

(async () => {
  const API_URL = 'http://localhost:3000/api/vouchers/sync';
  const AFFILIATION = '894555';
  const BELLE_CREDENCIAIS = {
    email: 'adm.shoppingmetropole@buddhaspa.com.br',
    senha: 'Metr@1056',
    estabelecimento: 1
  };

  const dataIni = '2026-06-01';
  const dataFim = '2026-06-06';

  console.log('🎯 TESTE FINAL - VALIDAÇÃO COM BELLE\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Busca HTML do WordPress
  console.log('📥 1. Buscando vouchers do WordPress...');
  const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();
  console.log(`   ✓ HTML recebido: ${(html.length / 1024).toFixed(1)} KB\n`);

  // 2. Envia para API com validação Belle
  console.log('🔄 2. Processando com validação Belle...');
  const result = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataIni,
      dataFim,
      html,
      tipo: 'site',
      belleCredenciais: BELLE_CREDENCIAIS
    })
  });

  const data = await result.json();
  console.log('   ✓ Processamento concluído\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 RESULTADO:\n');
  console.log(`   Total de vouchers: ${data.totalValidados || 0}`);
  console.log(`   Reembolso total: R$ ${data.totalReembolso || 0}`);
  console.log(`   Validação Automática: ${data.validacaoAutomatica || 0}`);
  console.log(`   Validação Manual: ${data.validacaoManual || 0}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🎯 ESPERADO (Navvii):');
  console.log('   Automáticos: 8');
  console.log('   Manuais: 24');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (data.validacaoAutomatica === 8 && data.validacaoManual === 24) {
    console.log('🎉 PERFEITO! Validação igual ao Navvii!');
  } else {
    console.log('⚠️  Ainda há diferenças. Verificando...');

    // Mostra quais são os automáticos e manuais
    const cacheResp = await fetch('http://localhost:3000/cache/vouchers-site.json');
    if (cacheResp.ok) {
      const cache = await cacheResp.json();
      const vouchers = cache['2026-06-01_2026-06-06']?.vouchers || [];

      const automaticos = vouchers.filter(v => v.formaValidacao === 'Automatico');
      const manuais = vouchers.filter(v => v.formaValidacao === 'Manualmente');

      console.log(`\n📌 Automáticos (${automaticos.length}):`);
      automaticos.forEach(v => console.log(`   ${v.codigo}`));

      console.log(`\n📌 Manuais (${manuais.length}):`);
      manuais.forEach(v => console.log(`   ${v.codigo}`));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TESTE CONCLUÍDO!\n');
})();
