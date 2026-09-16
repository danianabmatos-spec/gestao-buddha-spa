import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getPermissoesDoPerfil } from '@/lib/permissoes/store'
import { signSession, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

// Mapa de permissões do USUÁRIO logado ({ funcionalidade: nível }). Usado pela UI
// (sidebar dinâmica, esconder/read-only). Qualquer usuário autenticado lê o seu.
//
// EFEITO COLATERAL PROPOSITAL: re-emite o cookie de sessão com as permissões
// FRESCAS do banco. Como a sidebar chama esta rota em toda página, o token que o
// proxy (edge) usa no enforcement por rota fica quase ao vivo — assim os ajustes
// feitos em /acessos passam a valer sem precisar deslogar/relogar.
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  try {
    const chave = session.perfilChave || session.perfil
    const permissoes = await getPermissoesDoPerfil(chave)
    const res = NextResponse.json({ perfil: session.perfil, permissoes })

    // Só re-emite se algo mudou (evita Set-Cookie desnecessário a cada request).
    const mudou = JSON.stringify(session.permissoes ?? {}) !== JSON.stringify(permissoes)
    if (mudou) {
      const token = await signSession({ ...session, permissoes })
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      })
    }
    return res
  } catch (e) {
    console.error('Erro ao ler permissões do usuário:', e)
    return NextResponse.json({ error: 'Erro ao carregar permissões' }, { status: 500 })
  }
}
