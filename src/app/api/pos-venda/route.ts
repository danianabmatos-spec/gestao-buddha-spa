import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas, resolveUnidade } from '@/lib/auth/guard'
import { getUnidadesDisponiveis, getUnidadeNome } from '@/lib/belle/unidades-config'

export const dynamic = 'force-dynamic'

const PERFIS_OK = ['DONA', 'RECEPCAO', 'COORDENACAO']

// GET /api/pos-venda[?unidade=slug&status=PENDENTE_VENDA|VENDIDA|SEM_VENDA|TODOS]
// Fila do pós-venda da recepção: recomendações a trabalhar (padrão: aguardando venda),
// com o que a terapeuta indicou e o telefone do cliente (best-effort via ClienteScore).
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_OK.includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito à recepção/coordenação.' }, { status: 403 })
  }

  const permitidas = unidadesPermitidas(session)
  const slugsDisponiveis = permitidas === null ? getUnidadesDisponiveis() : permitidas
  const unidades = slugsDisponiveis.map((slug) => ({ slug, nome: getUnidadeNome(slug) }))

  const sp = req.nextUrl.searchParams
  const unidade = resolveUnidade(session, sp.get('unidade')) || slugsDisponiveis[0]
  const status = (sp.get('status') || 'PENDENTE_VENDA').toUpperCase()
  if (!unidade) return NextResponse.json({ error: 'Sem unidade disponível.' }, { status: 400 })

  const where: { unidadeSlug: string; status?: string } = { unidadeSlug: unidade }
  if (status !== 'TODOS') where.status = status

  const recs = await prisma.recomendacao.findMany({
    where,
    orderBy: [{ criadoEm: 'desc' }],
    include: { itens: true, venda: { include: { itens: true } } },
    take: 300,
  })

  // Telefone best-effort: casa nome do cliente com o ClienteScore da unidade.
  const nomes = [...new Set(recs.map((r) => r.clienteNome))]
  const scores = nomes.length
    ? await prisma.clienteScore.findMany({
        where: { unidadeSlug: unidade, nomeCliente: { in: nomes } },
        select: { nomeCliente: true, telefone: true },
      })
    : []
  const telPorNome = new Map(scores.map((s) => [s.nomeCliente, s.telefone]))

  const fila = recs.map((r) => ({
    belleId: r.belleId,
    recomendacaoId: r.id,
    clienteNome: r.clienteNome,
    clienteTelefone: r.clienteTelefone || telPorNome.get(r.clienteNome) || null,
    terapeutaNome: r.terapeutaNome,
    dataAtendimento: r.dataAtendimento,
    servico: r.servico,
    retorno: r.retorno,
    itens: r.itens.map((i) => i.tipo),
    status: r.status,
    venda: r.venda ? { itens: r.venda.itens.map((i) => ({ tipo: i.tipo, quantidade: i.quantidade })) } : null,
  }))

  return NextResponse.json({
    unidadeAtual: { slug: unidade, nome: getUnidadeNome(unidade) },
    unidades,
    status,
    fila,
  })
}
