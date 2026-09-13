import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { addCompra, mesEstaFechado } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// POST /api/reembolso/2026/8/compras — adiciona um item de compra
// Body: { unidadeId, descricao, valor }
export async function POST(req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  const b = await req.json()
  const unidadeId = Number(b.unidadeId)
  if (!unidadeId) return Response.json({ error: 'unidadeId obrigatório' }, { status: 400 })
  if (await mesEstaFechado(a, m)) return Response.json({ error: 'Mês fechado (só leitura). Reabra para editar.' }, { status: 423 })

  await addCompra(a, m, unidadeId, String(b.descricao ?? 'Compra'), Number(b.valor) || 0)
  return Response.json({ ok: true })
}
