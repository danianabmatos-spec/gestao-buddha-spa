// Script para salvar o HTML e debugar
// Cole no console do Chrome

(async () => {
  const AFFILIATION = '894555';
  const dataIni = '2026-06-01';
  const dataFim = '2026-06-05';

  // URL para vouchers SITE
  const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

  console.log('Buscando HTML...');
  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();

  console.log(`HTML recebido: ${html.length} bytes`);

  // Procura pela tabela
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  console.log('Encontrou tbody?', !!tbodyMatch);

  if (tbodyMatch) {
    const rows = Array.from(tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g));
    console.log(`Linhas encontradas: ${rows.length}`);

    if (rows.length > 0) {
      console.log('Primeira linha:', rows[0][0].substring(0, 500));
    }
  }

  // Procura por tabelas alternativas
  const tables = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g));
  console.log(`Total de tabelas na página: ${tables.length}`);

  // Procura por palavras-chave
  const temVoucher = html.includes('voucher') || html.includes('Voucher');
  const temCodigo = /[A-Z0-9]{7}/.test(html); // Códigos de voucher (7 caracteres)

  console.log('Tem palavra "voucher"?', temVoucher);
  console.log('Tem códigos (pattern A1B2C3D)?', temCodigo);

  // Salva HTML em arquivo (download)
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vouchers-junho-debug.html';
  a.click();

  console.log('✅ HTML salvo como "vouchers-junho-debug.html"');
  console.log('Abra o arquivo e procure pela tabela de vouchers');
})();
