// Testa a validação corrigida (Manual vs Automático)
// Execute no Console do Chrome após login no WordPress

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

  console.log('🧪 TESTE DE VALIDAÇÃO CORRIGIDA\n');
  console.log('Período:', dataIni, 'a', dataFim);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Busca HTML WordPress (SITE)
  const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

  console.log('📥 Buscando vouchers do WordPress...');
  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();
  console.log(`   ✓ HTML recebido: ${(html.length / 1024).toFixed(1)} KB\n`);

  // Envia para API com validação Belle
  console.log('🔄 Enviando para API com validação Belle...');
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

  if (!data.ok) {
    console.error('❌ Erro:', data.error);
    return;
  }

  console.log('   ✓ Processamento concluído\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 ESTATÍSTICAS:\n');
  console.log(`   Total de vouchers: ${data.totalValidados || 0}`);
  console.log(`   Reembolso total: R$ ${data.totalReembolso || 0}`);
  console.log(`   Validação Automática: ${data.validacaoAutomatica || 0}`);
  console.log(`   Validação Manual: ${data.validacaoManual || 0}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Busca cache para ver detalhes
  console.log('🔍 DETALHES DOS VOUCHERS:\n');

  const cacheResp = await fetch('http://localhost:3000/cache/vouchers-site.json');
  const cache = await cacheResp.json();
  const vouchers = cache['2026-06-01_2026-06-06']?.vouchers || [];

  // Agrupa por forma de validação
  const automaticos = vouchers.filter(v => v.formaValidacao === 'Automatico');
  const manuais = vouchers.filter(v => v.formaValidacao === 'Manualmente');

  console.log(`📌 VALIDAÇÃO MANUAL (${manuais.length}):`);
  if (manuais.length > 0) {
    manuais.forEach(v => {
      console.log(`   ${v.codigo} | ${v.dataTerapia} | ${v.produto} | R$ ${v.valorReembolso}`);
    });
  } else {
    console.log('   (nenhum)');
  }

  console.log(`\n📌 VALIDAÇÃO AUTOMÁTICA (${automaticos.length}):`);
  if (automaticos.length > 0) {
    automaticos.forEach(v => {
      console.log(`   ${v.codigo} | ${v.dataTerapia} | ${v.produto} | R$ ${v.valorReembolso}`);
    });
  } else {
    console.log('   (nenhum)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TESTE CONCLUÍDO!\n');
  console.log('Comparação esperada:');
  console.log('  Navvii: 8 automáticos, 24 manuais');
  console.log(`  Atual:  ${automaticos.length} automáticos, ${manuais.length} manuais`);

  if (automaticos.length === 8 && manuais.length === 24) {
    console.log('\n🎉 PERFEITO! Validação está igual ao Navvii!');
  } else {
    console.log('\n⚠️  Ainda há diferenças. Verifique os códigos acima.');
  }
})();
