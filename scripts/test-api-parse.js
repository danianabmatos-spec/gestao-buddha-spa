// Testa a API de parsing com HTML real
const fs = require('fs');

const sampleHTML = `
<!DOCTYPE html>
<html>
<body>
<div>R$ 154,00</div>
Reembolso
<table>
<tbody>
<tr><td class='NAME column-NAME has-row-actions column-primary' data-colname="Nome"><strong>Yin-Yang - 60 minutos</strong><button type="button" class="toggle-row"><span class="screen-reader-text">Mostrar mais detalhes</span></button></td><td class='CREATED_DATE column-CREATED_DATE' data-colname="Data da Venda">04/06/2026 12:19</td><td class='USED_DATE column-USED_DATE' data-colname="Data da Utilização">04/06/2026 16:01</td><td class='AFILLIATION_NAME column-AFILLIATION_NAME' data-colname="Unidade">Shopping Metrópole</td><td class='PRICE_REFOUND column-PRICE_REFOUND' data-colname="Valor de Reembolso">R$ 154,00</td><td class='KEY column-KEY' data-colname="Código"><a href="admin.php?page=vouchers/buscar&s=D9FLX5K">D9FLX5K</a></td><td class='VOUCHER_STATUS column-VOUCHER_STATUS' data-colname="Status"><span style="color: blue; font-weight: bold;">Utilizado</span></td></tr>
</tbody>
</table>
</body>
</html>
`;

(async () => {
  console.log('Enviando HTML para API...');

  const response = await fetch('http://localhost:3000/api/vouchers/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataIni: '2026-06-01',
      dataFim: '2026-06-05',
      html: sampleHTML,
      tipo: 'site'
    })
  });

  const result = await response.json();

  console.log('\n=== RESPOSTA DA API ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.vouchers && result.vouchers.length > 0) {
    console.log('\n✅ SUCESSO! Parser extraiu', result.vouchers.length, 'voucher(s)');
  } else {
    console.log('\n❌ FALHOU! Nenhum voucher extraído');
  }
})();
