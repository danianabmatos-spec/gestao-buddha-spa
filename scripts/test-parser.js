// Script para testar o parser com dados reais de junho
const fs = require('fs');
const path = require('path');

// Função parseMoeda
function parseMoeda(txt) {
  if (!txt) return 0;
  return parseFloat(txt.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// HTML de exemplo (uma linha real)
const sampleHTML = `
<tbody>
<tr><td class='NAME column-NAME has-row-actions column-primary' data-colname="Nome"><strong>Yin-Yang - 60 minutos</strong><button type="button" class="toggle-row"><span class="screen-reader-text">Mostrar mais detalhes</span></button></td><td class='CREATED_DATE column-CREATED_DATE' data-colname="Data da Venda">04/06/2026 12:19</td><td class='USED_DATE column-USED_DATE' data-colname="Data da Utilização">04/06/2026 16:01</td><td class='AFILLIATION_NAME column-AFILLIATION_NAME' data-colname="Unidade">Shopping Metrópole</td><td class='PRICE_REFOUND column-PRICE_REFOUND' data-colname="Valor de Reembolso">R$ 154,00</td><td class='KEY column-KEY' data-colname="Código"><a href="admin.php?page=vouchers/buscar&s=D9FLX5K">D9FLX5K</a></td><td class='VOUCHER_STATUS column-VOUCHER_STATUS' data-colname="Status"><span style="color: blue; font-weight: bold;">Utilizado</span></td></tr>
</tbody>
`;

console.log('=== TESTE DO PARSER ===\n');

// Teste 1: Encontra tbody?
const tbodyMatch = sampleHTML.match(/<tbody>([\s\S]*?)<\/tbody>/);
console.log('1. Encontrou tbody?', !!tbodyMatch);

if (tbodyMatch) {
  // Teste 2: Encontra linhas?
  const rows = tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  const rowsArray = Array.from(rows);
  console.log('2. Linhas encontradas:', rowsArray.length);

  for (const row of rowsArray) {
    console.log('\n=== PROCESSANDO LINHA ===');

    // Teste 3: Extrai células com data-colname
    const tdMatches = row[1].matchAll(/<td[^>]*data-colname=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/g);
    const cellMap = new Map();

    for (const match of tdMatches) {
      const colName = match[1];
      const content = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      cellMap.set(colName, content);
      console.log(`  ${colName}: "${content}"`);
    }

    console.log('\n3. Total de células extraídas:', cellMap.size);
    console.log('4. cellMap.size >= 6?', cellMap.size >= 6);

    if (cellMap.size >= 6) {
      const produto = cellMap.get('Nome') ?? '';
      const dataVenda = cellMap.get('Data da Venda') ?? '';
      const dataTerapia = cellMap.get('Data da Utilização') ?? cellMap.get('Data de Utilização') ?? '';
      const unidade = cellMap.get('Unidade') ?? '';
      const valorStr = cellMap.get('Valor de Reembolso') ?? '';
      const codigo = cellMap.get('Código') ?? '';
      const statusVoucher = cellMap.get('Status') ?? '';

      const voucher = {
        codigo,
        produto: produto.replace('Mostrar mais detalhes', '').trim(),
        dataTerapia,
        dataVenda,
        statusVoucher,
        status: statusVoucher.includes('Utilizado') ? 'Utilizado' : (statusVoucher.includes('Validado') ? 'Validado' : 'Pendente'),
        formaValidacao: 'Automatico',
        valorReembolso: parseMoeda(valorStr),
        unidade,
      };

      console.log('\n5. VOUCHER CRIADO:');
      console.log(JSON.stringify(voucher, null, 2));
    } else {
      console.log('\n❌ FALHOU: cellMap.size < 6');
    }
  }
}
