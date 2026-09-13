/**
 * Filtros para vouchers do WordPress e Belle
 * Implementa a EXATA lógica do Navvii descoberta via inspeção
 */

export interface VoucherBase {
  codigo: string
  [key: string]: any
}

/**
 * Valida se um código de voucher é válido segundo o padrão do Navvii
 *
 * LÓGICA DESCOBERTA via inspeção do Navvii:
 * - ✓ ACEITA: TODOS os códigos, EXCETO os códigos omnichannel
 * - ✗ REJEITA: Apenas códigos numéricos longos começando com "1511779"
 *
 * Códigos válidos (aceitos):
 * - JBG56I6, MG8M6JS, F4JBK3F (WordPress e-commerce)
 * - METRO0390, METRO0277 (Vouchers internos)
 * - VF322379 (Outros sistemas)
 * - Qualquer outro código que NÃO seja 1511779...
 *
 * Códigos inválidos (rejeitados):
 * - 1511779504827395048280 (omnichannel - código numérico longo)
 * - 1511779504739395047400 (omnichannel - código numérico longo)
 * - Todos que começam com "1511779"
 *
 * @param codigo Código do voucher
 * @returns true se o código é válido
 */
export function isCodigoVoucherValido(codigo: string): boolean {
  if (!codigo || typeof codigo !== 'string') {
    return false
  }

  const codigoTrimmed = codigo.trim()

  // ÚNICA REGRA: Rejeita códigos que começam com "1511779" (omnichannel)
  if (codigoTrimmed.startsWith('1511779')) {
    return false
  }

  // Aceita todo o resto!
  return true
}

/**
 * Filtra lista de vouchers removendo códigos inválidos
 *
 * @param vouchers Lista de vouchers
 * @returns Lista filtrada apenas com vouchers válidos
 */
export function filtrarVouchersValidos<T extends VoucherBase>(vouchers: T[]): T[] {
  return vouchers.filter(v => isCodigoVoucherValido(v.codigo))
}

/**
 * Separa vouchers em válidos e inválidos
 *
 * @param vouchers Lista de vouchers
 * @returns Objeto com listas de válidos e inválidos
 */
export function separarVouchersValidosInvalidos<T extends VoucherBase>(
  vouchers: T[]
): { validos: T[]; invalidos: T[] } {
  const validos: T[] = []
  const invalidos: T[] = []

  for (const voucher of vouchers) {
    if (isCodigoVoucherValido(voucher.codigo)) {
      validos.push(voucher)
    } else {
      invalidos.push(voucher)
    }
  }

  return { validos, invalidos }
}
