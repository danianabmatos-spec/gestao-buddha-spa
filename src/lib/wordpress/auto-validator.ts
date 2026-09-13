import type { Voucher } from './vouchers'
import type { VoucherUsado } from '@/lib/belle/relatorio-vouchers'

/**
 * Valida vouchers comparando WordPress com Relatório de Uso do Belle
 *
 * Lógica de validação (100% igual ao Navvii):
 *
 * 1. Busca vouchers E-commerce usados no Belle (Relatório de Uso)
 * 2. Para cada voucher E-commerce do Belle:
 *    - Se o código EXISTE no WordPress → MANUAL (recepcionista validou)
 *    - Se o código NÃO EXISTE no WordPress → AUTOMÁTICO (sistema valida)
 *
 * Vouchers tipo "Normal" no Belle são internos e não precisam validação WordPress
 */
export function validarVouchersComBelle(
  vouchersWordPress: Voucher[],
  vouchersUsadosBelle: VoucherUsado[]
): Voucher[] {
  // Cria Set com códigos do WordPress para busca rápida
  const codigosWordPress = new Set(
    vouchersWordPress.map(v => v.codigo.toUpperCase())
  )

  const vouchersValidados = vouchersWordPress.map(voucher => {
    // Já validado? Pula
    if (voucher.status === 'Validado' || voucher.status === 'Utilizado') {
      return voucher
    }

    // Procura o voucher no relatório de uso do Belle
    const voucherBelle = vouchersUsadosBelle.find(
      vb => vb.codigoVoucher?.toUpperCase() === voucher.codigo.toUpperCase()
    )

    if (!voucherBelle) {
      // Não foi usado no Belle ainda
      return voucher
    }

    // Voucher foi usado no Belle (tipo E-commerce)
    // Se está no WordPress → recepcionista validou manualmente
    // Como está aqui, significa que SIM está no WordPress → MANUAL
    return {
      ...voucher,
      status: 'Validado',
      formaValidacao: 'Manualmente',
    }
  })

  // Agora procura vouchers que estão no Belle mas NÃO no WordPress
  // Esses precisam ser validados automaticamente
  const vouchersAutomaticos: Voucher[] = []

  for (const voucherBelle of vouchersUsadosBelle) {
    if (!voucherBelle.codigoVoucher) continue

    // Verifica se o código do Belle está no WordPress
    const existeNoWordPress = codigosWordPress.has(voucherBelle.codigoVoucher.toUpperCase())

    if (!existeNoWordPress) {
      // Recepcionista lançou no Belle mas esqueceu de validar no WordPress
      // Criar voucher com validação automática
      vouchersAutomaticos.push({
        codigo: voucherBelle.codigoVoucher,
        produto: voucherBelle.descricao,
        dataTerapia: formatarDataBR(voucherBelle.dataExecucao),
        status: 'Validado',
        formaValidacao: 'Automatico',
        valorReembolso: voucherBelle.desconto,
      })
    }
  }

  // Combina todos os vouchers
  return [...vouchersValidados, ...vouchersAutomaticos]
}

/**
 * Formata data ISO para BR
 * "2026-06-01" → "01/06/2026"
 */
function formatarDataBR(dataISO: string): string {
  if (!dataISO) return ''
  const [ano, mes, dia] = dataISO.split('T')[0].split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Calcula estatísticas após validação
 */
export function calcularEstatisticas(vouchers: Voucher[]) {
  const validados = vouchers.filter(v => v.status === 'Validado' || v.status === 'Utilizado')
  const pendentes = vouchers.filter(v => v.status === 'Pendente' || !v.status)
  const automaticos = validados.filter(v => v.formaValidacao === 'Automatico')
  const manuais = validados.filter(v => v.formaValidacao === 'Manualmente')
  const totalReembolso = validados.reduce((sum, v) => sum + (v.valorReembolso || 0), 0)

  return {
    totalReembolso,
    totalValidados: validados.length,
    pendentesValidacao: pendentes.length,
    validacaoManual: manuais.length,
    validacaoAutomatica: automaticos.length,
  }
}
