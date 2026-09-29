import { getToken, HEADERS, BASE_URL } from '@/lib/belle/client-auth'

// Carrega do Belle o que a bola precisa: agenda do dia (preferencial/gênero/sala/
// serviço) + o grid de profissionais COM os turnos (a regra da escala). O client
// padrão (getAgendamentos) descarta grid/turnos — por isso a bola tem o seu.

export interface BolaTurno {
  daysOfWeek: number[] // 0=domingo .. 6=sábado (FullCalendar)
  startTime: string
  endTime: string
}

export interface BolaProfissionalRaw {
  cod_profissional: string
  nome_profiss?: string
  nome?: string
  businessHours?: BolaTurno[]
}

export interface BolaServicoRaw {
  cod_servico: number
  nome: string
  tempo?: number
}

export interface BolaAgendamentoRaw {
  cod_consulta?: number
  cod_profissional: string
  nom_usuario: string
  nom_paciente: string
  hrIni: string
  hrFim: string
  status: string
  lbServ: string
  sala: string
  preferencia: string | boolean
  tipo_obs_lbl: string | null
  arrServ: BolaServicoRaw[] | null
}

export interface BelleBolaData {
  agendamentos: BolaAgendamentoRaw[]
  profissionais: BolaProfissionalRaw[]
}

async function getGrid(token: string, estab: number): Promise<BolaProfissionalRaw[]> {
  const resp = await fetch(
    `${BASE_URL}/Agenda/v1.0/grid?etb=${estab}&restringe=0&estabGeral=${estab}`,
    { headers: { ...HEADERS, Authorization: token } }
  )
  if (!resp.ok) return []
  return resp.json()
}

async function getTurnos(
  token: string,
  cod: string,
  data: string,
  estab: number
): Promise<BolaTurno[]> {
  const resp = await fetch(
    `${BASE_URL}/Buscas/v1.0/turnos_validos?cod=${cod}&tpAgd=p&dtAgenda=${data}&estabGeral=${estab}`,
    { headers: { ...HEADERS, Authorization: token } }
  )
  if (!resp.ok) return []
  return resp.json()
}

/** Puxa agenda + grid(com turnos) do Belle para a data (YYYY-MM-DD). */
export async function carregarBelleBola(
  email: string,
  senha: string,
  estab: number,
  data: string
): Promise<BelleBolaData> {
  const token = await getToken(email, senha)
  const grid = await getGrid(token, estab)

  await Promise.all(
    grid.map(async (prof) => {
      prof.businessHours = await getTurnos(token, prof.cod_profissional, data, estab)
    })
  )

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
  if (!resp.ok) throw new Error(`Belle agendaapi falhou: ${resp.status}`)
  const agendamentos: BolaAgendamentoRaw[] = await resp.json()

  return { agendamentos, profissionais: grid }
}
