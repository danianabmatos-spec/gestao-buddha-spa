// Cliente do FlareSolverr — "quebra-Cloudflare" que roda um Chrome real no servidor.
// Usado pra logar no WordPress (protegido por Cloudflare) e raspar os vouchers,
// da mesma forma que o Navvii faz. Roda no VPS (mesmo host do FlareSolverr).

const FLARE_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1'

interface FlareCookie { name: string; value: string }
export interface FlareSolution {
  status: number
  url: string
  html: string
  cookies: FlareCookie[]
  userAgent: string
}

async function call(payload: Record<string, unknown>): Promise<any> {
  const r = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  })
  const j = await r.json()
  return j
}

export async function criarSessao(): Promise<string> {
  const j = await call({ cmd: 'sessions.create' })
  if (!j.session) throw new Error(`FlareSolverr: falha ao criar sessão (${j.message ?? j.status})`)
  return j.session
}

export async function destruirSessao(session: string): Promise<void> {
  try { await call({ cmd: 'sessions.destroy', session }) } catch { /* best-effort */ }
}

function toSolution(j: any): FlareSolution {
  const s = j.solution ?? {}
  return {
    status: s.status ?? 0,
    url: s.url ?? '',
    html: s.response ?? '',
    cookies: (s.cookies ?? []).map((c: any) => ({ name: c.name, value: c.value })),
    userAgent: s.userAgent ?? '',
  }
}

export async function flareGet(session: string, url: string): Promise<FlareSolution> {
  const j = await call({ cmd: 'request.get', url, session, maxTimeout: 90_000 })
  return toSolution(j)
}

export async function flarePost(session: string, url: string, postData: string): Promise<FlareSolution> {
  const j = await call({ cmd: 'request.post', url, session, postData, maxTimeout: 90_000 })
  return toSolution(j)
}
