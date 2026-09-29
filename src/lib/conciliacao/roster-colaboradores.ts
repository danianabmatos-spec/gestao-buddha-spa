// ─── Parte 2 · F2d · Roster de colaboradores (cortesia legítima) ─────────────────
// Consome o endpoint read-only do app de RH (buddha-rh) e devolve o conjunto de NOMES
// NORMALIZADOS dos colaboradores ATIVOS com direito a cortesia (CLT ou coordenadora).
// A Conciliação de Atendimentos usa isso pra NÃO flagar cortesia legítima de colaborador.
//
// Fallback seguro: se o RH estiver indisponível, devolve conjunto VAZIO → nenhuma
// cortesia é auto-justificada (todas ficam como divergência p/ a equipe tratar). Nunca
// o contrário (nunca "justifica" indevidamente por falta de dados).

const TTL_MS = 6 * 60 * 60 * 1000 // 6h
let cache: { at: number; roster: Map<string, RosterItem> } | null = null

export interface RosterItem {
  nome: string
  cpf: string | null
  tipoContrato: string
  nivel: string | null
}

/** Normaliza nome p/ match: minúsculo, sem acento, espaços colapsados. */
export function normalizarNome(v: string): string {
  return (v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

async function buscarDoRH(): Promise<Map<string, RosterItem>> {
  const url = process.env.RH_INTEGRACAO_URL
  const secret = process.env.RH_INTEGRACAO_SECRET
  const mapa = new Map<string, RosterItem>()
  if (!url || !secret) {
    console.warn('[roster-colaboradores] RH_INTEGRACAO_URL/SECRET não configurados — roster vazio')
    return mapa
  }
  const resp = await fetch(url, {
    headers: { 'x-integration-secret': secret },
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) throw new Error(`RH roster HTTP ${resp.status}`)
  const data = await resp.json() as { roster?: RosterItem[] }
  for (const c of data.roster ?? []) {
    const chave = normalizarNome(c.nome)
    if (chave) mapa.set(chave, c)
  }
  return mapa
}

/**
 * Retorna o roster (nome normalizado → item). Cacheado por TTL. Em erro, devolve o
 * cache anterior se houver, senão conjunto vazio (fail-safe).
 */
export async function getRosterColaboradores(forcar = false): Promise<Map<string, RosterItem>> {
  if (!forcar && cache && Date.now() - cache.at < TTL_MS) return cache.roster
  try {
    const roster = await buscarDoRH()
    cache = { at: Date.now(), roster }
    return roster
  } catch (e) {
    console.error('[roster-colaboradores] falha ao buscar RH:', e instanceof Error ? e.message : e)
    return cache?.roster ?? new Map()
  }
}

/** Injeta um roster (testes) — bypassa o fetch. */
export function _setRosterCacheParaTeste(nomes: string[]): void {
  const roster = new Map<string, RosterItem>()
  for (const n of nomes) roster.set(normalizarNome(n), { nome: n, cpf: null, tipoContrato: 'CLT', nivel: null })
  cache = { at: Date.now(), roster }
}
