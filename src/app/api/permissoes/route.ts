import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getMatriz } from '@/lib/permissoes/store'

export const dynamic = 'force-dynamic'

// Matriz de permissões (perfis × funcionalidades × nível). Só DONA (gestão de acessos).
// A leitura também garante o seed (perfis de sistema + matriz-padrão).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  try {
    const matriz = await getMatriz()
    return NextResponse.json(matriz)
  } catch (e) {
    console.error('Erro ao ler matriz de permissões:', e)
    return NextResponse.json({ error: 'Erro ao carregar permissões' }, { status: 500 })
  }
}
