// Testa a API com o HTML real completo
const fs = require('fs');

(async () => {
  const html = fs.readFileSync('C:/Users/MADISHAR/Downloads/debug-html-site-junho.html', 'utf-8');

  console.log(`HTML carregado: ${(html.length / 1024).toFixed(1)} KB`);

  const response = await fetch('http://localhost:3000/api/vouchers/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataIni: '2026-06-01',
      dataFim: '2026-06-30',
      html,
      tipo: 'site'
    })
  });

  const result = await response.json();

  console.log('\n=== RESULTADO ===');
  console.log(`Total Reembolso: R$ ${result.totalReembolso}`);
  console.log(`Total Vouchers: ${result.totalValidados}`);
  console.log(`Vouchers extraídos: ${result.vouchers?.length || 0}`);

  if (result.vouchers && result.vouchers.length > 0) {
    console.log('\n✅ SUCESSO!');
    console.log('Primeiro voucher:', result.vouchers[0]);
  } else {
    console.log('\n❌ NENHUM VOUCHER EXTRAÍDO');
  }
})();
