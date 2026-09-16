const BASE_URL = process.env.BELLE_BASE_URL!

const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://app.bellesoftware.com.br',
  Referer: 'https://app.bellesoftware.com.br/',
  'x-from': 'app',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36',
}

// Cache por email — válido 50 min
const tokenCache = new Map<string, { token: string; expiresAt: number }>()
// Autenticações EM ANDAMENTO por email (single-flight): evita que várias chamadas
// concorrentes (ex.: fidelização + páginas de NPS em paralelo) disparem N re-logins
// ao mesmo tempo — o que estourava o rate limit (429) do Belle.
const inflight = new Map<string, Promise<string>>()

// Invalida o token em cache (usar quando o Belle devolve 401 no meio de uma consulta,
// para forçar re-autenticação no retry).
export function invalidarToken(email: string): void {
  tokenCache.delete(email)
}

async function autenticar(email: string, senha: string): Promise<string> {
  const resp = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ metodo: 'email', dados: { email, senha } }),
  })
  if (!resp.ok) throw new Error(`Belle auth failed: ${resp.status}`)

  const data = await resp.json()
  const token: string = data.token

  await fetch(`${BASE_URL}/Login/v1.0/admin/recuperar_dados?estabGeral=`, {
    headers: { ...HEADERS, Authorization: token },
  })
  await fetch(`${BASE_URL}/Login/v1.0/gravarsessao?estabGeral=`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({}),
  })

  tokenCache.set(email, { token, expiresAt: Date.now() + 50 * 60 * 1000 })
  return token
}

export async function getToken(email: string, senha: string, forcar = false): Promise<string> {
  if (!forcar) {
    const cached = tokenCache.get(email)
    if (cached && Date.now() < cached.expiresAt) return cached.token
  }
  // Single-flight: se já há uma autenticação em andamento para este email, aguarda-a
  // em vez de iniciar outra (evita tempestade de logins → 429).
  let p = inflight.get(email)
  if (!p) {
    p = autenticar(email, senha).finally(() => inflight.delete(email))
    inflight.set(email, p)
  }
  return p
}

export { HEADERS, BASE_URL }
