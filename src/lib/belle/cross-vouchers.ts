import { VoucherUsado } from './relatorio-vouchers'
import { getVoucherCacheFlexivel } from '@/lib/cache-vouchers'

export interface VoucherCruzado {
  // Dados do Belle
  codigo: string
  dataExecucao: string
  cliente: string
  produto: string
  valorReembolso: number
  idVenda: string

  // Dados do WordPress (se encontrado)
  dataVendaWP: string | null
  produtoWP: string | null

  // Status consolidado (lógica Navvii)
  status: 'Utilizado' // Todos que estão no Belle Report 2422 já foram utilizados
  formaValidacao: 'Automatico' | 'Manualmente'
  encontradoNoWP: boolean
}

/**
 * Cruza dados de vouchers do Belle com cache do WordPress
 *
 * LÓGICA NAVVII (100% igual):
 *
 * 1. Busca vouchers E-commerce usados no Belle (Report 2422)
 * 2. Para cada voucher do Belle:
 *    - Se código EXISTE no WordPress → MANUAL (recepcionista validou)
 *    - Se código NÃO EXISTE no WordPress → AUTOMÁTICO (sistema valida)
 *
 * Todos os vouchers que aparecem no Report 2422 já foram UTILIZADOS no Belle
 */
export function cruzarVouchersBelleComWordPress(
  vouchersBelle: VoucherUsado[],
  dataIni: string,
  dataFim: string
): VoucherCruzado[] {
  // Busca cache do WordPress (flexível por período)
  const cacheWP = getVoucherCacheFlexivel(dataIni, dataFim)

  // Cria Set com códigos do WordPress para busca rápida (case insensitive)
  const wpMap = new Map<string, any>()
  if (cacheWP && Array.isArray(cacheWP.vouchers)) {
    for (const voucher of cacheWP.vouchers as { codigo?: string }[]) {
      if (voucher.codigo) {
        wpMap.set(voucher.codigo.toUpperCase().trim(), voucher)
      }
    }
  }

  console.log(`🔍 Cruzamento Navvii: ${vouchersBelle.length} vouchers Belle × ${wpMap.size} vouchers WP`)
  console.log(`   Cache WP encontrado: ${cacheWP ? 'SIM' : 'NÃO'}`)
  console.log(`   Total vouchers no cache: ${cacheWP?.vouchers?.length || 0}`)
  console.log(`   Total reembolso cache: R$ ${cacheWP?.totalReembolso || 0}`)

  // DEBUG: Mostra primeiros códigos do WP
  const primeirosWP = Array.from(wpMap.keys()).slice(0, 10)
  console.log(`   Primeiros códigos WP: ${primeirosWP.join(', ')}`)

  // Cruza dados seguindo lógica Navvii
  const resultado: VoucherCruzado[] = []

  for (const belle of vouchersBelle) {
    const codigo = belle.codigoVoucher?.toUpperCase().trim()
    if (!codigo) continue

    // Verifica se existe no WordPress
    const voucherWP = wpMap.get(codigo)
    const existeNoWP = !!voucherWP

    // Formata data de execução para padrão BR
    const dataExecucaoBR = formatarDataBR(belle.dataExecucao)

    resultado.push({
      // Dados do Belle
      codigo,
      dataExecucao: dataExecucaoBR,
      cliente: belle.cliente,
      produto: belle.descricao,
      // ⚠️ CRÍTICO: valorReembolso vem do WORDPRESS, NÃO do Belle
      valorReembolso: voucherWP?.valorReembolso ?? 0,
      idVenda: belle.idVenda,

      // Dados do WordPress (se encontrado)
      dataVendaWP: voucherWP?.dataVenda || null,
      produtoWP: voucherWP?.produto || null,

      // Status consolidado (lógica Navvii)
      status: 'Utilizado', // Todos do Report 2422 já foram utilizados
      formaValidacao: existeNoWP ? 'Manualmente' : 'Automatico',
      encontradoNoWP: existeNoWP,
    })
  }

  // Estatísticas (igual ao Navvii)
  const stats = {
    total: resultado.length,
    validacaoManual: resultado.filter(v => v.formaValidacao === 'Manualmente').length,
    validacaoAutomatica: resultado.filter(v => v.formaValidacao === 'Automatico').length,
    valorTotal: resultado.reduce((sum, v) => sum + v.valorReembolso, 0),
  }

  console.log(`📊 Estatísticas (Navvii):`)
  console.log(`   Total: ${stats.total}`)
  console.log(`   Validação Manual: ${stats.validacaoManual}`)
  console.log(`   Validação Automática: ${stats.validacaoAutomatica}`)
  console.log(`   Valor Total: R$ ${stats.valorTotal.toFixed(2)}`)

  return resultado
}

/**
 * Formata data ISO para padrão brasileiro
 * "2026-06-01" → "01/06/2026"
 */
function formatarDataBR(dataISO: string): string {
  if (!dataISO) return ''
  const [ano, mes, dia] = dataISO.split('T')[0].split('-')
  return `${dia}/${mes}/${ano}`
}
