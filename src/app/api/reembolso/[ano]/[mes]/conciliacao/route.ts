import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { patchConciliacao } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// PATCH /api/reembolso/2026/8/conciliacao — valor recebido em conta + flag conferido.
// Permitido mesmo com o mês FECHADO (o pagamento cai depois do fechamento).
// Body: { unidadeId, valorRecebido?, conciliado? }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  if (!a || !m || m < 1 || m > 12) return Response.json({ error: 'ano/mes inválidos' }, { status: 400 })

  const b = await req.json()
  const unidadeId = Number(b.unidadeId)
  if (!unidadeId) return Response.json({ error: 'unidadeId obrigatório' }, { status: 400 })

  const patch: { valorRecebido?: number; conciliado?: boolean } = {}
  if (b.valorRecebido !== undefined) patch.valorRecebido = Number(b.valorRecebido) || 0
  if (b.conciliado !== undefined) patch.conciliado = !!b.conciliado

  await patchConciliacao(a, m, unidadeId, patch)
  return Response.json({ ok: true })
}
