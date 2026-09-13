import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getCortesiasControle } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// GET /api/reembolso/2026/8/cortesias — controle de permuta por unidade + lista
export async function GET(_req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  if (!a || !m || m < 1 || m > 12) return Response.json({ error: 'ano/mes inválidos' }, { status: 400 })

  return Response.json(await getCortesiasControle(a, m))
}
