import type {
  BelleAgendamento,
  AgendamentosResponse,
  DashboardKPIs,
  AgendamentoPorHora,
  TerapeutaStats,
} from './types'

const STATUS_ATIVO = new Set(['Atendido', 'Confirmado', 'Aguardando', 'Marcado'])
const STATUS_CANCELADO = new Set(['Cancelado', 'Faltou'])

function valorServicos(ag: BelleAgendamento): number {
  if (!ag.arrServ || !Array.isArray(ag.arrServ)) return 0
  return ag.arrServ.reduce((acc, s) => {
    const v = parseFloat(String(s.valor).replace(',', '.'))
    return acc + (isNaN(v) ? 0 : v)
  }, 0)
}

export function calcularKPIs(agendamentos: BelleAgendamento[]): DashboardKPIs {
  const validos = agendamentos.filter(
    (a) => a.nom_usuario?.trim() && a.nom_paciente?.trim()
  )
  const atendidos = validos.filter((a) => a.status === 'Atendido')
  const cancelados = validos.filter((a) => STATUS_CANCELADO.has(a.status))
  const aguardando = validos.filter((a) => STATUS_ATIVO.has(a.status) && a.status !== 'Atendido')

  const receitaEstimada = atendidos.reduce((acc, a) => acc + valorServicos(a), 0)
  const ticketMedio = atendidos.length > 0 ? receitaEstimada / atendidos.length : 0
  const base = validos.length - cancelados.length
  const taxaAtendimento = base > 0 ? Math.round((atendidos.length / base) * 100) : 0

  return {
    totalAgendamentos: validos.length,
    atendidos: atendidos.length,
    aguardando: aguardando.length,
    cancelados: cancelados.length,
    receitaEstimada: Math.round(receitaEstimada * 100) / 100,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    taxaAtendimento,
  }
}

export function calcularPorHora(agendamentos: BelleAgendamento[]): AgendamentoPorHora[] {
  const mapa = new Map<string, { total: number; atendidos: number }>()

  for (const ag of agendamentos) {
    if (!ag.hrIni || !ag.nom_paciente?.trim()) continue
    const hora = ag.hrIni.slice(0, 2) + ':00'
    const atual = mapa.get(hora) ?? { total: 0, atendidos: 0 }
    atual.total++
    if (ag.status === 'Atendido') atual.atendidos++
    mapa.set(hora, atual)
  }

  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, v]) => ({ hora, ...v }))
}

export function calcularTerapeutas(agendamentos: BelleAgendamento[]): TerapeutaStats[] {
  const mapa = new Map<string, TerapeutaStats>()

  for (const ag of agendamentos) {
    const nome = ag.nom_usuario?.trim()
    if (!nome || !ag.nom_paciente?.trim()) continue

    const stats = mapa.get(nome) ?? { nome, total: 0, atendidos: 0, cancelados: 0, receita: 0, taxa: 0 }
    stats.total++
    if (ag.status === 'Atendido') {
      stats.atendidos++
      stats.receita += valorServicos(ag)
    }
    if (STATUS_CANCELADO.has(ag.status)) stats.cancelados++
    mapa.set(nome, stats)
  }

  return Array.from(mapa.values())
    .map((s) => ({
      ...s,
      receita: Math.round(s.receita * 100) / 100,
      taxa: s.total > 0 ? Math.round((s.atendidos / (s.total - s.cancelados || 1)) * 100) : 0,
    }))
    .sort((a, b) => b.atendidos - a.atendidos)
}

export function calcularStatusDistribuicao(agendamentos: BelleAgendamento[]) {
  const mapa = new Map<string, number>()
  for (const ag of agendamentos) {
    if (!ag.nom_paciente?.trim()) continue
    const s = ag.status || 'Sem status'
    mapa.set(s, (mapa.get(s) ?? 0) + 1)
  }
  return Array.from(mapa.entries()).map(([status, count]) => ({ status, count }))
}

export function processarAgendamentos(
  agendamentos: BelleAgendamento[],
  data: string,
  unidade: string
): AgendamentosResponse {
  return {
    data,
    unidade,
    kpis: calcularKPIs(agendamentos),
    porHora: calcularPorHora(agendamentos),
    terapeutas: calcularTerapeutas(agendamentos),
    statusDistribuicao: calcularStatusDistribuicao(agendamentos),
    agendamentos,
  }
}
