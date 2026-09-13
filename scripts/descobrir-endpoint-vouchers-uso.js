// Script para descobrir o endpoint de vouchers utilizados no Belle
// Baseado na tela que você mostrou: "Relatório de Uso de Vouchers"

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';

(async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://app.bellesoftware.com.br',
    'x-from': 'app',
  };

  // Login
  const authResp = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      metodo: 'email',
      dados: {
        email: 'adm.shoppingmetropole@buddhaspa.com.br',
        senha: 'Metr@1056'
      }
    })
  });

  const authData = await authResp.json();
  headers.Authorization = authData.token;

  console.log('🔐 Login bem-sucedido\n');

  // Tentativas de endpoints possíveis
  const endpoints = [
    '/Voucher/v1.0/relatorio_uso',
    '/Voucher/v1.0/utilizados',
    '/Voucher/v1.0/usado',
    '/Relatorio/v1.0/voucher_uso',
    '/Financeiro/v1.0/voucher_uso',
  ];

  console.log('🔍 Testando endpoints possíveis:\n');

  for (const endpoint of endpoints) {
    try {
      const url = `${BASE_URL}${endpoint}?dtIni=01/06/2026&dtFim=06/06/2026&estabGeral=1`;
      const resp = await fetch(url, { headers });

      if (resp.ok) {
        const data = await resp.json();
        console.log(`✅ ${endpoint}`);
        console.log('   Retornou:', data.length || 'objeto', 'itens');
        console.log('   Amostra:', JSON.stringify(data).substring(0, 200));
        console.log('');
      } else {
        console.log(`❌ ${endpoint} - Status: ${resp.status}`);
      }
    } catch (err) {
      console.log(`❌ ${endpoint} - Erro: ${err.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 DICA: Acesse o Belle manualmente e vá em');
  console.log('   "Relatórios > Uso de Vouchers"');
  console.log('   Abra o Network do Chrome (F12) e veja qual');
  console.log('   endpoint é chamado quando você clica em');
  console.log('   "Gerar Relatório"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
