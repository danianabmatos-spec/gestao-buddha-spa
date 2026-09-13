// Testar a função getVendasRecepcao
import { getVendasRecepcao } from './src/lib/belle/bi.ts'

const email = 'adm.shoppingmetropole@buddhaspa.com.br'
const senha = 'Metr@1056'
const estab = '1'
const dataIni = '2026-06-01'
const dataFim = '2026-06-14'

console.log('🛒 Buscando vendas da recepção...\n')

const vendas = await getVendasRecepcao(email, senha, estab, dataIni, dataFim)

console.log('📊 VENDAS DA RECEPÇÃO (Shopping Metrópole)')
console.log(`📅 Período: ${dataIni} a ${dataFim}\n`)

console.log('🎫 VOUCHERS:')
console.log(`   Quantidade: ${vendas.vouchers.quantidade}`)
console.log(`   Valor Bruto: R$ ${vendas.vouchers.valorBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
console.log(`   Valor Líquido: R$ ${vendas.vouchers.valorLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`)

console.log('📋 PLANOS:')
console.log(`   Quantidade: ${vendas.planos.quantidade}`)
console.log(`   Valor Bruto: R$ ${vendas.planos.valorBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
console.log(`   Valor Líquido: R$ ${vendas.planos.valorLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`)

console.log('🛍️ PRODUTOS:')
console.log(`   Quantidade: ${vendas.produtos.quantidade}`)
console.log(`   Valor Bruto: R$ ${vendas.produtos.valorBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
console.log(`   Valor Líquido: R$ ${vendas.produtos.valorLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`)

console.log('💰 TOTAL GERAL:')
console.log(`   Quantidade: ${vendas.total.quantidade}`)
console.log(`   Valor Bruto: R$ ${vendas.total.valorBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
console.log(`   Valor Líquido: R$ ${vendas.total.valorLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
