import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { patchManualPorUnidade, mesEstaFechado } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// PATCH /api/reembolso/2026/8/manual
// Body: { unidadeId, compras?, treinamento?, faturamentoCaixa?, pex? }
// Cria a linha da unidade se ainda não existir (permite lançar Compras/Treino
// antes de puxar o WordPress).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  if (!a || !m || m < 1 || m > 12) return Response.json({ error: 'ano/mes inválidos' }, { status: 400 })
  if (await mesEstaFechado(a, m)) return Response.json({ error: 'Mês fechado (só leitura). Reabra para editar.' }, { status: 423 })

  const b = await req.json()
  const unidadeId = Number(b.unidadeId)
  if (!unidadeId) return Response.json({ error: 'unidadeId obrigatório' }, { status: 400 })

  const patch: { compras?: number; treinamento?: number; faturamentoCaixa?: number; pex?: boolean } = {}
  if (b.compras !== undefined) patch.compras = Number(b.compras) || 0
  if (b.treinamento !== undefined) patch.treinamento = Number(b.treinamento) || 0
  if (b.faturamentoCaixa !== undefined) patch.faturamentoCaixa = Number(b.faturamentoCaixa) || 0
  if (b.pex !== undefined) patch.pex = !!b.pex

  await patchManualPorUnidade(a, m, unidadeId, patch)
  return Response.json({ ok: true })
}
