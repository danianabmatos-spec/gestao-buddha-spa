export interface BelleServico {
  cod_servico: number
  nome: string
  valor: string | number
  tempo: number
}

export interface BelleAgendamento {
  codAgenda: number
  nom_paciente: string
  celular: string
  email: string
  hrIni: string
  hrFim: string
  status: 'Atendido' | 'Confirmado' | 'Aguardando' | 'Cancelado' | 'Faltou' | 'Marcado' | ''
  nom_usuario: string
  lbServ: string
  sala: string
  arrServ: BelleServico[] | null
  obs?: string
  observacao?: string  // Campo onde a recepcionista anota o código do voucher
  voucher?: string     // "Voucher Nominal" quando foi registrado manualmente
}

export interface BelleProfissional {
  cod_profissional: string
  nome: string
  businessHours?: unknown[]
}

export interface BelleLoginResponse {
  token: string
  identidade: {
    nome: string
    email: string
  }
}

export interface DashboardKPIs {
  totalAgendamentos: number
  atendidos: number
  aguardando: number
  cancelados: number
  receitaEstimada: number
  ticketMedio: number
  taxaAtendimento: number
}

export interface AgendamentoPorHora {
  hora: string
  total: number
  atendidos: number
}

export interface TerapeutaStats {
  nome: string
  total: number
  atendidos: number
  cancelados: number
  receita: number
  taxa: number
}

export interface AgendamentosResponse {
  data: string
  unidade: string
  kpis: DashboardKPIs
  porHora: AgendamentoPorHora[]
  terapeutas: TerapeutaStats[]
  statusDistribuicao: { status: string; count: number }[]
  agendamentos: BelleAgendamento[]
}

export interface FaturamentoMensalResponse {
  periodo: { ini: string; fim: string }
  caixa: number
  totalPass: number
  gympass: number
  parcelasComerciais: number
  horasAtendimento: number
  vendasRecepcao: number
  totalBruto: number
  totalDesconto: number
  totalAReceber: number
  voucherSite?: number  // preenchido pelo /api/vouchers (WordPress)
}

export interface MetaMensalResponse {
  id: number
  unidadeId: number
  ano: number
  mes: number
  metaFaturamento: number
  metaHoras: number
  metaVendas: number
  premioFaturamento: number
  premioHoras: number
  premioVendas: number
}
