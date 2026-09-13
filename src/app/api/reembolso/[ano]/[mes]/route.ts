import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getResumo } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// GET /api/reembolso/2026/8 — RESUMO do mês (7 unidades + totais)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  // Módulo executivo — apenas a DONA (Daniana) enxerga.
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) {
    return Response.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  if (!a || !m || m < 1 || m > 12) {
    return Response.json({ error: 'ano/mes inválidos' }, { status: 400 })
  }

  const resumo = await getResumo(a, m)
  return Response.json(resumo)
}
