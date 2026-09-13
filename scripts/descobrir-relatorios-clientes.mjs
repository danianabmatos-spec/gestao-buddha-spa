/**
 * Descobre quais relatórios Belle têm dados de sessão por cliente.
 * Execute: node scripts/descobrir-relatorios-clientes.mjs
 */

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller'
const EMAIL = 'adm.shoppingmetropole@buddhaspa.com.br'
const SENHA = 'Metr@1056'
const ESTAB = '1'

const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://app.bellesoftware.com.br',
  Referer: 'https://app.bellesoftware.com.br/',
  'x-from': 'app',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36',
}

async function getToken() {
  const resp = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ metodo: 'email', dados: { email: EMAIL, senha: SENHA } }),
  })
  if (!resp.ok) throw new Error(`Auth falhou: ${resp.status}`)
  const data = await resp.json()
  await fetch(`${BASE_URL}/Login/v1.0/admin/recuperar_dados?estabGeral=`, { headers: { ...HEADERS, Authorization: data.token } })
  await fetch(`${BASE_URL}/Login/v1.0/gravarsessao?estabGeral=`, {
    method: 'POST', headers: { ...HEADERS, Authorization: data.token }, body: JSON.stringify({}),
  })
  return data.token
}

async function listarRelatorios(token) {
  console.log('\n📋 Buscando lista de relatórios disponíveis...')

  // Endpoint mais comum para listar relatórios BI
  const endpoints = [
    `/BI/v1.0/report/list?estabGeral=${ESTAB}`,
    `/BI/v1.0/reports?estabGeral=${ESTAB}`,
    `/BI/v1.0/report?estabGeral=${ESTAB}`,
    `/BI/v1.0/lista_relatorios?estabGeral=${ESTAB}`,
  ]

  for (const ep of endpoints) {
    const resp = await fetch(`${BASE_URL}${ep}`, { headers: { ...HEADERS, Authorization: token } })
    console.log(`  ${ep} → HTTP ${resp.status}`)
    if (resp.ok) {
      const data = await resp.json()
      console.log('  ✅ Encontrou! Resposta:')
      console.log(JSON.stringify(data, null, 2).slice(0, 3000))
      return data
    }
  }
  console.log('  ⚠️  Nenhum endpoint de listagem funcionou')
  return null
}

async function testarRelatorio(token, reportId, descricao) {
  const dataIni = '2025-12-01'
  const dataFim = '2026-06-30'

  const payload = {
    reportId,
    sortColumn: null,
    sortOrder: 1,
    estab: ESTAB,
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

  console.log(`\n📊 Report ${reportId} — ${descricao}`)
  try {
    const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${ESTAB}`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })

    if (!resp.ok) {
      console.log(`  ❌ HTTP ${resp.status}`)
      return null
    }

    const data = await resp.json()
    const records = data.data || []
    const count = data.record_count || records.length

    console.log(`  ✅ ${count} registros`)
    console.log(`  Colunas: ${data.columns?.map(c => c.title).join(' | ')}`)

    if (records.length > 0) {
      console.log(`  Exemplo 1ª linha: ${JSON.stringify(records[0]).slice(0, 300)}`)
    }
    if (records.length > 1) {
      console.log(`  Exemplo 2ª linha: ${JSON.stringify(records[1]).slice(0, 300)}`)
    }

    return { count, columns: data.columns, sample: records.slice(0, 3) }
  } catch (err) {
    console.log(`  ⚠️  Timeout ou erro: ${err.message}`)
    return null
  }
}

// IDs candidatos para relatórios de clientes/atendimentos
const RELATORIOS_CANDIDATOS = [
  // Relatórios que provavelmente têm dados de cliente por sessão
  [200, 'Possível — Histórico de Clientes'],
  [201, 'Possível — Atendimentos por Cliente'],
  [202, 'Possível — Clientes Atendidos'],
  [203, 'Possível — Relatório de Clientes'],
  [204, 'Possível — Histórico de Sessões'],
  [205, 'Possível'],
  [210, 'Possível — Retenção de Clientes'],
  [215, 'Possível'],
  [220, 'Possível'],
  [225, 'Possível — Novos Clientes'],
  [230, 'Possível'],
  [235, 'Possível'],
  [240, 'Possível'],
  [250, 'Possível'],
  [260, 'Possível'],
  // Relatórios nomeados no mapeamento que ainda não sabemos o ID
  [193, 'Próximo ao Fidelização (192)'],
  [194, 'Próximo ao Fidelização'],
  [195, 'Próximo ao Fidelização'],
  [196, 'Possível — Novos Clientes'],
  [197, 'Possível'],
  [198, 'Possível'],
  [199, 'Possível'],
]

;(async () => {
  console.log('🔐 Autenticando na Belle...')
  const token = await getToken()
  console.log('✅ Token obtido\n')

  // Tenta listar relatórios primeiro
  await listarRelatorios(token)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔍 Testando relatórios candidatos...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const resultados = []

  for (const [id, desc] of RELATORIOS_CANDIDATOS) {
    const resultado = await testarRelatorio(token, id, desc)
    if (resultado && resultado.count > 0) {
      resultados.push({ id, desc, ...resultado })
    }
    // Pausa para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 300))
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ RELATÓRIOS COM DADOS ENCONTRADOS:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  for (const r of resultados) {
    console.log(`\n📊 Report ${r.id} — ${r.desc}`)
    console.log(`  Registros: ${r.count}`)
    console.log(`  Colunas: ${r.columns?.map(c => c.title).join(' | ')}`)
  }

  if (resultados.length === 0) {
    console.log('⚠️  Nenhum relatório retornou dados na faixa testada')
    console.log('Próximo passo: testar IDs na faixa 241xxxxxx (que é onde estão os relatórios Buddha)')
  }
})()
