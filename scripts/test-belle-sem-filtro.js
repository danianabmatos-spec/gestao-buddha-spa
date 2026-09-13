/**
 * Testa Belle Report 2422 SEM filtros de data
 * para verificar quais datas estão disponíveis no sistema
 */

async function testReportSemFiltro() {
  // 1. Autentica
  const authResp = await fetch('https://api.belle.app/auth/v1.0/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: 'adm@buddhaspa-shoppingmetropole.com.br',
      password: 'Buddha',
      company: 'buddhaspa-shoppingmetropole'
    })
  })

  const authData = await authResp.json()
  const token = authData.token

  console.log('✅ Autenticado no Belle')

  // 2. Busca report SEM filtros de data
  const payload = {
    reportId: 2422,
    sortColumn: null,
    sortOrder: 1,
    estab: '241153509',
    filters: [],
    ignoreRecords: false
  }

  const resp = await fetch('https://api.belle.app/BI/v1.0/report/build?estabGeral=241153509', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(payload)
  })

  const data = await resp.json()
  const records = data.data || []

  console.log(`\n📊 Total de registros SEM filtro: ${records.length}`)

  // 3. Analisa as datas únicas
  const datas = new Set()
  records.forEach(record => {
    const dataExec = String(record[2] || '')
    if (dataExec) datas.add(dataExec)
  })

  const datasOrdenadas = Array.from(datas).sort()

  console.log(`\n📅 Datas únicas encontradas: ${datasOrdenadas.length}`)
  console.log('\nPrimeiras 20 datas:')
  datasOrdenadas.slice(0, 20).forEach(d => console.log(`  - ${d}`))

  console.log('\nÚltimas 20 datas:')
  datasOrdenadas.slice(-20).forEach(d => console.log(`  - ${d}`))

  // 4. Filtra manualmente por junho 2026
  const junho2026 = records.filter(r => {
    const dataExec = String(r[2] || '')
    return dataExec >= '2026-06-01' && dataExec <= '2026-06-15'
  })

  console.log(`\n🔍 Vouchers em junho 2026 (01-15): ${junho2026.length}`)

  // 5. Distribuição por data em junho
  const distJunho = {}
  junho2026.forEach(r => {
    const dataExec = String(r[2] || '')
    distJunho[dataExec] = (distJunho[dataExec] || 0) + 1
  })

  console.log('\nDistribuição por data (junho 01-15):')
  Object.keys(distJunho).sort().forEach(data => {
    console.log(`  ${data}: ${distJunho[data]} vouchers`)
  })

  // 6. Extrai códigos de voucher de junho
  console.log('\n📝 Códigos de voucher encontrados (junho 01-15):')
  junho2026.forEach(r => {
    const origemDesconto = String(r[9] || '')
    const match = origemDesconto.match(/voucher:\s*([A-Z0-9]+)/i)
    if (match) {
      console.log(`  ${match[1]} - Data: ${r[2]}`)
    }
  })
}

testReportSemFiltro().catch(console.error)
