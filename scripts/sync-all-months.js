/**
 * Script para executar no console do browser em buddhaspa.com.br
 * Este script faz a extração automática de vouchers de fevereiro a junho 2026
 * para os 3 tipos (site, omnichannel, cortesia)
 *
 * INSTRUÇÕES:
 * 1. Abra https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers
 * 2. Abra o Console do DevTools (F12)
 * 3. Cole este script e pressione Enter
 * 4. Aguarde a conclusão (vai mostrar progresso)
 */

(async () => {
  const API_URL = 'http://localhost:3000';
  const AFFILIATION = '894555';

  const periodos = [
    { nome: 'Fevereiro', ini: '2026-02-01', fim: '2026-02-28' },
    { nome: 'Março', ini: '2026-03-01', fim: '2026-03-31' },
    { nome: 'Abril', ini: '2026-04-01', fim: '2026-04-30' },
    { nome: 'Maio', ini: '2026-05-01', fim: '2026-05-31' },
    { nome: 'Junho (01-05)', ini: '2026-06-01', fim: '2026-06-05' },
  ];

  console.log('🔄 Iniciando sincronização automática de vouchers...\n');

  for (const periodo of periodos) {
    console.log(`📅 Processando ${periodo.nome}...`);

    // Site vouchers (filtro por data de UTILIZAÇÃO)
    try {
      const urlSite = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${periodo.ini}&date_used_end=${periodo.fim}&affilliation_id=${AFFILIATION}`;

      const respSite = await fetch(urlSite, { credentials: 'include' });
      const htmlSite = await respSite.text();

      await fetch(`${API_URL}/api/vouchers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataIni: periodo.ini,
          dataFim: periodo.fim,
          html: htmlSite,
          tipo: 'site'
        }),
      });

      console.log(`  ✓ Site`);
    } catch (err) {
      console.error(`  ✗ Site: ${err.message}`);
    }

    // Omnichannel vouchers (filtro por data de VENDA)
    try {
      const urlOmni = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${periodo.ini}&date_sell_end=${periodo.fim}&date_used_start=&date_used_end=&affilliation_id=${AFFILIATION}`;

      const respOmni = await fetch(urlOmni, { credentials: 'include' });
      const htmlOmni = await respOmni.text();

      await fetch(`${API_URL}/api/vouchers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataIni: periodo.ini,
          dataFim: periodo.fim,
          html: htmlOmni,
          tipo: 'omnichannel'
        }),
      });

      console.log(`  ✓ Omnichannel`);
    } catch (err) {
      console.error(`  ✗ Omnichannel: ${err.message}`);
    }

    // Cortesia vouchers (filtro por data de UTILIZAÇÃO + valorReembolso = 0)
    try {
      const urlCortesia = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${periodo.ini}&date_used_end=${periodo.fim}&affilliation_id=${AFFILIATION}`;

      const respCortesia = await fetch(urlCortesia, { credentials: 'include' });
      const htmlCortesia = await respCortesia.text();

      await fetch(`${API_URL}/api/vouchers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataIni: periodo.ini,
          dataFim: periodo.fim,
          html: htmlCortesia,
          tipo: 'cortesia'
        }),
      });

      console.log(`  ✓ Cortesia`);
    } catch (err) {
      console.error(`  ✗ Cortesia: ${err.message}`);
    }

    console.log('');
  }

  console.log('✅ Sincronização concluída!');
  console.log('Verifique http://localhost:3000/vouchers');
})();
