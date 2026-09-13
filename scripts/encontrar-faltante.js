/**
 * Encontra vouchers que estão no WP mas não foram cruzados
 */

const fs = require('fs')
const path = require('path')

async function encontrar() {
  // 1. Busca dados cruzados
  const response = await fetch('http://localhost:3000/api/belle/vouchers-cruzados?unidade=shopping-metropole&dataIni=2026-06-01&dataFim=2026-06-15')
  const cruzados = await response.json()

  // 2. Carrega cache WordPress
  const cacheWP = JSON.parse(fs.readFileSync(path.join(__dirname, '../cache/vouchers.json'), 'utf-8'))
  const wpVouchers = cacheWP['2026-06-01_2026-06-15']?.vouchers || []

  // 3. Códigos que foram cruzados
  const codigosCruzados = new Set(cruzados.vouchers.map(v => v.codigo.toUpperCase().trim()))

  console.log(`WordPress: ${wpVouchers.length} vouchers`)
  console.log(`Cruzados: ${cruzados.vouchers.length} vouchers`)
  console.log(`\nVouchers no WP que NÃO foram cruzados:\n`)

  // 4. Verifica quais do WP não foram cruzados
  const naoEncontrados = []
  wpVouchers.forEach(v => {
    const codigo = v.codigo.toUpperCase().trim()
    if (!codigosCruzados.has(codigo)) {
      naoEncontrados.push({
        codigo: v.codigo,
        valorReembolso: v.valorReembolso,
        produto: v.produto,
        dataTerapia: v.dataTerapia
      })
    }
  })

  if (naoEncontrados.length === 0) {
    console.log('✅ Todos os vouchers do WP foram cruzados!')
  } else {
    naoEncontrados.forEach(v => {
      console.log(`${v.codigo} - R$ ${v.valorReembolso} - ${v.dataTerapia}`)
      console.log(`   Produto: ${v.produto}\n`)
    })
    console.log(`Total: R$ ${naoEncontrados.reduce((sum, v) => sum + v.valorReembolso, 0)}`)
  }
}

encontrar().catch(console.error)
