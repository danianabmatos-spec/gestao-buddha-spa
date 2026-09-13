import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dir, '../.env.local'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
    .map(l => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
);

async function testarBelle(email, senha, label) {
  console.log(`\n=== ${label} ===`);
  const loginRes = await fetch('https://app.bellesoftware.com.br/api/release/controller/Login/v1.0/autenticar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metodo: 'email', dados: { email, senha } })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    console.log('❌ Auth falhou:', JSON.stringify(loginData).substring(0, 200));
    return;
  }
  console.log('✅ Auth OK');

  const today = new Date();
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const from = new Date(today); from.setFullYear(from.getFullYear()-2);

  const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';
  const HEADERS = { 'Content-Type': 'application/json', 'Authorization': loginData.token };
  const payload = {
    reportId: 194, sortColumn: null, sortOrder: 1, estab: '1', ignoreRecords: false,
    filters: [{ id: 1, field: { type_id: 'data', description: 'Período' }, operator: { allow_multiple_values: true, description: 'Entre', id: null }, value: fmt(from), value2: fmt(today) }]
  };
  const rptRes = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload)
  });
  const rptData = await rptRes.json();
  const rows = rptData?.data?.length ?? 0;
  console.log(`Report 194: ${rows} rows (max 5)`);
  if (rows > 0) {
    console.log('Colunas:', Object.keys(rptData.data[0]).join(', '));
    console.log('Exemplo:', JSON.stringify(rptData.data[0]).substring(0, 200));
  } else {
    console.log('Resposta:', JSON.stringify(rptData).substring(0, 300));
  }
}

await testarBelle(env.BELLE_SHOPPING_ANALIA_FRANCO_EMAIL, env.BELLE_SHOPPING_ANALIA_FRANCO_PASSWORD, 'Shopping Anália Franco');
await testarBelle(env.BELLE_HIGIENOPOLIS_EMAIL, env.BELLE_HIGIENOPOLIS_PASSWORD, 'Higienópolis');
