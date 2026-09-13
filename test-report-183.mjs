// Análise detalhada do Report 183 - Demonstrativo de Vendas
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env.local') })

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller'

const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://app.bellesoftware.com.br',
  Referer: 'https://app.bellesoftware.com.br/',
  'x-from': 'app',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36',
}

async function getToken() {
  const email = process.env.BELLE_METROPOLE_EMAIL
  const senha = process.env.BELLE_METROPOLE_PASSWORD

  const resp = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ metodo: 'email', dados: { email, senha } }),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Autenticação falhou: ${resp.status} - ${txt}`)
  }

  const data = await resp.json()
  const token = data.token

  await fetch(`${BASE_URL}/Login/v1.0/admin/recuperar_dados?estabGeral=`, {
    headers: { ...HEADERS, Authorization: token },
  })
  await fetch(`${BASE_URL}/Login/v1.0/gravarsessao?estabGeral=`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({}),
  })

  return token
}

async function buildReport(token, reportId, dataIni, dataFim) {
  const payload = {
    reportId,
    sortColumn: null,
    sortOrder: 1,
    estab: '1',
    ignoreRecords: false,
    filters: [
      {
        id: 1,
        field: { type_id: 'data', description: 'Período' },
        operator: { allow_multiple_values: true, description: 'Entre', id: null },
        value: dataIni,
        value2: dataFim,
      },
    ],
  }

  const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=1`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Report ${reportId} falhou: ${resp.status} - ${txt.slice(0, 200)}`)
  }

  return resp.json()
}

async function main() {
  console.log('🔐 Autenticando...')
  const token = await getToken()
  console.log('✅ Token obtido\n')

  const dataIni = '2026-06-01'
  const dataFim = '2026-06-14'

  console.log(`📊 Analisando Report 183 - Demonstrativo de Vendas`)
  console.log(`📅 Período: ${dataIni} a ${dataFim}\n`)

  const result = await buildReport(token, 183, dataIni, dataFim)

  console.log('📋 COLUNAS:')
  result.columns.forEach((col, idx) => {
    console.log(`   [${idx}] ${col.title}`)
  })

  console.log(`\n📊 Total de registros: ${result.record_count}`)

  if (result.totalization_data && result.totalization_data.length > 0) {
    console.log('\n📈 TOTALIZAÇÕES:')
    result.totalization_data.forEach((tot, idx) => {
      console.log(`   [${idx}] ${tot.label}: ${tot.value} (formato: ${tot.format})`)
    })
  }

  if (result.data && result.data.length > 0) {
    console.log('\n📋 DADOS COMPLETOS:')
    console.log(JSON.stringify(result.data, null, 2))
  }

  // Salvar resultado completo para análise
  const fs = await import('fs/promises')
  await fs.writeFile(
    join(__dirname, 'report-183-result.json'),
    JSON.stringify(result, null, 2)
  )
  console.log('\n💾 Resultado completo salvo em report-183-result.json')
}

main().catch(console.error)
