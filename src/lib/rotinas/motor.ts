import { prisma } from '@/lib/prisma'

// ─── Motor de Rotinas ───────────────────────────────────────────────────────────
// Gera as tarefas do dia de cada unidade a partir do catálogo (RotinaTemplate) e
// aplica o acúmulo com alerta das não-feitas. Chamado de forma preguiçosa quando a
// tela "Rotina do Dia" é aberta (não depende de cron nem do Belle).

export type Area = 'COORDENACAO' | 'RECEPCAO'
export type StatusTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA'

/** Data local no formato YYYY-MM-DD (sem fuso UTC). */
export function hojeISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function diaDaSemana(dataRef: string): number {
  return new Date(`${dataRef}T00:00:00`).getDay() // 0=Dom..6=Sab
}
function diaDoMes(dataRef: string): number {
  return parseInt(dataRef.slice(8, 10), 10)
}
function diffDias(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00`).getTime()
  const b = new Date(`${bISO}T00:00:00`).getTime()
  return Math.round((a - b) / 86_400_000)
}
/** Prazo (YYYY-MM-DD) do dia-limite mensal no mês do dataRef. */
function prazoMensal(dataRef: string, diaLimite: number | null): string | null {
  if (!diaLimite) return null
  return `${dataRef.slice(0, 7)}-${String(diaLimite).padStart(2, '0')}`
}

/**
 * Garante que as tarefas do dia existam para a unidade (idempotente).
 * - DIÁRIA: uma instância ativa por template. Se sobrou uma aberta de dias
 *   anteriores, é CARREGADA para hoje (mantém dataOriginal → mede o atraso).
 * - SEMANAL: nasce quando hoje == diaSemana.
 * - MENSAL: nasce quando hoje == diaDoMes (com prazo = diaLimite).
 * - SOB_DEMANDA: nunca nasce sozinha (a coordenadora cria quando precisa).
 */
export async function ensureTarefasDoDia(unidadeId: number, dataRef = hojeISO()): Promise<void> {
  const templates = await prisma.rotinaTemplate.findMany({
    where: { ativa: true, OR: [{ unidadeId: null }, { unidadeId }] },
  })

  const dow = diaDaSemana(dataRef)
  const dom = diaDoMes(dataRef)

  for (const t of templates) {
    if (t.frequencia === 'SOB_DEMANDA') continue

    // Já existe instância de hoje? (idempotência)
    const deHoje = await prisma.tarefaRotina.findFirst({
      where: { unidadeId, templateId: t.id, dataRef },
      select: { id: true },
    })
    if (deHoje) continue

    if (t.frequencia === 'DIARIA') {
      // Carrega uma instância aberta de dias anteriores, se houver.
      const aberta = await prisma.tarefaRotina.findFirst({
        where: { unidadeId, templateId: t.id, status: { not: 'CONCLUIDA' }, dataRef: { lt: dataRef } },
        orderBy: { dataRef: 'desc' },
      })
      if (aberta) {
        await prisma.tarefaRotina.update({
          where: { id: aberta.id },
          data: { dataRef }, // mantém dataOriginal → atraso preservado
        })
        continue
      }
      await criarTarefa(t, unidadeId, dataRef)
    } else if (t.frequencia === 'SEMANAL') {
      if (t.diaSemana === dow) await criarTarefa(t, unidadeId, dataRef)
    } else if (t.frequencia === 'MENSAL') {
      if (t.diaDoMes === dom) await criarTarefa(t, unidadeId, dataRef, prazoMensal(dataRef, t.diaLimite))
    }
  }
}

async function criarTarefa(
  t: { id: number; titulo: string; descricao: string | null; area: string; frequencia: string; ordem: number; horaPrevista: string | null; alertaDias: number | null },
  unidadeId: number,
  dataRef: string,
  prazo: string | null = null,
): Promise<void> {
  try {
    await prisma.tarefaRotina.create({
      data: {
        unidadeId,
        templateId: t.id,
        area: t.area,
        titulo: t.titulo,
        descricao: t.descricao,
        frequencia: t.frequencia,
        ordem: t.ordem,
        dataRef,
        dataOriginal: dataRef,
        horaPrevista: t.horaPrevista,
        prazo,
        alertaDias: t.alertaDias,
      },
    })
  } catch {
    // corrida na geração (unique) — outra request já criou; ignora
  }
}

export interface TarefaComAtraso {
  id: number
  unidadeId: number
  templateId: number | null
  area: string
  titulo: string
  descricao: string | null
  frequencia: string | null
  ordem: number
  dataRef: string
  dataOriginal: string
  horaPrevista: string | null
  status: string
  origem: string
  criadoPorNome: string | null
  atribuidoArea: string | null
  prazo: string | null
  alertaDias: number | null
  acaoApp: string | null
  concluidaEm: Date | null
  concluidaPorNome: string | null
  observacao: string | null
  // calculados
  diasAtraso: number
  atrasada: boolean
  emAlerta: boolean
}

/**
 * Lista as tarefas visíveis "hoje" da unidade: as de hoje (qualquer status) + as
 * abertas que sobraram de dias anteriores (acúmulo). Já com atraso/alerta calculados
 * e ordenadas (área → ordem → hora).
 */
export async function listarTarefasDoDia(
  unidadeId: number,
  dataRef = hojeISO(),
  apenasDoDia = false,
): Promise<TarefaComAtraso[]> {
  const tarefas = await prisma.tarefaRotina.findMany({
    where: apenasDoDia
      ? { unidadeId, dataRef } // só o que pertence exatamente a este dia
      : {
          unidadeId,
          OR: [
            { dataRef },                                    // tudo de hoje
            { dataRef: { lt: dataRef }, status: { not: 'CONCLUIDA' } }, // acúmulo aberto
          ],
        },
  })

  // acaoApp vem do template (tarefas antigas podem ter a coluna vazia).
  const templateIds = [...new Set(tarefas.map((t) => t.templateId).filter((x): x is number => x != null))]
  const templates = templateIds.length
    ? await prisma.rotinaTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, acaoApp: true } })
    : []
  const acaoPorTemplate = new Map(templates.map((t) => [t.id, t.acaoApp]))

  const comAtraso = tarefas.map((t): TarefaComAtraso => {
    const aberta = t.status !== 'CONCLUIDA'
    // Atraso: se tem prazo (mensal), conta a partir dele; senão, a partir do dia de origem.
    const base = t.prazo ?? t.dataOriginal
    const diasAtraso = aberta ? Math.max(0, diffDias(dataRef, base)) : 0
    const atrasada = aberta && (t.prazo ? diffDias(dataRef, t.prazo) > 0 : t.dataOriginal < dataRef)
    const emAlerta = aberta && t.alertaDias != null && diasAtraso >= t.alertaDias
    const acaoApp = (t.templateId != null ? acaoPorTemplate.get(t.templateId) : null) ?? t.acaoApp ?? null
    return { ...t, acaoApp, diasAtraso, atrasada, emAlerta }
  })

  return comAtraso.sort((a, b) => {
    if (a.area !== b.area) return a.area === 'COORDENACAO' ? -1 : 1
    // não-concluídas antes das concluídas
    const ac = a.status === 'CONCLUIDA' ? 1 : 0
    const bc = b.status === 'CONCLUIDA' ? 1 : 0
    if (ac !== bc) return ac - bc
    if (a.ordem !== b.ordem) return a.ordem - b.ordem
    return (a.horaPrevista ?? '').localeCompare(b.horaPrevista ?? '')
  })
}
