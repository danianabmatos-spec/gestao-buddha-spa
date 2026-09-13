// ✅ Script FINAL para sincronizar JUNHO 2026
// Cole no console do Chrome (F12 > Console) logado no WordPress

(async () => {
  const API_URL = 'http://localhost:3000/api/vouchers/sync';
  const AFFILIATION = '894555';

  const periodos = [
    { tipo: 'site', ini: '2026-06-01', fim: '2026-06-30', filtro: 'used' },
    { tipo: 'omnichannel', ini: '2026-06-01', fim: '2026-06-30', filtro: 'sell' },
    { tipo: 'cortesia', ini: '2026-06-01', fim: '2026-06-30', filtro: 'used' }
  ];

  console.log('🚀 Sincronizando JUNHO 2026...\n');

  for (const p of periodos) {
    console.log(`📅 Processando ${p.tipo.toUpperCase()}...`);

    // Monta URL
    let url;
    if (p.filtro === 'sell') {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${p.ini}&date_sell_end=${p.fim}&date_used_start=&date_used_end=&affilliation_id=${AFFILIATION}`;
    } else {
      url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${p.ini}&date_used_end=${p.fim}&affilliation_id=${AFFILIATION}`;
    }

    // Busca HTML
    const resp = await fetch(url, { credentials: 'include' });
    const html = await resp.text();

    console.log(`  ✓ HTML recebido: ${(html.length / 1024).toFixed(1)} KB`);

    // Envia para API (parser corrigido)
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

    if (data.ok) {
      const total = p.tipo === 'cortesia' ? data.totalValor : data.totalReembolso;
      console.log(`  ✅ ${data.totalValidados || 0} vouchers | R$ ${total || 0}`);
    } else {
      console.log(`  ❌ Erro:`, data.error);
    }
    console.log('');
  }

  console.log('✅ JUNHO 2026 SINCRONIZADO!\n');
  console.log('Acesse: http://localhost:3000/vouchers');
  console.log('Atualize a página (Ctrl+F5) para ver os dados');
})();
