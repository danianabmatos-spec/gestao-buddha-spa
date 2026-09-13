import { prisma } from '@/lib/prisma'
import { hojeISO } from './motor'

// ─── Calendário do Mês ──────────────────────────────────────────────────────────
// Projeta o catálogo de rotinas (RotinaTemplate) sobre os dias de um mês E cruza
// com a execução real (TarefaRotina) para mostrar, de forma visual, o que já foi
// feito, o que está atrasado e o que ainda vai acontecer. Também traz as atividades
// SOB DEMANDA / delegadas que estão em aberto. As DIÁRIAS aparecem só na legenda.
//
// Flexível por unidade: os templates com `unidadeId` preenchido valem só para
// aquela unidade; os com `unidadeId = null` valem para todas (catálogo geral).

export type Area = 'COORDENACAO' | 'RECEPCAO'

// Estado visual de cada atividade:
// - concluida: registrada como feita (verde)
// - atrasada:  passou do prazo e não consta como concluída (vermelho)
// - pendente:  é para fazer hoje ou está dentro da janela do prazo (dourado)
// - planejada: ainda vai acontecer, no futuro (areia)
export type EstadoEvento = 'concluida' | 'atrasada' | 'pendente' | 'planejada'

export interface EventoCalendario {
  templateId: number | null
  tarefaId?: number | null // quando é uma tarefa real (sob demanda/delegada)
  chave: string
  titulo: string
  descricao: string | null
  area: string
  frente: string | null
  origemAcao: 'catalogo' | 'sob-demanda' | 'delegada'
  tipo: 'semanal' | 'mensal-inicio' | 'mensal-limite' | 'avulsa'
  ateDia?: number | null
  dataAcaoISO: string // dia em que a tarefa real vive (para abrir/checar status)
  deadlineISO: string // último dia para concluir (base do atraso)
  estado: EstadoEvento
  concluidaPorNome?: string | null
}

export interface DiaCalendario {
  dia: number
  dataISO: string
  diaSemana: number // 0=Dom..6=Sab
  hoje: boolean
  passado: boolean
  eventos: EventoCalendario[]
}

export interface RotinaDiaria {
  chave: string; titulo: string; area: string; frente: string | null
}

export interface ResumoMes {
  concluidas: number; atrasadas: number; pendentes: number; planejadas: number
}

export interface CalendarioMes {
  ano: number
  mes: number // 1..12
  totalDias: number
  primeiroDiaSemana: number // diaSemana do dia 1 (offset da grade)
  dias: DiaCalendario[]
  diarias: RotinaDiaria[]
  resumo: ResumoMes
}

const pad = (n: number) => String(n).padStart(2, '0')

function addDiasISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function calcularEstado(concluida: boolean, birthISO: string, deadlineISO: string, hoje: string): EstadoEvento {
  if (concluida) return 'concluida'
  if (hoje > deadlineISO) return 'atrasada' // prazo passou e não está concluída
  if (hoje >= birthISO) return 'pendente' // hoje ou dentro da janela do prazo
  return 'planejada' // ainda vai acontecer
}

/** Monta a projeção do mês (ano, mes 1..12) para a unidade, já com status real. */
export async function montarCalendarioMes(
  unidadeId: number,
  ano: number,
  mes: number,
  hoje = hojeISO(),
): Promise<CalendarioMes> {
  const mm = pad(mes)
  const prefixoMes = `${ano}-${mm}-`

  const [templates, tarefas, extras] = await Promise.all([
    prisma.rotinaTemplate.findMany({
      where: { ativa: true, OR: [{ unidadeId: null }, { unidadeId }] },
      orderBy: [{ area: 'asc' }, { ordem: 'asc' }],
    }),
    // Execução real do catálogo no mês: casa por (template + dia de origem).
    prisma.tarefaRotina.findMany({
      where: { unidadeId, templateId: { not: null }, dataOriginal: { startsWith: prefixoMes } },
      select: { templateId: true, dataOriginal: true, status: true, concluidaPorNome: true },
    }),
    // Atividades sob demanda / avulsas / delegadas EM ABERTO.
    prisma.tarefaRotina.findMany({
      where: {
        unidadeId,
        status: { not: 'CONCLUIDA' },
        OR: [{ frequencia: 'SOB_DEMANDA' }, { frequencia: 'AVULSA' }, { origem: 'DELEGADA' }, { templateId: null }],
      },
      select: {
        id: true, titulo: true, descricao: true, area: true, origem: true,
        dataRef: true, dataOriginal: true, prazo: true, alertaDias: true,
      },
    }),
  ])

  const mapaTarefa = new Map<string, { status: string; concluidaPorNome: string | null }>()
  for (const t of tarefas) {
    mapaTarefa.set(`${t.templateId}|${t.dataOriginal}`, { status: t.status, concluidaPorNome: t.concluidaPorNome })
  }

  const totalDias = new Date(ano, mes, 0).getDate()
  const mkISO = (d: number) => `${ano}-${mm}-${pad(d)}`
  const dowOf = (d: number) => new Date(`${mkISO(d)}T00:00:00`).getDay()
  const fimDoMesISO = mkISO(totalDias)

  // Agrupa as atividades sob demanda / delegadas pelo dia em que aparecem
  // (prazo, ou dia de criação se não houver prazo), dentro do mês visível.
  const extrasPorDia = new Map<string, EventoCalendario[]>()
  for (const e of extras) {
    const displayISO = e.prazo || e.dataOriginal
    if (!displayISO.startsWith(prefixoMes)) continue // v1: só o que cai neste mês
    const deadlineISO = e.prazo || (e.alertaDias ? addDiasISO(e.dataOriginal, e.alertaDias) : fimDoMesISO)
    const evento: EventoCalendario = {
      templateId: null, tarefaId: e.id, chave: `tarefa-${e.id}`,
      titulo: e.titulo, descricao: e.descricao, area: e.area, frente: null,
      origemAcao: e.origem === 'DELEGADA' ? 'delegada' : 'sob-demanda', tipo: 'avulsa',
      dataAcaoISO: e.dataRef, deadlineISO,
      estado: calcularEstado(false, e.dataOriginal, deadlineISO, hoje),
    }
    const lista = extrasPorDia.get(displayISO) ?? []
    lista.push(evento)
    extrasPorDia.set(displayISO, lista)
  }

  const resumo: ResumoMes = { concluidas: 0, atrasadas: 0, pendentes: 0, planejadas: 0 }

  const montarDoCatalogo = (
    t: (typeof templates)[number],
    dataISO: string,
    tipo: EventoCalendario['tipo'],
    birthISO: string,
    deadlineISO: string,
    tituloOverride?: string,
  ): EventoCalendario => {
    const reg = mapaTarefa.get(`${t.id}|${birthISO}`)
    return {
      templateId: t.id, chave: t.chave, titulo: tituloOverride ?? t.titulo, descricao: t.descricao,
      area: t.area, frente: t.frente, origemAcao: 'catalogo', tipo,
      ateDia: t.diaLimite ?? null, dataAcaoISO: birthISO, deadlineISO,
      estado: calcularEstado(reg?.status === 'CONCLUIDA', birthISO, deadlineISO, hoje),
      concluidaPorNome: reg?.concluidaPorNome ?? null,
    }
  }

  const dias: DiaCalendario[] = []
  for (let d = 1; d <= totalDias; d++) {
    const dataISO = mkISO(d)
    const dow = dowOf(d)
    const eventos: EventoCalendario[] = []

    for (const t of templates) {
      if (t.frequencia === 'SEMANAL') {
        if (t.diaSemana === dow) eventos.push(montarDoCatalogo(t, dataISO, 'semanal', dataISO, dataISO))
      } else if (t.frequencia === 'MENSAL') {
        if (t.diaDoMes === d) {
          const deadlineISO = t.diaLimite ? mkISO(t.diaLimite) : fimDoMesISO
          eventos.push(montarDoCatalogo(t, dataISO, 'mensal-inicio', dataISO, deadlineISO))
        } else if (t.diaLimite != null && t.diaLimite === d && t.diaDoMes !== d) {
          const birthISO = mkISO(t.diaDoMes ?? d)
          eventos.push(montarDoCatalogo(t, dataISO, 'mensal-limite', birthISO, dataISO, `${t.titulo} — prazo final`))
        }
      }
    }

    // Sob demanda / delegadas em aberto que caem neste dia.
    for (const ex of extrasPorDia.get(dataISO) ?? []) eventos.push(ex)

    for (const e of eventos) {
      if (e.tipo === 'mensal-limite') continue // não conta 2x
      if (e.estado === 'concluida') resumo.concluidas++
      else if (e.estado === 'atrasada') resumo.atrasadas++
      else if (e.estado === 'pendente') resumo.pendentes++
      else resumo.planejadas++
    }

    dias.push({ dia: d, dataISO, diaSemana: dow, hoje: dataISO === hoje, passado: dataISO < hoje, eventos })
  }

  const diarias: RotinaDiaria[] = templates
    .filter((t) => t.frequencia === 'DIARIA')
    .map((t) => ({ chave: t.chave, titulo: t.titulo, area: t.area, frente: t.frente }))

  return { ano, mes, totalDias, primeiroDiaSemana: dowOf(1), dias, diarias, resumo }
}
