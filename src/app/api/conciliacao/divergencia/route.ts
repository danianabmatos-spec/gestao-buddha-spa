import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { conciliarDia, conciliarVouchersUnidade } from '@/lib/conciliacao/motor'

export const dynamic = 'force-dynamic'

type Acao = 'em_tratamento' | 'justificar' | 'ignorar' | 'reprocessar'

/**
 * POST /api/conciliacao/divergencia
 * Body: { id: number, acao: Acao, justificativa?: string }
 * - em_tratamento: marca que alguém está resolvendo.
 * - justificar/ignorar: aceita a diferença com um motivo (fecha a divergência).
 * - reprocessar: re-roda o motor do dia; se foi corrigido, a divergência some sozinha.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const id = Number(body?.id)
    const acao = body?.acao as Acao
    const justificativa: string | undefined = body?.justificativa?.trim() || undefined

    if (!id || !['em_tratamento', 'justificar', 'ignorar', 'reprocessar'].includes(acao)) {
      return NextResponse.json({ error: 'Parâmetros inválidos (id, acao)' }, { status: 400 })
    }

    const div = await prisma.divergencia.findUnique({ where: { id } })
    if (!div) return NextResponse.json({ error: 'Divergência não encontrada' }, { status: 404 })

    // Escopo: a unidade da divergência precisa estar entre as permitidas da sessão.
    const permitidas = unidadesPermitidas(session)
    if (permitidas !== null) {
      const unidade = await prisma.unidade.findUnique({ where: { id: div.unidadeId } })
      if (!unidade || !permitidas.includes(unidade.slug)) {
        return NextResponse.json({ error: 'Sem permissão para esta divergência' }, { status: 403 })
      }
    }

    const quem = { tratadaPorId: session.sub, tratadaPorNome: session.nome, tratadaEm: new Date() }

    if (acao === 'em_tratamento') {
      await prisma.divergencia.update({ where: { id }, data: { status: 'EM_TRATAMENTO', ...quem } })
    } else if (acao === 'justificar' || acao === 'ignorar') {
      if (acao === 'justificar' && !justificativa) {
        return NextResponse.json({ error: 'Justificativa é obrigatória' }, { status: 400 })
      }
      await prisma.divergencia.update({
        where: { id },
        data: { status: acao === 'justificar' ? 'JUSTIFICADA' : 'IGNORADA', justificativa, ...quem },
      })
    } else if (acao === 'reprocessar') {
      // Re-roda o motor: se a ponta já corrigiu no Belle/caixa, concilia sozinho.
      // Voucher casa por código na unidade inteira (cross-mês); o resto é por dia.
      if (div.formaPagamento === 'Voucher') {
        await conciliarVouchersUnidade(div.unidadeId)
      } else {
        await conciliarDia(div.unidadeId, div.data)
      }
    }

    // Estado atualizado do dia (pra a UI refletir na hora).
    const [atualizada, resumo] = await Promise.all([
      prisma.divergencia.findUnique({ where: { id } }),
      prisma.conciliacaoDia.findUnique({ where: { unidadeId_data: { unidadeId: div.unidadeId, data: div.data } } }),
    ])

    return NextResponse.json({ success: true, divergencia: atualizada, resumo })
  } catch (error) {
    console.error('[Conciliação/Divergência] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao tratar divergência'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
