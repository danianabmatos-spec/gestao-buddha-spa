import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ymd = (s: unknown): string | null => {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
const hojeYmd = () => new Date().toLocaleDateString('en-CA')

// PATCH /api/financeiro/titulos/[id] — ação {pagar|cancelar|reabrir} ou edição/classificação.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO') {
    return NextResponse.json({ error: 'Só o financeiro ou a dona/dono pode editar títulos' }, { status: 403 })
  }
  const { id } = await params
  const t = await prisma.tituloPagar.findUnique({ where: { id: Number(id) } })
  if (!t) return NextResponse.json({ error: 'Título não encontrado' }, { status: 404 })

  // Escopo de unidade.
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null) {
    const u = await prisma.unidade.findUnique({ where: { id: t.unidadeId }, select: { slug: true } })
    if (!u || !permitidas.includes(u.slug)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const b = await request.json().catch(() => ({}))
  const acao = String(b.acao || '')

  if (acao === 'pagar') {
    await prisma.tituloPagar.update({ where: { id: t.id }, data: { status: 'PAGO', dataPagamento: ymd(b.dataPagamento) || hojeYmd() } })
    return NextResponse.json({ ok: true })
  }
  if (acao === 'cancelar') {
    await prisma.tituloPagar.update({ where: { id: t.id }, data: { status: 'CANCELADO' } })
    return NextResponse.json({ ok: true })
  }
  if (acao === 'reabrir') {
    await prisma.tituloPagar.update({ where: { id: t.id }, data: { status: 'PREVISTO', dataPagamento: null } })
    return NextResponse.json({ ok: true })
  }

  // Edição / classificação.
  const data: Record<string, unknown> = {}
  if ('planoContaId' in b) data.planoContaId = b.planoContaId ? Number(b.planoContaId) : null
  if (typeof b.descricao === 'string') data.descricao = b.descricao
  if (typeof b.fornecedorTexto === 'string') data.fornecedorTexto = b.fornecedorTexto
  if (b.valor != null) data.valor = Number(b.valor) || 0
  if (typeof b.formaPagamento === 'string') data.formaPagamento = b.formaPagamento
  if ('dataCompetencia' in b) data.dataCompetencia = ymd(b.dataCompetencia)
  if ('dataVencimento' in b) data.dataVencimento = ymd(b.dataVencimento)
  await prisma.tituloPagar.update({ where: { id: t.id }, data })
  return NextResponse.json({ ok: true })
}
