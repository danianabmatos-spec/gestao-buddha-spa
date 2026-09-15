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

// Invalida o token em cache (usar quando o Belle devolve 401 no meio de uma consulta,
// para forçar re-autenticação no retry).
export function invalidarToken(email: string): void {
  tokenCache.delete(email)
}

export async function getToken(email: string, senha: string, forcar = false): Promise<string> {
  const cached = tokenCache.get(email)
  if (!forcar && cached && Date.now() < cached.expiresAt) return cached.token

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

export { HEADERS, BASE_URL }
