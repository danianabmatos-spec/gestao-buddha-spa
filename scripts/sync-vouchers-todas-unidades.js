// Sincroniza vouchers de TODAS as 7 unidades — cole no Console Chrome
// Esteja logada em buddhaspa.com.br/wp-admin com qualquer conta admin antes de rodar

(async () => {
  const API_URL = 'https://gestao.solcentral.com.br/api/vouchers/sync';

  // Datas: do dia 1 até hoje (mês corrente)
  const hoje = new Date();
  const dataIni = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}-01`;
  const dataFim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  const UNIDADES = [
    { nome: 'Metropole',          affiliation: '894555' },
    { nome: 'Analia Franco',      affiliation: '206' },
    { nome: 'Shop. Analia',       affiliation: '591248' },
    { nome: 'Perdizes',           affiliation: '753' },
    { nome: 'Tatuape',            affiliation: '857895' },
    { nome: 'Mooca',              affiliation: '299557' },
    { nome: 'Higienopolis',       affiliation: '708' },
  ];

  const TIPOS = ['site', 'omnichannel', 'cortesia'];

  console.log(`\n🚀 Sincronizando vouchers ${dataIni} → ${dataFim}\n`);
  console.log('─'.repeat(50));

  let totalGeral = 0;
  let totalVouchers = 0;

  for (const unidade of UNIDADES) {
    console.log(`\n📍 ${unidade.nome}`);

    for (const tipo of TIPOS) {
      let wpUrl;
      if (tipo === 'omnichannel') {
        wpUrl = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=${unidade.affiliation}`;
      } else {
        wpUrl = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${unidade.affiliation}`;
      }

      try {
        const wpResp = await fetch(wpUrl, { credentials: 'include' });
        if (!wpResp.ok) { console.log(`  ⚠️  ${tipo}: HTTP ${wpResp.status}`); continue; }
        const html = await wpResp.text();

        const apiResp = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataIni, dataFim, html, tipo, unidade: unidade.affiliation }),
        });
        const data = await apiResp.json();

        if (data.ok) {
          const valor = tipo === 'cortesia' ? (data.totalValor || 0) : (data.totalReembolso || 0);
          const qtd   = data.totalValidados || 0;
          if (qtd > 0) {
            console.log(`  ✅ ${tipo.padEnd(12)} ${String(qtd).padStart(3)} vouchers  R$ ${valor}`);
            totalGeral   += valor;
            totalVouchers += qtd;
          } else {
            console.log(`  ·  ${tipo.padEnd(12)} 0 vouchers`);
          }
        } else {
          console.log(`  ❌ ${tipo}: ${data.error}`);
        }
      } catch (e) {
        console.log(`  ❌ ${tipo}: ${e.message}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ CONCLUÍDO — ${totalVouchers} vouchers | R$ ${totalGeral} total rede`);
  console.log(`\nAcesse: https://gestao.solcentral.com.br/vouchers`);
})();
