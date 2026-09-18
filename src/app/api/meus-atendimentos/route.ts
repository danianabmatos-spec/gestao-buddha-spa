import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

function mesAtualISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/meus-atendimentos[?ref=YYYY-MM]
// Lista TODOS os atendimentos da terapeuta logada no MÊS (janela de validação),
// já com a recomendação registrada (se houver). Base da tela "Meus Atendimentos".
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  // Identifica a terapeuta pelo usuário logado.
  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) {
    // Usuário logado não é uma terapeuta (ex.: DONA olhando) — nada a validar aqui.
    return NextResponse.json({ terapeuta: null, atendimentos: [] })
  }

  const ref = new URL(req.url).searchParams.get('ref') || mesAtualISO()

  const atendimentos = await prisma.atendimento.findMany({
    where: { terapeutaId: terapeuta.id, fechamentoRef: ref },
    orderBy: [{ data: 'asc' }, { hora: 'asc' }, { id: 'asc' }],
  })

  const belleIds = atendimentos.map((a) => a.belleId)
  const recomendacoes = belleIds.length
    ? await prisma.recomendacao.findMany({
        where: { belleId: { in: belleIds } },
        include: { itens: true },
      })
    : []
  const recPorBelle = new Map(recomendacoes.map((r) => [r.belleId, r]))

  const lista = atendimentos.map((a) => {
    const r = recPorBelle.get(a.belleId)
    return {
      belleId: a.belleId,
      clienteNome: a.clienteNome,
      servico: a.servico,
      hora: a.hora,
      data: a.data,
      statusValidacao: a.statusValidacao,
      observacaoContestacao: a.observacaoContestacao,
      recomendacao: r
        ? {
            notaSono: r.notaSono,
            notaEnergia: r.notaEnergia,
            notaEstresse: r.notaEstresse,
            pontosTensao: r.pontosTensao,
            retorno: r.retorno,
            observacao: r.observacao,
            temFoto: !!r.fotoPath,
            itens: r.itens.map((i) => i.tipo),
          }
        : null,
    }
  })

  return NextResponse.json({
    terapeuta: { nome: terapeuta.nome, unidadeSlug: terapeuta.unidadeSlug },
    ref,
    atendimentos: lista,
  })
}
