// Descobre o Report ID do "[Buddha] Relatório de Sessões de Planos"
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

async function getToken(email, senha) {
  const r = await fetch(`${BASE}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metodo: 'email', dados: { email, senha } })
  })
  const d = await r.json()
  return d.token
}

async function listarRelatorios(token) {
  const r = await fetch(`${BASE}/BI/v1.0/report/list?estabGeral=1`, {
    headers: { 'Content-Type': 'application/json', Authorization: token }
  })
  return r.json()
}

async function buildReport(token, reportId, dataIni, dataFim) {
  const r = await fetch(`${BASE}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({
      reportId, estab: '1', sortColumn: null, sortOrder: 1, ignoreRecords: false,
      filters: [{ id: 1, field: { type_id: 'data', description: 'Período' }, operator: { allow_multiple_values: true, description: 'Entre', id: null }, value: dataIni, value2: dataFim }]
    })
  })
  return r.json()
}

const token = await getToken(env.BELLE_METROPOLE_EMAIL, env.BELLE_METROPOLE_PASSWORD)
console.log('Token OK\n')

// Lista todos os relatórios e filtra por "plano" ou "sessão"
const lista = await listarRelatorios(token)
const relatorios = lista?.reports || lista?.data || lista || []
console.log('Total de relatórios:', relatorios.length)

const interessantes = relatorios.filter(r => {
  const nome = (r.name || r.nome || r.description || '').toLowerCase()
  return nome.includes('plano') || nome.includes('sessão') || nome.includes('sessao') || nome.includes('buddha')
})

console.log('\nRelatórios com "plano", "sessão" ou "buddha":')
interessantes.forEach(r => {
  console.log(` ID ${r.id || r.reportId}: ${r.name || r.nome || r.description}`)
})

// Tenta o report com nome exato
const alvo = relatorios.find(r => {
  const nome = (r.name || r.nome || r.description || '').toLowerCase()
  return nome.includes('sessões de plano') || nome.includes('sessoes de plano')
})

if (alvo) {
  console.log(`\n✅ Encontrado: ID ${alvo.id} — "${alvo.name || alvo.description}"`)

  const hoje = new Date()
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  const from = new Date(hoje); from.setDate(from.getDate() - 60)

  const data = await buildReport(token, alvo.id, fmt(from), fmt(hoje))
  const rows = data?.data || []
  console.log(`\nPrimeiras 3 linhas (${rows.length} total):`)
  rows.slice(0, 3).forEach((row, i) => console.log(`  [${i}]:`, JSON.stringify(row).substring(0, 200)))
  if (data?.columns) console.log('\nColunas:', data.columns.map(c => c.description || c.name).join(' | '))
} else {
  console.log('\n⚠️ Não encontrado pelo nome. Veja a lista acima e tente manualmente.')
}
