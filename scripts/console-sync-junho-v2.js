// Script ATUALIZADO para junho (01 a 05)
// Cole no console do Chrome enquanto estiver logado no WordPress

(async () => {
  const API_URL = 'http://localhost:3000/api/vouchers/sync';
  const AFFILIATION = '894555';

  // JUNHO 01 a 05 (como você pediu antes)
  const periodos = [
    { tipo: 'site', ini: '2026-06-01', fim: '2026-06-05', filtro: 'used' },
    { tipo: 'omnichannel', ini: '2026-06-01', fim: '2026-06-05', filtro: 'sell' },
    { tipo: 'cortesia', ini: '2026-06-01', fim: '2026-06-05', filtro: 'used' }
  ];

  console.log('🚀 Iniciando sincronização de JUNHO (01-05)...\n');

  for (const p of periodos) {
    console.log(`📅 Buscando ${p.tipo}...`);

    // Monta URL
    let url;
    if (p.filtro === 'sell') {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${p.ini}&date_sell_end=${p.fim}&date_used_start=&date_used_end=&affilliation_id=${AFFILIATION}`;
    } else {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${p.ini}&date_used_end=${p.fim}&affilliation_id=${AFFILIATION}`;
    }

    console.log(`  URL: ${url}`);

    // Busca HTML
    const resp = await fetch(url, { credentials: 'include' });
    const html = await resp.text();

    console.log(`  HTML recebido: ${html.length} bytes`);

    // Envia para API
    const result = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataIni: p.ini,
        dataFim: p.fim,
        html,
        tipo: p.tipo
      })
    });

    const data = await result.json();

    console.log(`  Resposta API:`, data);
    console.log(`✅ ${p.tipo}: ${data.totalValidados || 0} vouchers | R$ ${data.totalReembolso || data.totalValor || 0}`);
    console.log('');
  }

  console.log('✅ JUNHO (01-05) sincronizado!');
  console.log('Acesse: http://localhost:3000/vouchers');
})();
