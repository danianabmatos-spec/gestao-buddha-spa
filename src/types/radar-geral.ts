/**
 * Tipos para o Radar Geral - Dashboard Consolidado
 */

export interface IndicadoresUnidade {
  slug: string
  nome: string
  faturamento: {
    caixa: number
    parcerias: number // TotalPass + Gympass
    totalPass: number
    gympass: number
    voucherSite: number
    total: number
  }
  vendasRecepcao: number // Vendas da recepção (vouchers + planos + produtos)
  ticketMedio: number
  horasAtendimento: number
  nps: number // NPS da unidade (0-100)
  notaGoogle: number // Rating do Google (0-5)
  totalAvaliacoesGoogle: number
  status: 'ativo' | 'sem-dados' | 'erro'
}

export interface RadarGeralData {
  periodo: {
    inicio: string // YYYY-MM-DD
    fim: string // YYYY-MM-DD
  }
  unidades: IndicadoresUnidade[]
  totalizadores: {
    faturamentoTotal: number
    horasTotais: number
    npsMedia: number
    notaGoogleMedia: number
  }
}

// Ordem de exibição das colunas no Radar Geral (definida pela Daniana):
// Higienópolis, Perdizes, Anália, Shop Anália, Mooca, Metrópole, Tatuapé.
export const UNIDADES_CONFIG = [
  {
    slug: 'higienopolis',
    nome: 'Higienópolis',
    cidade: 'São Paulo',
    cor: '#D78B18' // Dourado
  },
  {
    slug: 'perdizes',
    nome: 'Perdizes',
    cidade: 'São Paulo',
    cor: '#392617' // Terra
  },
  {
    slug: 'analia-franco',
    nome: 'Anália Franco',
    cidade: 'São Paulo',
    cor: '#D78B18' // Dourado
  },
  {
    slug: 'shopping-analia-franco',
    nome: 'Shopping Anália Franco',
    cidade: 'São Paulo',
    cor: '#425F1D' // Flora
  },
  {
    slug: 'mooca-plaza',
    nome: 'Mooca Plaza',
    cidade: 'São Paulo',
    cor: '#7E0000' // Marsala
  },
  {
    slug: 'shopping-metropole',
    nome: 'Shopping Metrópole',
    cidade: 'São Bernardo do Campo',
    cor: '#7E0000' // Marsala
  },
  {
    slug: 'tatuape-gomescardim',
    nome: 'Tatuapé Gomes Cardim',
    cidade: 'São Paulo',
    cor: '#DDC7A4' // Areia
  }
] as const
