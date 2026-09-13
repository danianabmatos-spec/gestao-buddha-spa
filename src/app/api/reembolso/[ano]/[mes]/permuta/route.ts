import { NextRequest } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { patchPermuta, mesEstaFechado } from '@/lib/reembolso/motor'

export const dynamic = 'force-dynamic'

// PATCH /api/reembolso/2026/8/permuta
// Body: { unidadeId, valorMensalPermutavel?, limiteAcumulo?, saldoInicial? }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ ano: string; mes: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if ((session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO')) return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { ano, mes } = await ctx.params
  const a = Number(ano), m = Number(mes)
  const b = await req.json()
  const unidadeId = Number(b.unidadeId)
  if (!unidadeId) return Response.json({ error: 'unidadeId obrigatório' }, { status: 400 })
  if (await mesEstaFechado(a, m)) return Response.json({ error: 'Mês fechado (só leitura). Reabra para editar.' }, { status: 423 })

  const patch: { valorMensalPermutavel?: number; limiteAcumulo?: number; saldoInicial?: number } = {}
  if (b.valorMensalPermutavel !== undefined) patch.valorMensalPermutavel = Number(b.valorMensalPermutavel) || 0
  if (b.limiteAcumulo !== undefined) patch.limiteAcumulo = Number(b.limiteAcumulo) || 0
  if (b.saldoInicial !== undefined) patch.saldoInicial = Number(b.saldoInicial) || 0

  await patchPermuta(unidadeId, patch, a, m)
  return Response.json({ ok: true })
}
