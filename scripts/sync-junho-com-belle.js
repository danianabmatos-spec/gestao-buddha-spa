// Sincroniza JUNHO com validação automática via Belle
// Cole no console do Chrome

(async () => {
  const API_URL = 'http://localhost:3000/api/vouchers/sync';

  // WordPress
  const AFFILIATION = '894555';

  // Belle (Shopping Metrópole)
  const BELLE_CREDENCIAIS = {
    email: 'adm.shoppingmetropole@buddhaspa.com.br',
    senha: 'Metr@1056',
    estabelecimento: 1 // ✅ Confirmado
  };

  // Período
  const dataIni = '2026-06-01';
  const dataFim = '2026-06-06';

  const periodos = [
    { tipo: 'site' },
    { tipo: 'omnichannel' }
    // Cortesia não precisa validação Belle (não tem reembolso)
  ];

  console.log(`🚀 Sincronizando JUNHO com validação Belle...\n`);

  for (const p of periodos) {
    console.log(`📅 Processando ${p.tipo.toUpperCase()}...`);

    // Monta URL WordPress
    let url;
    if (p.tipo === 'omnichannel') {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=${AFFILIATION}`;
    } else {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;
    }

    // Busca HTML WordPress
    const resp = await fetch(url, { credentials: 'include' });
    const html = await resp.text();

    console.log(`  ✓ WordPress: ${(html.length / 1024).toFixed(1)} KB`);

    // Envia para API com credenciais Belle
    const result = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataIni,
        dataFim,
        html,
        tipo: p.tipo,
        belleCredenciais: BELLE_CREDENCIAIS
      })
    });

    const data = await result.json();

    if (data.ok) {
      console.log(`  ✅ ${data.totalValidados || 0} vouchers | R$ ${data.totalReembolso || 0}`);
      console.log(`     Automáticos: ${data.validacaoAutomatica || 0} | Manuais: ${data.validacaoManual || 0}`);
    } else {
      console.log(`  ❌ Erro:`, data.error);
    }
    console.log('');
  }

  // Cortesias separadamente (sem Belle)
  console.log(`📅 Processando CORTESIA...`);

  const urlCortesia = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

  const respCortesia = await fetch(urlCortesia, { credentials: 'include' });
  const htmlCortesia = await respCortesia.text();

  const resultCortesia = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataIni,
      dataFim,
      html: htmlCortesia,
      tipo: 'cortesia'
    })
  });

  const dataCortesia = await resultCortesia.json();

  if (dataCortesia.ok) {
    console.log(`  ✅ ${dataCortesia.totalValidados || 0} vouchers | R$ ${dataCortesia.totalValor || 0}`);
  }

  console.log('\n✅ JUNHO SINCRONIZADO COM VALIDAÇÃO BELLE!\n');
  console.log('Acesse: http://localhost:3000/vouchers');
  console.log('Atualize com Ctrl+F5');
  console.log('\n📊 Agora você verá:');
  console.log('  • Validação Automática: cruzado com Belle');
  console.log('  • Validação Manual: feito pela recepcionista');
})();
