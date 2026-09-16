import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME, verifySession, type SessionUser } from './session'

// ─── Guarda de sessão para rotas de API (runtime node) ──────────────────────────
// O middleware já barra requisições sem cookie válido, mas as rotas usam estas
// funções para (1) reconfirmar a sessão e (2) aplicar o escopo de unidade.

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

/** Resposta 401 padrão para APIs. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
}

/**
 * Unidades que a sessão pode enxergar.
 * - DONA: null (todas).
 * - COORDENACAO: as unidades vinculadas (1, 2 ou mais).
 * - RECEPCAO: a própria unidade.
 */
/**
 * Escopo de unidades de um perfil (mesma regra do login):
 * - 'total'   → DONA/FINANCEIRO/RH: veem todas (sem unidade vinculada).
 * - 'coord'   → COORDENACAO: uma ou mais unidades (via UsuarioUnidade).
 * - 'unidade' → RECEPCAO/TERAPEUTA e perfis personalizados: exatamente 1 unidade.
 */
export function escopoDoPerfil(perfil: string): 'total' | 'coord' | 'unidade' {
  if (perfil === 'DONA' || perfil === 'FINANCEIRO' || perfil === 'RH') return 'total'
  if (perfil === 'COORDENACAO') return 'coord'
  return 'unidade'
}

export function unidadesPermitidas(session: SessionUser): string[] | null {
  // Escopo total (do perfil, inclui personalizados) OU perfis de sistema com escopo total.
  if (session.escopoTotal || session.perfil === 'DONA' || session.perfil === 'FINANCEIRO' || session.perfil === 'RH') return null
  if (session.unidadeSlugs && session.unidadeSlugs.length) return session.unidadeSlugs
  return session.unidadeSlug ? [session.unidadeSlug] : []
}

/**
 * Resolve qual unidade a requisição pode acessar — o coração do multi-tenant.
 * - DONA: pode escolher qualquer unidade via `?unidade=` (ou null = todas).
 * - COORDENACAO/RECEPÇÃO: só pode escolher entre as suas; fora disso cai na 1ª.
 */
export function resolveUnidade(
  session: SessionUser,
  requested: string | null,
): string | null {
  const permitidas = unidadesPermitidas(session)
  if (permitidas === null) return requested || null // DONA
  if (requested && permitidas.includes(requested)) return requested
  return permitidas[0] ?? null
}

/**
 * Para rotas que exigem uma unidade concreta (ex.: fila de contatos).
 * Retorna a unidade efetiva ou o fallback se não houver escolha válida.
 */
export function unidadeEfetiva(
  session: SessionUser,
  requested: string | null,
  fallbackParaDona: string,
): string {
  return resolveUnidade(session, requested) ?? fallbackParaDona
}
