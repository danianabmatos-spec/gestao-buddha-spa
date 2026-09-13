import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dir, '../.env.local'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
    .map(l => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
)

const BASE = 'https://app.bellesoftware.com.br/api/release/controller'
const H = {
  'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*',
  Origin: 'https://app.bellesoftware.com.br', Referer: 'https://app.bellesoftware.com.br/',
  'x-from': 'app', 'User-Agent': 'Mozilla/5.0 Chrome/148.0.0.0',
}

async function getToken() {
  const r = await fetch(`${BASE}/Login/v1.0/autenticar`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ metodo: 'email', dados: { email: env.BELLE_METROPOLE_EMAIL, senha: env.BELLE_METROPOLE_PASSWORD } })
  })
  const d = await r.json()
  await fetch(`${BASE}/Login/v1.0/admin/recuperar_dados?estabGeral=`, { headers: { ...H, Authorization: d.token } })
  await fetch(`${BASE}/Login/v1.0/gravarsessao?estabGeral=`, { method: 'POST', headers: { ...H, Authorization: d.token }, body: '{}' })
  return d.token
}

async function buildReport(token, reportId, payload) {
  const r = await fetch(`${BASE}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST', headers: { ...H, Authorization: token },
    body: JSON.stringify({ reportId, estab: '1', sortColumn: null, sortOrder: 1, ...payload }),
    signal: AbortSignal.timeout(30000)
  })
  if (!r.ok) { console.log('HTTP', r.status, await r.text().catch(()=>'')); return null }
  return r.json()
}

const token = await getToken()
console.log('Token OK\n')

// Teste 1: sem filtro, sem paginação (como está hoje)
console.log('=== Teste 1: sem filtro, sem paginação ===')
const t1 = await buildReport(token, 184, { ignoreRecords: false, filters: [] })
console.log('rows:', t1?.data?.length, '| record_count:', t1?.record_count, '| total_records:', t1?.total_records)

// Teste 2: com paginação explícita
console.log('\n=== Teste 2: com offsetRecords=0, maxRecords=500 ===')
const t2 = await buildReport(token, 184, { ignoreRecords: false, filters: [], offsetRecords: 0, maxRecords: 500 })
console.log('rows:', t2?.data?.length, '| record_count:', t2?.record_count, '| total_records:', t2?.total_records)

// Teste 3: ignoreRecords: true
console.log('\n=== Teste 3: ignoreRecords: true ===')
const t3 = await buildReport(token, 184, { ignoreRecords: true, filters: [] })
console.log('rows:', t3?.data?.length, '| record_count:', t3?.record_count, '| total_records:', t3?.total_records)
if (t3?.data?.[0]) {
  console.log('ex:', JSON.stringify(t3.data[0]))
  if (t3.data[1]) console.log('ex2:', JSON.stringify(t3.data[1]))
  if (t3.data[2]) console.log('ex3:', JSON.stringify(t3.data[2]))
}

// Teste 4: filtro por status "Aprovado"
console.log('\n=== Teste 4: filtro status ===')
const t4 = await buildReport(token, 184, {
  ignoreRecords: false, offsetRecords: 0, maxRecords: 500,
  filters: [{ id: 2, field: { description: 'Status' }, operator: { description: 'Igual', id: null }, value: 'Aprovado', value2: null }]
})
console.log('rows:', t4?.data?.length, '| record_count:', t4?.record_count)

// Teste 5: period filter + ignoreRecords:true
console.log('\n=== Teste 5: período amplo (2 anos) + ignoreRecords true ===')
const t5 = await buildReport(token, 184, {
  ignoreRecords: true, offsetRecords: 0, maxRecords: 1000,
  filters: [{
    id: 1,
    field: { type_id: 'data', description: 'Período' },
    operator: { allow_multiple_values: true, description: 'Entre', id: null },
    value: '08/07/2024', value2: '08/07/2026'
  }]
})
console.log('rows:', t5?.data?.length, '| record_count:', t5?.record_count, '| total_records:', t5?.total_records)
if (t5?.data?.length > 0) {
  console.log('Primeiros 3:')
  t5.data.slice(0,3).forEach(r => console.log(' ', JSON.stringify(r)))
}

// Exibe resposta bruta da melhor tentativa
const melhor = [t1,t2,t3,t4,t5].sort((a,b) => (b?.data?.length||0) - (a?.data?.length||0))[0]
console.log('\n=== Resposta bruta da melhor tentativa ===')
console.log('Keys da resposta:', Object.keys(melhor || {}))
if (melhor?.data?.length > 0) {
  // Mostra estrutura de colunas
  console.log('\nExemplo linha completa:')
  melhor.data.slice(0,5).forEach((r,i) => {
    console.log(`[${i}]:`, JSON.stringify(r))
  })
}
