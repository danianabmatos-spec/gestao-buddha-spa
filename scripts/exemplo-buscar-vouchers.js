/**
 * EXEMPLO: Como buscar vouchers de qualquer unidade
 *
 * Este script demonstra como usar a função getVouchersUsados
 * para qualquer uma das 7 unidades Buddha Spa.
 *
 * USO:
 * node scripts/exemplo-buscar-vouchers.js
 */

import { getVouchersUsados, filtrarVouchersEcommerce } from '../src/lib/belle/relatorio-vouchers.js'
import { getUnidadeCredenciais } from '../src/lib/belle/unidades-config.js'

async function buscarVouchers() {
  // ========================================
  // CONFIGURAÇÃO - Altere aqui
  // ========================================

  const UNIDADE = 'shopping-metropole'  // Slug da unidade
  const DATA_INI = '2026-06-01'         // Data inicial (YYYY-MM-DD)
  const DATA_FIM = '2026-06-15'         // Data final (YYYY-MM-DD)

  // ========================================

  console.log(`\n🎫 Buscando vouchers: ${UNIDADE}`)
  console.log(`📅 Período: ${DATA_INI} a ${DATA_FIM}\n`)

  // 1. Busca credenciais da unidade
  const config = getUnidadeCredenciais(UNIDADE)

  if (!config) {
    console.error('❌ Unidade não encontrada!')
    console.log('\nUnidades válidas:')
    console.log('  - shopping-metropole')
    console.log('  - analia-franco')
    console.log('  - shopping-analia-franco')
    console.log('  - perdizes')
    console.log('  - tatuape-gomescardim')
    console.log('  - mooca-plaza')
    console.log('  - higienopolis')
    process.exit(1)
  }

  // 2. Busca vouchers do Belle (TODAS as páginas)
  const todosVouchers = await getVouchersUsados(
    config.email,
    config.password,
    DATA_INI,
    DATA_FIM,
    config.estab
  )

  // 3. Filtra vouchers válidos (remove códigos 1511779)
  const vouchersValidos = filtrarVouchersEcommerce(todosVouchers)

  // 4. Mostra resultados
  console.log('📊 RESULTADOS:\n')
  console.log(`  Total (bruto):     ${todosVouchers.length} vouchers`)
  console.log(`  Válidos:           ${vouchersValidos.length} vouchers`)
  console.log(`  Removidos:         ${todosVouchers.length - vouchersValidos.length} vouchers (códigos 1511779)\n`)

  // 5. Distribuição por data
  const porData = {}
  vouchersValidos.forEach(v => {
    const data = v.dataExecucao
    porData[data] = (porData[data] || 0) + 1
  })

  console.log('📅 Distribuição por data:')
  Object.keys(porData).sort().forEach(data => {
    console.log(`  ${data}: ${porData[data]} vouchers`)
  })

  // 6. Valor total
  const valorTotal = vouchersValidos.reduce((sum, v) => sum + v.desconto, 0)
  console.log(`\n💰 Valor total em descontos: R$ ${valorTotal.toFixed(2)}`)

  // 7. Exemplo: Primeiros 5 vouchers
  console.log('\n📝 Primeiros 5 vouchers:\n')
  vouchersValidos.slice(0, 5).forEach((v, i) => {
    console.log(`${i + 1}. ${v.codigoVoucher} - ${v.cliente.substring(0, 30)}`)
    console.log(`   Data: ${v.dataExecucao} | Desconto: R$ ${v.desconto}\n`)
  })

  console.log('✅ Concluído!\n')
}

// Executa
buscarVouchers().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})

// ========================================
// EXEMPLOS DE USO AVANÇADO
// ========================================

/**
 * Exemplo 1: Exportar para CSV
 */
async function exportarCSV() {
  const config = getUnidadeCredenciais('shopping-metropole')
  const vouchers = await getVouchersUsados(config.email, config.password, '2026-06-01', '2026-06-15', config.estab)
  const validos = filtrarVouchersEcommerce(vouchers)

  const csv = [
    'Codigo,Data,Cliente,Descricao,Valor',
    ...validos.map(v => `${v.codigoVoucher},${v.dataExecucao},"${v.cliente}","${v.descricao}",${v.desconto}`)
  ].join('\n')

  require('fs').writeFileSync('vouchers.csv', csv)
  console.log('✅ Exportado para vouchers.csv')
}

/**
 * Exemplo 2: Buscar múltiplas unidades
 */
async function buscarTodasUnidades() {
  const unidades = [
    'shopping-metropole',
    'analia-franco',
    'shopping-analia-franco',
    'perdizes',
    'tatuape-gomescardim',
    'mooca-plaza',
    'higienopolis'
  ]

  const resultados = {}

  for (const unidade of unidades) {
    const config = getUnidadeCredenciais(unidade)
    const vouchers = await getVouchersUsados(config.email, config.password, '2026-06-01', '2026-06-15', config.estab)
    const validos = filtrarVouchersEcommerce(vouchers)

    resultados[unidade] = {
      total: vouchers.length,
      validos: validos.length,
      valor: validos.reduce((sum, v) => sum + v.desconto, 0)
    }
  }

  console.log('📊 RESUMO POR UNIDADE:\n')
  Object.entries(resultados).forEach(([unidade, dados]) => {
    console.log(`${unidade}:`)
    console.log(`  Vouchers: ${dados.validos}`)
    console.log(`  Valor: R$ ${dados.valor.toFixed(2)}\n`)
  })
}

/**
 * Exemplo 3: Filtrar por valor mínimo
 */
async function buscarVouchersAcimaDe(valorMinimo) {
  const config = getUnidadeCredenciais('shopping-metropole')
  const vouchers = await getVouchersUsados(config.email, config.password, '2026-06-01', '2026-06-15', config.estab)
  const validos = filtrarVouchersEcommerce(vouchers)

  const acimaDe = validos.filter(v => v.desconto >= valorMinimo)

  console.log(`\n💰 Vouchers com desconto >= R$ ${valorMinimo}:`)
  console.log(`Total: ${acimaDe.length} vouchers\n`)

  acimaDe.forEach(v => {
    console.log(`${v.codigoVoucher}: R$ ${v.desconto} - ${v.cliente}`)
  })
}
