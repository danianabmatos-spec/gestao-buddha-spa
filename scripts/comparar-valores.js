/**
 * Compara valores de reembolso entre cache WP e sistema
 */

const fs = require('fs')
const path = require('path')

async function comparar() {
  // 1. Busca dados cruzados (Belle × WP)
  const response = await fetch('http://localhost:3000/api/belle/vouchers-cruzados?unidade=shopping-metropole&dataIni=2026-06-01&dataFim=2026-06-15')
  const cruzados = await response.json()

  // 2. Carrega cache WordPress original
  const cacheWP = JSON.parse(fs.readFileSync(path.join(__dirname, '../cache/vouchers.json'), 'utf-8'))
  const wpVouchers = cacheWP['2026-06-01_2026-06-15']?.vouchers || []

  // 3. Cria mapa de valores do WP
  const wpMap = new Map()
  wpVouchers.forEach(v => {
    wpMap.set(v.codigo.toUpperCase().trim(), v.valorReembolso)
  })

  console.log(`Cache WP: ${wpVouchers.length} vouchers = R$ ${cacheWP['2026-06-01_2026-06-15'].totalReembolso}`)
  console.log(`Sistema: ${cruzados.vouchers.length} vouchers = R$ ${cruzados.estatisticas.valorTotal}`)
  console.log(`\nDiferença: R$ ${cacheWP['2026-06-01_2026-06-15'].totalReembolso - cruzados.estatisticas.valorTotal}\n`)

  // 4. Compara valores
  let totalWP = 0
  let totalSistema = 0
  const diferencas = []

  cruzados.vouchers.forEach(v => {
    const codigo = v.codigo.toUpperCase().trim()
    const valorWP = wpMap.get(codigo) || 0
    const valorSistema = v.valorReembolso

    totalWP += valorWP
    totalSistema += valorSistema

    if (valorWP !== valorSistema) {
      diferencas.push({
        codigo: v.codigo,
        valorWP,
        valorSistema,
        diff: valorWP - valorSistema
      })
    }
  })

  console.log(`Total WP (dos vouchers cruzados): R$ ${totalWP}`)
  console.log(`Total Sistema: R$ ${totalSistema}`)
  console.log(`\nVouchers com valores diferentes:\n`)

  if (diferencas.length === 0) {
    console.log('✅ Todos os valores estão corretos!')
  } else {
    diferencas.forEach(d => {
      console.log(`${d.codigo}: WP=R$ ${d.valorWP} | Sistema=R$ ${d.valorSistema} | Diff=R$ ${d.diff}`)
    })
    console.log(`\nTotal diferença: R$ ${diferencas.reduce((sum, d) => sum + d.diff, 0)}`)
  }
}

comparar().catch(console.error)
