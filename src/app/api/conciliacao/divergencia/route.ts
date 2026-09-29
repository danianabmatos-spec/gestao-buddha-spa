import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { conciliarDia, conciliarVouchersUnidade } from '@/lib/conciliacao/motor'
import { conciliarAtendimentosDia, aplicarRegraColaborador } from '@/lib/conciliacao/motor-atendimentos'

export const dynamic = 'force-dynamic'

type Acao = 'em_tratamento' | 'justificar' | 'ignorar' | 'reprocessar' | 'aprovar' | 'reprovar'

// Divergências do eixo de ATENDIMENTOS (Parte 2) — reprocessam pelo motor de atendimentos.
const TIPOS_ATENDIMENTO = ['ATENDIMENTO_SEM_JUSTIFICATIVA', 'CORTESIA', 'DESCONTO']

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

    if (!id || !['em_tratamento', 'justificar', 'ignorar', 'reprocessar', 'aprovar', 'reprovar'].includes(acao)) {
      return NextResponse.json({ error: 'Parâmetros inválidos (id, acao)' }, { status: 400 })
    }
    const ehDona = session.perfil === 'DONA'

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
      // Justificativa da equipe fica AGUARDANDO APROVAÇÃO (aprovadaEm null). Se quem
      // justifica já é DONA (proprietário), aprova na hora. "Ignorar" não precisa aprovar.
      const auto = ehDona || acao === 'ignorar'
      await prisma.divergencia.update({
        where: { id },
        data: {
          status: acao === 'justificar' ? 'JUSTIFICADA' : 'IGNORADA', justificativa, ...quem,
          aprovadaPorNome: auto ? session.nome : null,
          aprovadaEm: auto ? new Date() : null,
        },
      })
    } else if (acao === 'aprovar' || acao === 'reprovar') {
      // Só DONA aprova/reprova a justificativa da equipe.
      if (!ehDona) return NextResponse.json({ error: 'Só a dona/dono pode aprovar ou reprovar justificativas' }, { status: 403 })
      if (acao === 'aprovar') {
        await prisma.divergencia.update({ where: { id }, data: { aprovadaPorNome: session.nome, aprovadaEm: new Date() } })
      } else {
        // Reprova: reabre a divergência (limpa justificativa e aprovação).
        await prisma.divergencia.update({
          where: { id },
          data: { status: 'ABERTA', justificativa: null, tratadaPorId: null, tratadaPorNome: null, tratadaEm: null, aprovadaPorNome: null, aprovadaEm: null },
        })
      }
    } else if (acao === 'reprocessar') {
      // Re-roda o motor: se a ponta já corrigiu no Belle/caixa, concilia sozinho.
      if (TIPOS_ATENDIMENTO.includes(div.tipo)) {
        // Eixo de atendimentos: re-classifica o dia + reaplica a regra de colaborador do mês.
        await conciliarAtendimentosDia(div.unidadeId, div.data)
        await aplicarRegraColaborador(div.unidadeId, div.data.slice(0, 7))
      } else if (div.formaPagamento === 'Voucher') {
        // Voucher casa por código na unidade inteira (cross-mês).
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
