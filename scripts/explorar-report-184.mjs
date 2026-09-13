// Explora Report 184 para descobrir estrutura completa do Relatório de Sessões de Planos
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
const HEADERS = {
  'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*',
  Origin: 'https://app.bellesoftware.com.br', Referer: 'https://app.bellesoftware.com.br/',
  'x-from': 'app', 'User-Agent': 'Mozilla/5.0 Chrome/148.0.0.0',
}

async function getToken() {
  const r = await fetch(`${BASE}/Login/v1.0/autenticar`, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ metodo: 'email', dados: { email: env.BELLE_METROPOLE_EMAIL, senha: env.BELLE_METROPOLE_PASSWORD } })
  })
  const d = await r.json()
  await fetch(`${BASE}/Login/v1.0/admin/recuperar_dados?estabGeral=`, { headers: { ...HEADERS, Authorization: d.token } })
  await fetch(`${BASE}/Login/v1.0/gravarsessao?estabGeral=`, { method: 'POST', headers: { ...HEADERS, Authorization: d.token }, body: '{}' })
  return d.token
}

async function buildReport(token, id, filtros = []) {
  const r = await fetch(`${BASE}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST', headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({ reportId: id, estab: '1', sortColumn: null, sortOrder: 1, ignoreRecords: false, filters: filtros }),
    signal: AbortSignal.timeout(30000)
  })
  if (!r.ok) { console.log('HTTP', r.status); return null }
  return r.json()
}

const token = await getToken()
console.log('Token OK\n')

// Teste 1: sem filtro algum
console.log('=== Report 184 SEM filtro ===')
const d1 = await buildReport(token, 184, [])
console.log('Rows:', d1?.data?.length ?? 0, '| record_count:', d1?.record_count)
if (d1?.data?.[0]) {
  console.log('Qtd de colunas:', d1.data[0].length)
  console.log('Row 0:', JSON.stringify(d1.data[0]))
  if (d1.data[1]) console.log('Row 1:', JSON.stringify(d1.data[1]))
  if (d1.data[2]) console.log('Row 2:', JSON.stringify(d1.data[2]))
}
if (d1?.columns) console.log('Colunas:', d1.columns.map(c => c.description || c.name || '').join(' | '))

// Teste 2: com período longo (2 anos)
console.log('\n=== Report 184 COM filtro 2 anos ===')
const d2 = await buildReport(token, 184, [
  { id: 1, field: { type_id: 'data', description: 'Período' }, operator: { allow_multiple_values: true, description: 'Entre', id: null }, value: '01/07/2024', value2: '08/07/2026' }
])
console.log('Rows:', d2?.data?.length ?? 0, '| record_count:', d2?.record_count)

// Teste 3: verificar se é o de sessões de planos - procurar colunas com "sessão" ou "plano"
if (d1?.data?.length > 0) {
  console.log('\n=== Análise das colunas do Report 184 ===')
  const row = d1.data[0]
  row.forEach((val, i) => {
    console.log(`  col[${i}]: ${JSON.stringify(val)}`)
  })
}

// Também testar Report 196 para comparar
console.log('\n=== Report 196 SEM filtro (comparação) ===')
const d3 = await buildReport(token, 196, [])
console.log('Rows:', d3?.data?.length ?? 0)
if (d3?.data?.[0]) console.log('Row 0:', JSON.stringify(d3.data[0]))
