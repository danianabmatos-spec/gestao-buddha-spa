// Testa o endpoint do Relatório de Uso de Vouchers do Belle

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';

(async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://app.bellesoftware.com.br',
    'x-from': 'app',
  };

  console.log('🔐 Fazendo login...');

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

  console.log('✅ Login bem-sucedido\n');

  // Busca relatório
  const dataIniISO = '2026-06-01T03:00:00.000Z';
  const dataFimISO = '2026-06-06T03:00:00.000Z';

  const payload = {
    reportId: 2422,
    sortColumn: null,
    sortOrder: 1,
    estab: '1',
    filters: [
      { id: '121087', value: dataIniISO },
      { id: '121087', value2: dataFimISO },
      { id: '121087', range: false }
    ],
    ignoreRecords: false
  };

  console.log('📊 Buscando relatório de vouchers...\n');

  const resp = await fetch(
    `${BASE_URL}/BI/v1.0/report/build?estabGeral=1`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }
  );

  const data = await resp.json();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ESTRUTURA DA RESPOSTA:\n');
  console.log('Keys:', Object.keys(data));
  console.log('');

  // Mostra primeiros registros
  const records = data.records || data.data || data.rows || [];
  console.log(`Total de registros: ${records.length}`);
  console.log('');

  if (records.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 PRIMEIRO REGISTRO:\n');
    console.log(JSON.stringify(records[0], null, 2));
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 CAMPOS DISPONÍVEIS:\n');
    Object.keys(records[0]).forEach(key => {
      console.log(`  ${key}: ${typeof records[0][key]}`);
    });
    console.log('');

    // Procura vouchers E-commerce
    const ecommerce = records.filter(r =>
      (r.tipo || r.Tipo || '').toLowerCase() === 'e-commerce'
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📌 VOUCHERS E-COMMERCE: ${ecommerce.length}\n`);

    if (ecommerce.length > 0) {
      ecommerce.slice(0, 3).forEach((v, i) => {
        console.log(`${i + 1}. ${v.origemDesconto || v['Origem Desconto'] || v.origem_desconto || 'N/A'}`);
        console.log(`   Tipo: ${v.tipo || v.Tipo || 'N/A'}`);
        console.log(`   Cliente: ${v.cliente || v.Cliente || 'N/A'}`);
        console.log('');
      });
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TESTE CONCLUÍDO!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
