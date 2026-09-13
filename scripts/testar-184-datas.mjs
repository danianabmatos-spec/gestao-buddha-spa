// Testa Report 184 com filtros de data amplos para trazer todos os planos
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

async function build(token, reportId, payload) {
  const r = await fetch(`${BASE}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST', headers: { ...H, Authorization: token },
    body: JSON.stringify({ reportId, estab: '1', sortColumn: null, sortOrder: 1, ...payload }),
    signal: AbortSignal.timeout(30000)
  })
  if (!r.ok) { console.log('HTTP', r.status); return null }
  return r.json()
}

const token = await getToken()
console.log('Token OK\n')

// Mostra as colunas/filtros disponíveis no Report 184
console.log('=== Estrutura do Report 184 ===')
const estrutura = await build(token, 184, { ignoreRecords: false, filters: [] })
console.log('Colunas:', JSON.stringify(estrutura?.columns?.map(c => c.description || c)))
console.log('Filtros disponíveis:', JSON.stringify(estrutura?.filters))

// Testa com datas de venda (DataVenda = col[4])
const ranges = [
  ['01/01/2020', '08/07/2026'],  // 6 anos
  ['01/01/2018', '08/07/2026'],  // 8 anos
  ['01/01/2024', '08/07/2026'],  // 2.5 anos
]

for (const [de, ate] of ranges) {
  console.log(`\n=== Filtro DataVenda: ${de} → ${ate} ===`)

  // Variação 1: campo Período
  const r1 = await build(token, 184, {
    ignoreRecords: false, offsetRecords: 0, maxRecords: 500,
    filters: [{
      field: { description: 'Período', type_id: 'data' },
      operator: { description: 'Entre', allow_multiple_values: true },
      value: de, value2: ate
    }]
  })
  console.log('Período Entre:', r1?.data?.length, 'rows | count:', r1?.record_count)
  if (r1?.data?.length > 2) {
    r1.data.slice(0, 3).forEach((row, i) => console.log(` [${i}]`, JSON.stringify(row).substring(0, 100)))
  }

  // Variação 2: campo Data Venda
  const r2 = await build(token, 184, {
    ignoreRecords: false, offsetRecords: 0, maxRecords: 500,
    filters: [{
      field: { description: 'Data Venda', type_id: 'data' },
      operator: { description: 'Entre', allow_multiple_values: true },
      value: de, value2: ate
    }]
  })
  console.log('Data Venda Entre:', r2?.data?.length, 'rows | count:', r2?.record_count)
  if (r2?.data?.length > 2) {
    r2.data.slice(0, 3).forEach((row, i) => console.log(` [${i}]`, JSON.stringify(row).substring(0, 100)))
  }
}

// Testa status vencido explicitamente
console.log('\n=== Status Vencido ===')
const rv = await build(token, 184, {
  ignoreRecords: false, offsetRecords: 0, maxRecords: 500,
  filters: [{ field: { description: 'Status' }, operator: { description: 'Diferente de' }, value: 'Cancelado', value2: null }]
})
console.log('Status != Cancelado:', rv?.data?.length, 'rows | count:', rv?.record_count)
if (rv?.data?.length > 0) {
  rv.data.slice(0, 5).forEach((row, i) => console.log(` [${i}]`, JSON.stringify(row).substring(0, 120)))
}

// Sem nenhum filtro, mostra colunas
console.log('\n=== columns field raw ===')
if (estrutura?.columns) {
  estrutura.columns.forEach((c, i) => console.log(`col[${i}]:`, JSON.stringify(c)))
}
if (estrutura?.filters) {
  console.log('\n=== filters raw ===')
  estrutura.filters.forEach((f, i) => console.log(`filter[${i}]:`, JSON.stringify(f)))
}
