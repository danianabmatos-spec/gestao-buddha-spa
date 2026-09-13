// Busca o relatório "[Buddha] Sessões de Planos" por força bruta em IDs conhecidos
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

async function testarId(token, id) {
  const r = await fetch(`${BASE}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST', headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({
      reportId: id, estab: '1', sortColumn: null, sortOrder: 1, ignoreRecords: false,
      filters: [{ id: 1, field: { type_id: 'data', description: 'Período' }, operator: { allow_multiple_values: true, description: 'Entre', id: null }, value: '01/01/2025', value2: '08/07/2026' }]
    }),
    signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) return null
  const d = await r.json()
  if (!d?.data && !d?.totalization_data) return null
  return d
}

const token = await getToken()
console.log('Token OK\n')

// IDs a testar: range 190-210 + Buddha custom IDs próximos aos conhecidos
const candidatos = [
  // Range padrão perto de 194 (Clientes) e 196 (Planos)
  193, 195, 197, 198, 199, 200, 201, 202, 203, 204, 205,
  // IDs Buddha custom conhecidos: 241130697, 241153509, 241166277
  // Testando variações próximas
  241166278, 241166279, 241166280, 241166518,
  241130694, 241130695, 241130696, 241130698,
  241153507, 241153508, 241153510, 241153511,
  // Outros IDs comuns
  183, 184, 185, 186, 187, 188, 189, 190, 191, 192,
]

for (const id of candidatos) {
  try {
    const d = await testarId(token, id)
    if (d) {
      const rows = d.data?.length ?? 0
      const cols = d.columns?.map(c => c.description || c.name) || (d.data?.[0] ? Object.keys(d.data[0]) : [])
      console.log(`✅ ID ${id}: ${rows} rows | cols: ${cols.slice(0,6).join(' | ')}`)
      if (rows > 0) console.log(`   ex: ${JSON.stringify(d.data[0]).substring(0, 150)}`)
    }
  } catch { /* timeout */ }
}
console.log('\nBusca concluída.')
