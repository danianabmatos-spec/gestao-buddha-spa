// Rate limit simples em memória (por processo) para o login.
// Objetivo: travar ataque de força bruta / dicionário sem depender de
// infraestrutura externa. Roda no runtime node (o processo pm2 é fork único),
// então o Map persiste entre requisições. Reinício zera os contadores — ok.
//
// Estratégia: conta TENTATIVAS FALHAS por chave (IP + e-mail). Login bem-sucedido
// limpa a chave. Ao passar do limite, bloqueia a chave por um tempo.

type Bucket = { fails: number; first: number; blockedUntil: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 15 * 60 * 1000 // janela de contagem: 15 min
const MAX_FAILS = 10 // falhas permitidas na janela antes de bloquear
const BLOCK_MS = 15 * 60 * 1000 // duração do bloqueio: 15 min
const MAX_ENTRIES = 5000 // teto de segurança contra crescimento do Map

function agora() {
  return Date.now()
}

/** Descarta buckets expirados (janela e bloqueio vencidos). */
function prune(t: number) {
  for (const [k, b] of buckets) {
    if (b.blockedUntil < t && t - b.first > WINDOW_MS) buckets.delete(k)
  }
  // Backstop: se ainda estiver gigante, limpa geral.
  if (buckets.size > MAX_ENTRIES) buckets.clear()
}

/**
 * Verifica se a chave pode tentar agora.
 * Retorna { ok: false, retryAfter } (segundos) quando bloqueada.
 */
export function checkRateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const t = agora()
  const b = buckets.get(key)
  if (!b) return { ok: true }
  if (b.blockedUntil > t) {
    return { ok: false, retryAfter: Math.ceil((b.blockedUntil - t) / 1000) }
  }
  // Janela expirada → reseta o contador.
  if (t - b.first > WINDOW_MS) {
    buckets.delete(key)
    return { ok: true }
  }
  return { ok: true }
}

/** Registra uma tentativa falha; bloqueia a chave ao estourar o limite. */
export function registerFail(key: string): void {
  const t = agora()
  prune(t)
  const b = buckets.get(key)
  if (!b || t - b.first > WINDOW_MS) {
    buckets.set(key, { fails: 1, first: t, blockedUntil: 0 })
    return
  }
  b.fails += 1
  if (b.fails >= MAX_FAILS) {
    b.blockedUntil = t + BLOCK_MS
  }
}

/** Login bem-sucedido: limpa o contador da chave. */
export function registerSuccess(key: string): void {
  buckets.delete(key)
}

/** Extrai o IP do cliente atrás do nginx (X-Forwarded-For). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'desconhecido'
}
