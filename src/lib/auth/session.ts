import { SignJWT, jwtVerify } from 'jose'

// ─── Sessão JWT assinada (padrão inspirado no LeadFlow) ─────────────────────────
// Usada tanto no middleware (edge) quanto nas rotas de API (node).
// Só depende de `jose` (funciona em edge runtime) — nada de Prisma aqui.

// FINANCEIRO = consulta todo o sistema (escopo de todas as unidades) e edita
// SOMENTE o Controle de Caixa. A restrição de escrita é central no proxy.
// TERAPEUTA = escopo da própria unidade, mas RESTRITO à área "Meus Atendimentos"
// (validar atendimento + registrar recomendação). Bloqueado de todo o resto no proxy.
export type Perfil = 'DONA' | 'RECEPCAO' | 'COORDENACAO' | 'FINANCEIRO' | 'RH' | 'TERAPEUTA'

export interface SessionUser {
  sub: string          // id do usuário
  nome: string
  email: string
  perfil: Perfil
  // Legado (1 unidade): DONA=null, RECEPCAO=slug, COORDENACAO=1ª unidade vinculada.
  unidadeSlug: string | null
  // Escopo completo: null = todas (DONA); lista = unidades permitidas (COORDENACAO/RECEPCAO).
  unidadeSlugs: string[] | null
  // true = precisa trocar a senha (1º acesso) antes de usar o sistema.
  primeirAcesso?: boolean
  // Mapa { funcionalidade: nível } assado no token no login e re-emitido a cada
  // page-load (via /api/auth/permissoes). Ausente = sessão antiga → proxy usa as
  // regras herdadas como fallback. Usado no enforcement por rota (proxy, edge).
  permissoes?: Record<string, string>
}

export const COOKIE_NAME = 'bs_sess'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 dias

const PERFIS: Perfil[] = ['DONA', 'RECEPCAO', 'COORDENACAO', 'FINANCEIRO', 'RH', 'TERAPEUTA']
function normalizarPerfil(v: unknown): Perfil {
  return PERFIS.includes(v as Perfil) ? (v as Perfil) : 'RECEPCAO'
}

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET não definido no ambiente')
  return new TextEncoder().encode(s)
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    unidadeSlug: user.unidadeSlug,
    unidadeSlugs: user.unidadeSlugs,
    primeirAcesso: user.primeirAcesso === true,
    ...(user.permissoes ? { permissoes: user.permissoes } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub) return null
    const rawSlugs = payload.unidadeSlugs
    const unidadeSlugs = Array.isArray(rawSlugs)
      ? rawSlugs.map((s) => String(s)).filter(Boolean)
      : null
    const rawPerms = payload.permissoes
    let permissoes: Record<string, string> | undefined
    if (rawPerms && typeof rawPerms === 'object' && !Array.isArray(rawPerms)) {
      permissoes = {}
      for (const [k, v] of Object.entries(rawPerms as Record<string, unknown>)) {
        if (typeof v === 'string') permissoes[k] = v
      }
    }
    return {
      sub: payload.sub,
      nome: String(payload.nome ?? ''),
      email: String(payload.email ?? ''),
      perfil: normalizarPerfil(payload.perfil),
      unidadeSlug: payload.unidadeSlug ? String(payload.unidadeSlug) : null,
      unidadeSlugs,
      primeirAcesso: payload.primeirAcesso === true,
      permissoes,
    }
  } catch {
    return null
  }
}

export const COOKIE_MAX_AGE = MAX_AGE_SECONDS
