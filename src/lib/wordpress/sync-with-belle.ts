import { getVouchersUsados, filtrarVouchersEcommerce } from '@/lib/belle/relatorio-vouchers'
import { validarVouchersComBelle } from './auto-validator'
import type { Voucher, VouchersResumo } from './vouchers'

interface BelleCredenciais {
  email: string
  senha: string
  estabelecimento: number
}

/**
 * Sincroniza vouchers do WordPress com Relatório de Uso do Belle
 * para determinar validação automática vs manual
 */
export async function syncVouchersComBelle(
  vouchers: Voucher[],
  dataIni: string,
  dataFim: string,
  belleCredenciais: BelleCredenciais
): Promise<Voucher[]> {
  try {
    const { email, senha, estabelecimento } = belleCredenciais

    console.log(`[Belle] Buscando relatório de vouchers usados de ${dataIni} a ${dataFim}`)

    // Busca relatório de vouchers usados do Belle
    const vouchersUsados = await getVouchersUsados(
      email,
      senha,
      dataIni,
      dataFim,
      estabelecimento
    )

    console.log(`[Belle] ${vouchersUsados.length} vouchers usados encontrados`)

    // Filtra apenas vouchers E-commerce (do site)
    const vouchersEcommerce = filtrarVouchersEcommerce(vouchersUsados)

    console.log(`[Belle] ${vouchersEcommerce.length} vouchers E-commerce`)

    // Aplica validação
    const vouchersValidados = validarVouchersComBelle(vouchers, vouchersEcommerce)

    const stats = {
      total: vouchersValidados.length,
      automaticos: vouchersValidados.filter(v => v.formaValidacao === 'Automatico').length,
      manuais: vouchersValidados.filter(v => v.formaValidacao === 'Manualmente').length,
      pendentes: vouchersValidados.filter(v => v.status === 'Pendente').length,
    }

    console.log('[Belle] Validação concluída:', stats)

    return vouchersValidados
  } catch (error) {
    console.error('[Belle] Erro ao sincronizar:', error)
    // Em caso de erro, retorna vouchers originais
    return vouchers
  }
}

/**
 * Atualiza estatísticas do resumo após validação com Belle
 */
export function atualizarEstatisticas(
  resumo: VouchersResumo,
  vouchersValidados: Voucher[]
): VouchersResumo {
  const validados = vouchersValidados.filter(v => v.status === 'Validado' || v.status === 'Utilizado')
  const automaticos = validados.filter(v => v.formaValidacao === 'Automatico')
  const manuais = validados.filter(v => v.formaValidacao === 'Manualmente')
  const pendentes = vouchersValidados.filter(v => v.status === 'Pendente' || !v.status)

  return {
    ...resumo,
    vouchers: vouchersValidados,
    totalValidados: validados.length,
    validacaoAutomatica: automaticos.length,
    validacaoManual: manuais.length,
    pendentesValidacao: pendentes.length,
  }
}
