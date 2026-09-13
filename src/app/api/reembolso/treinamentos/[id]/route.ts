import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { removeTreinamento } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// DELETE /api/reembolso/treinamentos/123 — remove uma terapeuta e recalcula
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { id } = await ctx.params
  const tid = Number(id)
  if (!tid) return Response.json({ error: 'id inválido' }, { status: 400 })

  await removeTreinamento(tid)
  return Response.json({ ok: true })
}
