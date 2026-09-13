import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { setStatusMes } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// POST /api/reembolso/2026/8/status  Body: { status: 'FECHADO' | 'ABERTO' }
export async function POST(req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  if (!a || !m || m < 1 || m > 12) return Response.json({ error: 'ano/mes inválidos' }, { status: 400 })

  const b = await req.json()
  const status = b.status === 'FECHADO' ? 'FECHADO' : 'ABERTO'
  await setStatusMes(a, m, status)
  return Response.json({ ok: true, status })
}
