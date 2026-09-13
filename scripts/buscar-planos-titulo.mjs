// Busca o relatório de planos correto verificando o campo "title" de cada resposta
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

async function testar(token, id) {
  try {
    const r = await fetch(`${BASE}/BI/v1.0/report/build?estabGeral=1`, {
      method: 'POST', headers: { ...H, Authorization: token },
      body: JSON.stringify({
        reportId: id, estab: '1', sortColumn: null, sortOrder: 1,
        ignoreRecords: false, filters: [], offsetRecords: 0, maxRecords: 10
      }),
      signal: AbortSignal.timeout(10000)
    })
    if (!r.ok) return null
    const d = await r.json()
    return { title: d.title || '', rows: d.data?.length ?? 0, count: d.record_count ?? 0, data0: d.data?.[0] }
  } catch { return null }
}

const token = await getToken()
console.log('Token OK — buscando relatório de planos...\n')

// IDs candidatos: range mais amplo + IDs [Buddha] conhecidos adjacentes
const ids = [
  // Range 180-250
  ...Array.from({length: 70}, (_, i) => 180 + i),
  // Range Buddha custom (241XXXXXX) - tentativas adicionais
  241166277, 241166276, 241166275, 241166274, 241166273,
  241166520, 241166519, 241166517, 241166516, 241166515,
  241153512, 241153513, 241153514, 241153515,
  241130699, 241130700, 241130701, 241130702,
  // IDs maiores
  2420, 2421, 2422, 2423, 2424, 2425, 2426,
]

const resultados = []

for (const id of ids) {
  const res = await testar(token, id)
  if (res && (res.rows > 0 || res.count > 0)) {
    resultados.push({ id, ...res })
    const titulo = res.title || '(sem título)'
    const temPlano = titulo.toLowerCase().includes('plano') || titulo.toLowerCase().includes('sessão') || titulo.toLowerCase().includes('pacote')
    const marker = temPlano ? '🎯' : '✅'
    console.log(`${marker} ID ${id}: "${titulo}" | ${res.rows} rows (${res.count} total)`)
    if (res.data0) console.log(`   ex: ${JSON.stringify(res.data0).substring(0, 120)}`)
  }
}

// Mostra os com mais registros e com "plano/sessão" no título
console.log('\n=== TOP por quantidade de registros ===')
resultados.sort((a,b) => b.count - a.count).slice(0,10).forEach(r => {
  console.log(`  ID ${r.id}: "${r.title}" — ${r.count} registros`)
})
