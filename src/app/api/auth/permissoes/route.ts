import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getPermissoesDoPerfil } from '@/lib/permissoes/store'

export const dynamic = 'force-dynamic'

// Mapa de permissões do USUÁRIO logado ({ funcionalidade: nível }). Usado pela UI
// (sidebar dinâmica, esconder/read-only). Qualquer usuário autenticado lê o seu.
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  try {
    const permissoes = await getPermissoesDoPerfil(session.perfil)
    return NextResponse.json({ perfil: session.perfil, permissoes })
  } catch (e) {
    console.error('Erro ao ler permissões do usuário:', e)
    return NextResponse.json({ error: 'Erro ao carregar permissões' }, { status: 500 })
  }
}
