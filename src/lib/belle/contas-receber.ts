import { getToken, HEADERS, BASE_URL } from './client-auth'

export interface ContasReceberTotal {
  totalBruto: number
  totalLiquido: number
  recebidas: number
}

/**
 * Busca totais do Controle de Contas a Receber
 * Menu: Financeiro → Controle de Contas a Receber
 *
 * IMPORTANTE: Usa período "Confirmação" (data de confirmação do pagamento)
 * não o período de venda/lançamento
 */
export async function getContasReceberTotais(
  email: string,
  senha: string,
  estab: number,
  dataIni: string,
  dataFim: string
): Promise<ContasReceberTotal> {
  const token = await getToken(email, senha)

  try {
    // Endpoint de Contas a Receber do Belle
    // Período: confirmacao (data de confirmação do pagamento)
    const params = new URLSearchParams({
      estabGeral: String(estab),
      dataInicial: dataIni,
      dataFinal: dataFim,
      periodo: 'confirmacao', // CHAVE: usar período de confirmação
      situacao: 'recebidas', // Apenas contas recebidas
    })

    const url = `${BASE_URL}/Financeiro/v1.0/contas-receber/totais?${params}`

    const resp = await fetch(url, {
      method: 'GET',
      headers: { ...HEADERS, Authorization: token },
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '')
      console.error(`Contas a Receber falhou: HTTP ${resp.status}`, errorText.slice(0, 200))
      throw new Error(`HTTP ${resp.status}`)
    }

    const data = await resp.json()

    // A estrutura da resposta depende do formato do Belle
    // Pode ser algo como: { totalBruto: 65311.80, totalLiquido: 65258.02, ... }
    return {
      totalBruto: data.totalBruto || data.valorTotalBruto || 0,
      totalLiquido: data.totalLiquido || data.valorTotalLiquido || 0,
      recebidas: data.recebidas || data.quantidadeRecebidas || 0,
    }
  } catch (error) {
    console.error('Erro ao buscar contas a receber:', error)

    // Se falhar, retornar zeros (unidade sem configuração)
    return {
      totalBruto: 0,
      totalLiquido: 0,
      recebidas: 0,
    }
  }
}
