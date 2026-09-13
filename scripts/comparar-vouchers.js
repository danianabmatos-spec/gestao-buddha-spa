/**
 * Compara vouchers do Belle vs WordPress
 * Mostra quais estão no Belle mas NÃO estão no WP
 */

const fs = require('fs')
const path = require('path')

async function comparar() {
  // 1. Busca vouchers do Belle
  const response = await fetch('http://localhost:3000/api/belle/vouchers-usados?unidade=shopping-metropole&dataIni=2026-06-01&dataFim=2026-06-15')
  const belle = await response.json()

  // 2. Carrega cache do WordPress
  const cacheWP = JSON.parse(fs.readFileSync(path.join(__dirname, '../cache/vouchers.json'), 'utf-8'))
  const wpVouchers = cacheWP['2026-06-01_2026-06-15']?.vouchers || []

  // 3. Códigos do WP
  const codigosWP = new Set(wpVouchers.map(v => v.codigo?.toUpperCase().trim()))

  const belleVouchers = belle.data?.vouchers || belle.vouchers || []

  console.log(`Belle: ${belleVouchers.length} vouchers`)
  console.log(`WordPress: ${wpVouchers.length} vouchers`)
  console.log(`\nVouchers do Belle que NÃO estão no WordPress:\n`)

  // 4. Verifica quais do Belle não estão no WP
  const faltando = []
  belleVouchers.forEach(v => {
    const codigo = v.codigoVoucher?.toUpperCase().trim()
    if (codigo && !codigosWP.has(codigo)) {
      faltando.push({
        codigo: v.codigoVoucher,
        data: v.dataExecucao,
        cliente: v.cliente.substring(0, 40)
      })
    }
  })

  if (faltando.length === 0) {
    console.log('✅ Todos os vouchers do Belle estão no WordPress!')
  } else {
    faltando.forEach((v, i) => {
      console.log(`${i + 1}. ${v.codigo} - ${v.data} - ${v.cliente}`)
    })
  }
}

comparar().catch(console.error)
