import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { removeCompra } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// DELETE /api/reembolso/compras/123 — remove um item de compra e recalcula
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { id } = await ctx.params
  const compraId = Number(id)
  if (!compraId) return Response.json({ error: 'id inválido' }, { status: 400 })

  await removeCompra(compraId)
  return Response.json({ ok: true })
}
