import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { carregarBelleBola, type BolaAgendamentoRaw } from './belle'
import {
  computarEstado,
  escolherProxima,
  hhmmToMin,
  type TerapeutaBola,
  type TurnoHoje,
  type CheckIn,
  type Atendimento,
  type PreferencialFuturo,
  type EstadoTerapeuta,
  type Pedido,
  type ResultadoBola,
} from './motor'

// ── helpers de fuso (São Paulo) ─────────────────────────────────────────────
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
function minutosAgoraSP(): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return hhmmToMin(s)
}
function minutosDeSP(d: Date): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return hhmmToMin(s)
}
/** Dia da semana (0=domingo..6=sábado) de uma data YYYY-MM-DD. */
function diaSemana(dataISO: string): number {
  return new Date(`${dataISO}T12:00:00Z`).getUTCDay()
}
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}
function generoDoObs(lbl: string | null): 'F' | 'M' | null {
  if (!lbl) return null
  if (lbl.includes('Masculino')) return 'M'
  if (lbl.includes('Feminin')) return 'F'
  return null
}

const CANCELADOS = new Set(['Cancelado', 'Faltou', 'Bloqueado', 'Reserva'])

export interface EstadoBolaCompleto {
  unidade: string
  data: string
  agoraMin: number
  estado: EstadoTerapeuta[]
  // guardado para o escolher()
  _terapeutas: TerapeutaBola[]
  _preferenciaisFuturos: PreferencialFuturo[]
  _porCod: Record<string, TerapeutaBola>
  _codParaId: Record<string, number> // cod_profissional do Belle -> id do nosso Terapeuta
}

/**
 * Monta o estado da bola de uma unidade: fila (nosso banco) + Belle ao vivo
 * (turno, preferencial, sala, duração, gênero). agoraMin opcional (default = agora SP)
 * permite simular um horário para demonstração.
 */
export async function montarEstadoBola(
  unidadeSlug: string,
  opts?: { agoraMin?: number; data?: string }
): Promise<EstadoBolaCompleto> {
  const data = opts?.data ?? hojeBrasilia()
  const agoraMin = opts?.agoraMin ?? minutosAgoraSP()

  // Credenciais Belle pela MESMA fonte do resto do app (env/config), não da tabela Unidade.
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Unidade sem credenciais Belle: ${unidadeSlug}`)

  const belle = await carregarBelleBola(cred.email, cred.password, cred.estab, data)

  // roster do Belle (exclui recurso "Banho"); gênero = cadastro futuro (default F)
  const profs = belle.profissionais.filter((p) => p.cod_profissional !== 'Banho')
  const terapeutas: TerapeutaBola[] = profs.map((p) => ({
    id: String(p.cod_profissional),
    nome: (p.nome_profiss || p.nome || '').trim(),
    genero: 'F', // TODO: cadastro de gênero por terapeuta (unidades com homens)
    servicos: null, // TODO: Belle "Relacionar Serviços"; null = faz todas por ora
  }))
  const porCod: Record<string, TerapeutaBola> = Object.fromEntries(terapeutas.map((t) => [t.id, t]))

  // nome (normalizado) -> cod, para casar nossos Terapeuta com o Belle
  const nomeParaCod = new Map<string, string>()
  for (const p of profs) nomeParaCod.set(norm(p.nome_profiss || p.nome || ''), String(p.cod_profissional))

  // turnos de hoje (janelas reais >=30min; "slivers" = não escalada)
  const dow = diaSemana(data)
  const turnos: TurnoHoje[] = []
  for (const p of profs) {
    const janelas = (p.businessHours || [])
      .filter((t) => Array.isArray(t.daysOfWeek) && t.daysOfWeek.includes(dow))
      .map((t) => ({ i: hhmmToMin(t.startTime), f: hhmmToMin(t.endTime) }))
      .filter((w) => w.f - w.i >= 30)
    if (janelas.length) {
      turnos.push({
        terapeutaId: String(p.cod_profissional),
        inicioMin: Math.min(...janelas.map((w) => w.i)),
        fimMin: Math.max(...janelas.map((w) => w.f)),
      })
    }
  }

  // preferenciais (verde) do Belle: futuros reservam; ativos/concluídos viram atendimento
  const ehPref = (a: BolaAgendamentoRaw) => a.preferencia === '1' || a.preferencia === true
  const preferenciaisFuturos: PreferencialFuturo[] = []
  const atendimentos: Atendimento[] = []
  for (const a of belle.agendamentos) {
    if (a.cod_profissional === 'Banho' || CANCELADOS.has(a.status) || !ehPref(a)) continue
    const ini = hhmmToMin(a.hrIni)
    const fim = hhmmToMin(a.hrFim)
    const cod = String(a.cod_profissional)
    if (ini > agoraMin) {
      preferenciaisFuturos.push({ terapeutaId: cod, inicioMin: ini, cliente: (a.nom_paciente || '').trim() })
    } else {
      atendimentos.push({ terapeutaId: cod, inicioMin: ini, fimMin: fim, cliente: (a.nom_paciente || '').trim(), servico: a.lbServ })
    }
  }

  // atendimentos que a BOLA mandou hoje (nosso banco) — fonte de ocupado/rodadas
  const dbTerapeutas = await prisma.terapeuta.findMany({
    where: { unidadeSlug, ativo: true },
    select: { id: true, nome: true, nomeBelle: true },
  })
  const idParaCod = new Map<number, string>()
  for (const t of dbTerapeutas) {
    const cod = nomeParaCod.get(norm(t.nomeBelle || t.nome))
    if (cod) idParaCod.set(t.id, cod)
  }

  const bolaAtend = await prisma.bolaAtendimento.findMany({ where: { unidadeSlug, data } })
  for (const a of bolaAtend) {
    const cod = idParaCod.get(a.terapeutaId)
    if (!cod) continue
    atendimentos.push({
      terapeutaId: cod,
      inicioMin: minutosDeSP(a.inicioEm),
      fimMin: minutosDeSP(a.fimPrevistoEm),
      cliente: a.clienteNome ?? undefined,
      servico: a.servicoNome ?? undefined,
    })
  }

  // fila de check-in (nosso banco) — ordem de chegada
  const checkins = await prisma.bolaCheckin.findMany({
    where: { unidadeSlug, data, status: 'ATIVO' },
    orderBy: { chegadaEm: 'asc' },
  })
  const fila: CheckIn[] = []
  for (const c of checkins) {
    const cod = idParaCod.get(c.terapeutaId)
    if (cod) fila.push({ terapeutaId: cod, chegadaMin: minutosDeSP(c.chegadaEm) })
  }

  const estado = computarEstado(agoraMin, fila, turnos, atendimentos, preferenciaisFuturos, terapeutas)

  const codParaId: Record<string, number> = {}
  for (const [id, cod] of idParaCod) codParaId[cod] = id

  return {
    unidade: unidadeSlug,
    data,
    agoraMin,
    estado,
    _terapeutas: terapeutas,
    _preferenciaisFuturos: preferenciaisFuturos,
    _porCod: porCod,
    _codParaId: codParaId,
  }
}

/** A partir de um estado já montado, decide a próxima terapeuta para um pedido. */
export function escolherDoEstado(base: EstadoBolaCompleto, pedido: Pedido): ResultadoBola {
  return escolherProxima(base.agoraMin, base.estado, pedido, base._preferenciaisFuturos)
}

export { generoDoObs }
