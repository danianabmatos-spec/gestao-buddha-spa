import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getNivel } from './store'
import type { Nivel } from './catalogo'
import type { SessionUser } from '@/lib/auth/session'

const ORDEM: Record<Nivel, number> = { NENHUM: 0, VISUALIZAR: 1, EDITAR: 2 }

// Enforcement por funcionalidade nas rotas de API. Uso:
//   const { erro, session } = await exigirAcesso('reembolso', 'EDITAR')
//   if (erro) return erro
export async function exigirAcesso(
  funcionalidade: string, nivelMin: Nivel = 'VISUALIZAR',
): Promise<{ erro: NextResponse | null; session: SessionUser | null; nivel: Nivel }> {
  const session = await getSession()
  if (!session) return { erro: unauthorized(), session: null, nivel: 'NENHUM' }
  const nivel = await getNivel(session.perfil, funcionalidade)
  if (ORDEM[nivel] < ORDEM[nivelMin]) {
    return { erro: NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 }), session, nivel }
  }
  return { erro: null, session, nivel }
}
