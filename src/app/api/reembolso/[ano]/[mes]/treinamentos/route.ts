import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { addTreinamento, mesEstaFechado } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// POST /api/reembolso/2026/8/treinamentos — adiciona uma terapeuta treinada (R$1.000)
// Body: { unidadeId, terapeuta }
export async function POST(req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  const b = await req.json()
  const unidadeId = Number(b.unidadeId)
  if (!unidadeId) return Response.json({ error: 'unidadeId obrigatório' }, { status: 400 })
  const terapeuta = String(b.terapeuta ?? '').trim()
  if (!terapeuta) return Response.json({ error: 'terapeuta obrigatória' }, { status: 400 })
  if (await mesEstaFechado(a, m)) return Response.json({ error: 'Mês fechado (só leitura). Reabra para editar.' }, { status: 423 })

  await addTreinamento(a, m, unidadeId, terapeuta)
  return Response.json({ ok: true })
}
