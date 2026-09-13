// Buscar o relatório [Buddha] Comissão de Vendas Detalhado
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
  const dataFim = '2026-06-13'

  console.log(`📅 Período: ${dataIni} a ${dataFim}\n`)
  console.log('🔍 Buscando relatório "Comissão de Vendas Detalhado"...\n')

  // Testar IDs em torno de relatórios conhecidos
  const reportIdsParaTestar = [
    192, 193, 194, 195, 196, 197, 198, 199, 200,
    241130699, 241166521, 241166522, 241166523,
  ]

  for (const reportId of reportIdsParaTestar) {
    try {
      console.log(`📊 Testando Report ID ${reportId}...`)
      const result = await buildReport(token, reportId, dataIni, dataFim)

      // Verificar se tem dados
      const temDados = result.record_count > 0 || (result.totalization_data && result.totalization_data.length > 0)

      if (temDados) {
        console.log(`✅ Report ${reportId} retornou dados!`)
        console.log(`   Registros: ${result.record_count}`)
        console.log(`   Totalizações: ${result.totalization_data?.length || 0}`)

        // Verificar se tem as palavras-chave do relatório de comissão
        const colunas = result.columns?.map(c => c.title.toLowerCase()).join(' ') || ''
        if (colunas.includes('comissão') || colunas.includes('vendas') ||
            colunas.includes('plano') || colunas.includes('voucher')) {

          console.log(`\n   🎯 POSSÍVEL RELATÓRIO DE COMISSÃO!`)
          console.log(`   Colunas: ${result.columns.map(c => c.title).join(', ')}`)

          if (result.totalization_data?.length > 0) {
            console.log('\n   📈 Totalizações:')
            result.totalization_data.forEach(tot => {
              console.log(`      - ${tot.label}: ${tot.value}`)
            })
          }

          if (result.data?.length > 0) {
            console.log(`\n   📋 Primeiras 3 linhas:`)
            result.data.slice(0, 3).forEach((row, idx) => {
              console.log(`      [${idx}]`, JSON.stringify(row))
            })
          }

          // Verificar se os valores batem com os esperados
          const totStr = JSON.stringify(result.totalization_data || []).toLowerCase()
          if (totStr.includes('4810') || totStr.includes('21093') || totStr.includes('27237')) {
            console.log(`\n   ⭐⭐⭐ ESTE É O RELATÓRIO CORRETO! ⭐⭐⭐`)
            console.log(`   Report ID: ${reportId}`)
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Report ${reportId}: ${error.message.slice(0, 80)}`)
    }
  }
}

main().catch(console.error)
