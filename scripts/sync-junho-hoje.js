// Sincroniza JUNHO até HOJE (01 a 06)
// Cole no console do Chrome

(async () => {
  const API_URL = 'http://localhost:3000/api/vouchers/sync';
  const AFFILIATION = '894555';

  // De 01/06 até HOJE (06/06)
  const dataIni = '2026-06-01';
  const dataFim = '2026-06-06';

  const periodos = [
    { tipo: 'site', filtro: 'used' },
    { tipo: 'omnichannel', filtro: 'sell' },
    { tipo: 'cortesia', filtro: 'used' }
  ];

  console.log(`🚀 Sincronizando JUNHO (${dataIni} a ${dataFim})...\n`);

  for (const p of periodos) {
    console.log(`📅 Processando ${p.tipo.toUpperCase()}...`);

    // Monta URL
    let url;
    if (p.filtro === 'sell') {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&affilliation_id=${AFFILIATION}`;
    } else {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;
    }

    // Busca HTML
    const resp = await fetch(url, { credentials: 'include' });
    const html = await resp.text();

    console.log(`  ✓ HTML recebido: ${(html.length / 1024).toFixed(1)} KB`);

    // Envia para API
    const result = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataIni,
        dataFim,
        html,
        tipo: p.tipo
      })
    });

    const data = await result.json();

    if (data.ok) {
      const total = p.tipo === 'cortesia' ? data.totalValor : data.totalReembolso;
      console.log(`  ✅ ${data.totalValidados || 0} vouchers | R$ ${total || 0}`);
    } else {
      console.log(`  ❌ Erro:`, data.error);
    }
    console.log('');
  }

  console.log('✅ JUNHO SINCRONIZADO!\n');
  console.log('Acesse: http://localhost:3000/vouchers');
  console.log('Atualize com Ctrl+F5');
})();
