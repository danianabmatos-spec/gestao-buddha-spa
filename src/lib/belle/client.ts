import type { BelleAgendamento, BelleProfissional } from './types'
import { getToken, HEADERS, BASE_URL } from './client-auth'

async function getGrid(token: string, estab: number): Promise<BelleProfissional[]> {
  const resp = await fetch(
    `${BASE_URL}/Agenda/v1.0/grid?etb=${estab}&restringe=0&estabGeral=${estab}`,
    { headers: { ...HEADERS, Authorization: token } }
  )
  if (!resp.ok) return []
  return resp.json()
}

async function getTurnos(token: string, codProfissional: string, data: string, estab: number): Promise<unknown[]> {
  const resp = await fetch(
    `${BASE_URL}/Buscas/v1.0/turnos_validos?cod=${codProfissional}&tpAgd=p&dtAgenda=${data}&estabGeral=${estab}`,
    { headers: { ...HEADERS, Authorization: token } }
  )
  if (!resp.ok) return []
  return resp.json()
}

export async function getAgendamentos(
  email: string,
  senha: string,
  data: string,
  estab: number
): Promise<BelleAgendamento[]> {
  const token = await getToken(email, senha)
  const grid = await getGrid(token, estab)

  await Promise.all(
    grid.map(async (prof) => {
      prof.businessHours = await getTurnos(token, prof.cod_profissional, data, estab)
    })
  )

  const payload = {
    semFinaliz: false,
    canc: false,
    finaliz: false,
    finan: false,
    semFinan: false,
    tpAgenda: 'prof',
    tp: '0',
    dtAgenda: data,
    arrGrid: grid,
    corAgenda: 'ct',
    destacarInad: '',
    destacarPendCont: 0,
    destacarNaoPreencQuest: 0,
    corInad: '',
    corPendContrato: '',
    corAgendSemQuest: null,
    exibir_pc_agenda: '1',
    verTodas: 1,
    destacarNomeInad: '',
    teleatendimento: 0,
    etb: String(estab),
  }

  const resp = await fetch(`${BASE_URL}/Agenda/v1.0/agendaapi?estabGeral=${estab}`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error(`Belle agendaapi failed: ${resp.status}`)
  return resp.json()
}

// ─── Agendamentos futuros (versão LEVE, para a trava anti-mensagem-errada) ───────
// Reusa token + grid e PULA getTurnos (que só afeta a exibição de horários livres;
// os agendamentos marcados vêm no build mesmo assim). Custo: 1 token + 1 grid + N builds.

async function buildAgendaDia(token: string, estab: number, data: string, grid: BelleProfissional[]): Promise<BelleAgendamento[]> {
  const payload = {
    semFinaliz: false, canc: false, finaliz: false, finan: false, semFinan: false,
    tpAgenda: 'prof', tp: '0', dtAgenda: data, arrGrid: grid, corAgenda: 'ct',
    destacarInad: '', destacarPendCont: 0, destacarNaoPreencQuest: 0, corInad: '',
    corPendContrato: '', corAgendSemQuest: null, exibir_pc_agenda: '1', verTodas: 1,
    destacarNomeInad: '', teleatendimento: 0, etb: String(estab),
  }
  const resp = await fetch(`${BASE_URL}/Agenda/v1.0/agendaapi?estabGeral=${estab}`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  })
  if (!resp.ok) return []
  return resp.json()
}

// Status que contam como agendamento futuro "de pé" (não cancelado/faltou/atendido)
const STATUS_AGENDADO = new Set(['Marcado', 'Confirmado', 'Aguardando'])

/** Nomes (lowercase) de clientes com agendamento futuro nos próximos `dias`. Best-effort. */
export interface AgendamentosFuturos {
  nomes: Set<string>      // nom_paciente normalizado (fallback)
  telefones: Set<string>  // celular só-dígitos (match robusto, evita homônimo/acento)
}

// Nomes E telefones de quem tem agendamento futuro (status Marcado/Confirmado/Aguardando).
// Lança se não conseguir ler a agenda (token/grid) — o motor aborta o sync nesse caso,
// para NÃO liberar todo mundo por engano (fail-safe: mantém os dados anteriores).
export async function getAgendamentosFuturos(
  email: string, senha: string, estab: number, dias: number,
): Promise<AgendamentosFuturos> {
  const nomes = new Set<string>()
  const telefones = new Set<string>()
  if (dias <= 0) return { nomes, telefones }

  const token = await getToken(email, senha)
  const grid = await getGrid(token, estab)
  if (grid.length === 0) return { nomes, telefones }

  const hoje = new Date()
  const datas: string[] = []
  for (let i = 0; i <= dias; i++) {
    const d = new Date(hoje); d.setDate(hoje.getDate() + i)
    datas.push(d.toISOString().slice(0, 10))
  }

  const BATCH = 4
  for (let i = 0; i < datas.length; i += BATCH) {
    const resultados = await Promise.all(
      datas.slice(i, i + BATCH).map((data) => buildAgendaDia(token, estab, data, grid).catch(() => [] as BelleAgendamento[])),
    )
    for (const ags of resultados) {
      for (const ag of ags) {
        if (!STATUS_AGENDADO.has(ag.status)) continue
        if (ag.nom_paciente) nomes.add(ag.nom_paciente.trim().toLowerCase())
        const tel = String(ag.celular ?? '').replace(/\D/g, '')
        if (tel.length >= 10) telefones.add(tel)
      }
    }
  }
  return { nomes, telefones }
}

// Statuses que contam como sessão do mês (realizada ou agendada; exclui cancelado)
const STATUS_SESSAO = new Set(['Marcado', 'Confirmado', 'Aguardando', 'Atendido', 'Faltou'])

/** Conta as sessões (não canceladas) de cada cliente no MÊS ATUAL, por nome (lowercase). */
export async function getSessoesMesPorCliente(
  email: string, senha: string, estab: number,
): Promise<Map<string, number>> {
  const contagem = new Map<string, number>()
  const token = await getToken(email, senha)
  const grid = await getGrid(token, estab)
  if (grid.length === 0) return contagem

  const hoje = new Date()
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0) // último dia do mês
  const datas: string[] = []
  for (const d = new Date(primeiro); d <= ultimo; d.setDate(d.getDate() + 1)) {
    datas.push(d.toISOString().slice(0, 10))
  }

  const BATCH = 5
  for (let i = 0; i < datas.length; i += BATCH) {
    const resultados = await Promise.all(
      datas.slice(i, i + BATCH).map((data) => buildAgendaDia(token, estab, data, grid).catch(() => [] as BelleAgendamento[])),
    )
    for (const ags of resultados) {
      for (const ag of ags) {
        if (STATUS_SESSAO.has(ag.status) && ag.nom_paciente) {
          const k = ag.nom_paciente.trim().toLowerCase()
          contagem.set(k, (contagem.get(k) ?? 0) + 1)
        }
      }
    }
  }
  return contagem
}
