const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, '..', 'cache');

function lerTotais(arquivo, tipo) {
  const filePath = path.join(cacheDir, arquivo);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\n=== ${tipo.toUpperCase()} ===`);
  Object.keys(data).sort().forEach(key => {
    const [ini, fim] = key.split('_');
    const mes = ini.substring(5, 7);
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesNome = meses[parseInt(mes) - 1];
    const total = data[key].totalReembolso || data[key].totalValor || 0;
    const qtd = data[key].totalValidados || data[key].vouchers?.length || 0;
    console.log(`${mesNome}/2026 (${ini} até ${fim}): R$ ${total.toFixed(2)} | ${qtd} vouchers`);
  });
}

lerTotais('vouchers-site.json', 'Site');
lerTotais('vouchers-omnichannel.json', 'Omnichannel');
lerTotais('vouchers-cortesia.json', 'Cortesia');
