import { getTerapeutasFidelizacao } from '@/lib/belle/relatorio-fidelizacao'
import { getNPSPorProfissional } from '@/lib/belle/relatorio-nps'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getNaoTerapeutasRH, normalizarNome } from '@/lib/rh/terapeutas-ativos'

// Parte dos dados que vem do BELLE (cara/instável) — cacheada por unidade+semestre.
// A categoria (RH), as notas do gestor e os pesos são mesclados ao vivo na leitura.
export interface TerapeutaBelle {
  profissional: string
  horasAtendimento: number
  percServicosFidelizados: number
  nps: number
}

// Desligadas que fazem atendimento no Belle mas nunca foram cadastradas no RH.
const OCULTAR_MANUAL = new Set([
  'Isabela Annunciação Campos de Mendonça',
  'Bruna Bonifácio Silva',
  'Cristiane Vieira dos Santos',
].map(normalizarNome))

/**
 * Consulta o Belle (fidelização + NPS) de uma unidade/período e devolve a lista de
 * terapeutas ATIVOS já filtrada (denylist do RH + banho + ocultos). É a ÚNICA função
 * que bate no Belle — chamada só no "Atualizar agora", nunca na leitura da tela.
 */
export async function buscarTerapeutasBelle(
  unidade: string, dataIni: string, dataFim: string,
): Promise<TerapeutaBelle[]> {
  const credenciais = getUnidadeCredenciais(unidade)
  if (!credenciais) throw new Error('Unidade não encontrada')
  const { email, password: senha, estab } = credenciais

  const [fidelizacao, npsData, naoTerapeutas] = await Promise.all([
    getTerapeutasFidelizacao(email, senha, dataIni, dataFim, estab),
    getNPSPorProfissional(email, senha, dataIni, dataFim, estab),
    getNaoTerapeutasRH(),
  ])

  const npsPorNome = new Map(npsData.map(n => [normalizarNome(n.profissional), n.nps]))

  return fidelizacao
    .map(t => ({
      profissional: t.profissional,
      horasAtendimento: t.horasAtendimento,
      percServicosFidelizados: t.percServicosFidelizados,
      nps: npsPorNome.get(normalizarNome(t.profissional)) ?? 0,
    }))
    .filter(t => {
      const n = normalizarNome(t.profissional)
      if (n.includes('banho')) return false
      if (OCULTAR_MANUAL.has(n)) return false
      if (naoTerapeutas && naoTerapeutas.has(n)) return false
      return true
    })
}
