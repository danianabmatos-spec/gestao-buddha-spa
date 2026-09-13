import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { patchManualPorUnidade, mesEstaFechado } from '@/lib/reembolso/motor'
import { getFaturamentoCaixaMes } from '@/lib/reembolso/belle-faturamento'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/reembolso/2026/8/faturamento-belle  Body: { unidadeId }
// Puxa o faturamento caixa do mês no Belle e grava no campo (base do royalties 8%).
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

  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId }, select: { slug: true, nome: true } })
  if (!unidade) return Response.json({ error: 'Unidade não encontrada' }, { status: 404 })

  try {
    const faturamentoCaixa = await getFaturamentoCaixaMes(unidade.slug, a, m)
    await patchManualPorUnidade(a, m, unidadeId, { faturamentoCaixa })
    return Response.json({ ok: true, unidade: unidade.nome, faturamentoCaixa, royaltiesMkt: Math.round(faturamentoCaixa * 0.08 * 100) / 100 })
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
