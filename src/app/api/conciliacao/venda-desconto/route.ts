import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/conciliacao/venda-desconto
// Body: { id, acao: 'justificar'|'ignorar'|'reabrir', justificativa? }
// Trata um lançamento de venda (pacote/voucher/produto) com desconto/cortesia.
// Tabela VendaDescontoConc via SQL raw. Escopo: unidade da sessão.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const id = Number(body?.id)
    const acao = String(body?.acao || '')
    const justificativa: string | null = body?.justificativa?.trim() || null
    if (!id || !['justificar', 'ignorar', 'reabrir'].includes(acao)) {
      return NextResponse.json({ error: 'Parâmetros inválidos (id, acao)' }, { status: 400 })
    }

    const rows = await prisma.$queryRawUnsafe<{ unidadeId: number }[]>(
      `SELECT "unidadeId" FROM "VendaDescontoConc" WHERE "id" = ? LIMIT 1`, id,
    )
    const row = rows?.[0]
    if (!row) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })

    const permitidas = unidadesPermitidas(session)
    if (permitidas !== null) {
      const unidade = await prisma.unidade.findUnique({ where: { id: row.unidadeId } })
      if (!unidade || !permitidas.includes(unidade.slug)) {
        return NextResponse.json({ error: 'Sem permissão para este lançamento' }, { status: 403 })
      }
    }

    if (acao === 'justificar' && !justificativa) {
      return NextResponse.json({ error: 'Justificativa é obrigatória' }, { status: 400 })
    }
    const novoStatus = acao === 'justificar' ? 'JUSTIFICADA' : acao === 'ignorar' ? 'IGNORADA' : 'PENDENTE'
    const reabrir = acao === 'reabrir'
    await prisma.$executeRawUnsafe(
      `UPDATE "VendaDescontoConc" SET "status" = ?, "justificativa" = ?, "tratadaPorNome" = ?, "atualizadoEm" = datetime('now') WHERE "id" = ?`,
      novoStatus, reabrir ? null : justificativa, reabrir ? null : session.nome, id,
    )
    return NextResponse.json({ success: true, status: novoStatus })
  } catch (error) {
    console.error('[Conciliação/VendaDesconto] Erro:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao tratar lançamento' }, { status: 500 })
  }
}
