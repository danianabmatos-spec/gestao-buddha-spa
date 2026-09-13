// Debug: salva o HTML recebido E testa o parser
// Cole no console do Chrome

(async () => {
  const AFFILIATION = '894555';
  const dataIni = '2026-06-01';
  const dataFim = '2026-06-30';

  // URL para vouchers SITE
  const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

  console.log('Buscando HTML...');
  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();

  console.log(`HTML recebido: ${(html.length / 1024).toFixed(1)} KB`);

  // Procura tbody
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  console.log('Encontrou tbody?', !!tbodyMatch);

  if (tbodyMatch) {
    const tbodyContent = tbodyMatch[1];
    console.log(`Conteúdo do tbody: ${(tbodyContent.length / 1024).toFixed(1)} KB`);

    // Procura linhas <tr>
    const rows = Array.from(tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g));
    console.log(`Total de linhas <tr>: ${rows.length}`);

    if (rows.length > 0) {
      console.log('\n=== PRIMEIRA LINHA ===');
      const firstRow = rows[0][1];
      console.log(`Tamanho: ${firstRow.length} chars`);

      // Testa regex de data-colname na primeira linha
      const tdMatches = Array.from(firstRow.matchAll(/<td[^>]*data-colname=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/g));
      console.log(`Células com data-colname encontradas: ${tdMatches.length}`);

      if (tdMatches.length > 0) {
        console.log('\nCélulas extraídas:');
        tdMatches.forEach(m => {
          const colName = m[1];
          const content = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
          console.log(`  ${colName}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
        });
      } else {
        console.log('\n❌ NENHUMA célula com data-colname encontrada!');
        console.log('Primeiros 500 chars da linha:');
        console.log(firstRow.substring(0, 500));
      }
    }
  } else {
    console.log('\n❌ Nenhum <tbody> encontrado no HTML');

    // Procura por qualquer tabela
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
    if (tableMatch) {
      console.log('✓ Mas encontrou uma <table>');
      console.log('Primeiros 1000 chars da table:');
      console.log(tableMatch[0].substring(0, 1000));
    }
  }

  // Salva HTML completo
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'debug-html-site-junho.html';
  a.click();

  console.log('\n✅ HTML salvo como "debug-html-site-junho.html"');
})();
