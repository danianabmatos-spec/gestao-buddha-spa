import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade, unidadesPermitidas } from '@/lib/auth/guard'
import { hojeISO, ensureTarefasDoDia } from '@/lib/rotinas/motor'
import { getEntradaDinheiroAcumulada } from '@/lib/belle/caixa-diario'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function escopoUnidade(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, requested: string | null) {
  const permitidas = unidadesPermitidas(session)
  const unidades = await prisma.unidade.findMany({
    where: permitidas === null ? { ativa: true } : { slug: { in: permitidas } },
    orderBy: { id: 'asc' },
    select: { id: true, nome: true, slug: true },
  })
  const slug = resolveUnidade(session, requested)
  const unidade = unidades.find((u) => u.slug === slug) ?? unidades[0]
  return { unidades, unidade }
}

// GET /api/rotinas/caixa?unidade=slug&data=YYYY-MM-DD
// Controle de caixa do dia (abertura/fechamento) + histórico recente.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data') || hojeISO()
  const { unidades, unidade } = await escopoUnidade(session, searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Nenhuma unidade no escopo.' }, { status: 403 })

  const mesIni = `${data.slice(0, 7)}-01` // 1º dia do mês do dia visto
  const [registro, historico, saidas, recebimentoDinheiro, saidasMesAgg, primeiroFundo] = await Promise.all([
    prisma.contagemCaixa.findUnique({ where: { unidadeId_data: { unidadeId: unidade.id, data } } }),
    prisma.contagemCaixa.findMany({ where: { unidadeId: unidade.id }, orderBy: { data: 'desc' }, take: 10 }),
    prisma.saidaCaixa.findMany({ where: { unidadeId: unidade.id, data }, orderBy: { criadoEm: 'asc' } }),
    getEntradaDinheiroAcumulada(unidade.slug, data).catch(() => null),
    prisma.saidaCaixa.aggregate({ _sum: { valor: true }, where: { unidadeId: unidade.id, data: { gte: mesIni, lte: data } } }),
    prisma.contagemCaixa.findFirst({
      where: { unidadeId: unidade.id, data: { gte: mesIni, lte: data }, fundoAbertura: { not: null } },
      orderBy: { data: 'asc' }, select: { fundoAbertura: true, data: true },
    }),
  ])

  // Conferência ACUMULADA no mês (o dinheiro do caixa acumula dia a dia):
  //   esperado = fundo inicial do mês + dinheiro recebido (acum.) − saídas (acum.)
  //   diferença = contado no fechamento do dia − esperado
  const totalSaidasDia = saidas.reduce((s, x) => s + x.valor, 0)
  const saidasAcumuladas = saidasMesAgg._sum.valor ?? 0
  const fundoInicial = primeiroFundo?.fundoAbertura ?? null
  const esperado = fundoInicial != null && recebimentoDinheiro != null
    ? fundoInicial + recebimentoDinheiro - saidasAcumuladas
    : null
  const diferenca = esperado != null && registro?.valorFechamento != null
    ? registro.valorFechamento - esperado
    : null

  return NextResponse.json({
    perfil: session.perfil, unidadeAtual: unidade, unidades, data, registro, historico,
    saidas, recebimentoDinheiro, totalSaidas: totalSaidasDia,
    saidasAcumuladas, fundoInicial, mesIni, esperado, diferenca,
  })
}

// POST /api/rotinas/caixa
// { unidade, data?, tipo: 'abertura'|'fechamento', valor, obs? }
// Registra o valor da abertura ou do fechamento e marca a tarefa de rotina como feita.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const tipo = body.tipo === 'abertura' ? 'abertura' : body.tipo === 'fechamento' ? 'fechamento' : null
  if (!tipo) return NextResponse.json({ error: 'Informe o tipo (abertura/fechamento).' }, { status: 400 })

  const valor = body.valor != null && body.valor !== '' ? Number(body.valor) : null
  if (valor == null || !Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ error: 'Informe um valor válido.' }, { status: 400 })
  }
  const obs = body.obs ? String(body.obs) : null

  const permitidas = unidadesPermitidas(session)
  const slug = resolveUnidade(session, body.unidade)
  if (permitidas !== null && (!slug || !permitidas.includes(slug))) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }
  const unidade = await prisma.unidade.findUnique({ where: { slug: slug ?? '' }, select: { id: true } })
  if (!unidade) return NextResponse.json({ error: 'Unidade inexistente.' }, { status: 404 })

  const data = body.data || hojeISO()
  const agora = new Date()
  const contadoPor = body.contadoPor ? String(body.contadoPor).trim() : null
  const patch = tipo === 'abertura'
    ? { fundoAbertura: valor, abertoPorNome: session.nome, abertoContadoPor: contadoPor, abertoEm: agora, obsAbertura: obs }
    : { valorFechamento: valor, fechadoPorNome: session.nome, fechadoContadoPor: contadoPor, fechadoEm: agora, obsFechamento: obs }

  const registro = await prisma.contagemCaixa.upsert({
    where: { unidadeId_data: { unidadeId: unidade.id, data } },
    update: patch,
    create: { unidadeId: unidade.id, data, ...patch },
  })

  // Marca a tarefa de rotina correspondente como concluída (best-effort).
  // Garante que as tarefas do dia existam antes (senão não há o que marcar).
  const chave = tipo === 'abertura' ? 'rec-abertura' : 'rec-fechamento-turno'
  const tmpl = await prisma.rotinaTemplate.findUnique({ where: { chave }, select: { id: true } })
  if (tmpl && data === hojeISO()) {
    await ensureTarefasDoDia(unidade.id, data)
    await prisma.tarefaRotina.updateMany({
      where: { unidadeId: unidade.id, templateId: tmpl.id, dataRef: data, status: { not: 'CONCLUIDA' } },
      data: { status: 'CONCLUIDA', concluidaEm: agora, concluidaPorId: session.sub, concluidaPorNome: session.nome },
    })
  }

  return NextResponse.json({ ok: true, registro })
}
