import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas, resolveUnidade } from '@/lib/auth/guard'
import { getUnidadesDisponiveis, getUnidadeNome } from '@/lib/belle/unidades-config'

export const dynamic = 'force-dynamic'

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/validacao[?unidade=slug&ref=YYYY-MM]
// Painel da coordenadora: resumo por status, resumo por terapeuta, lista de
// contestações a resolver, e o estado de liberação do mês.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA' && session.perfil !== 'COORDENACAO') {
    return NextResponse.json({ error: 'Acesso restrito à coordenação.' }, { status: 403 })
  }

  const permitidas = unidadesPermitidas(session)
  const slugsDisponiveis = permitidas === null ? getUnidadesDisponiveis() : permitidas
  const unidades = slugsDisponiveis.map((slug) => ({ slug, nome: getUnidadeNome(slug) }))

  const sp = req.nextUrl.searchParams
  const unidade = resolveUnidade(session, sp.get('unidade')) || slugsDisponiveis[0]
  const ref = sp.get('ref') || mesAtual()
  if (!unidade) return NextResponse.json({ error: 'Sem unidade disponível.' }, { status: 400 })

  const atends = await prisma.atendimento.findMany({
    where: { unidadeSlug: unidade, fechamentoRef: ref },
    orderBy: [{ data: 'asc' }, { id: 'asc' }],
  })

  const contam = (s: string) => atends.filter((a) => a.statusValidacao === s).length
  const resumo = {
    total: atends.length,
    pendentes: contam('PENDENTE'),
    confirmados: contam('CONFIRMADO'),
    contestados: contam('CONTESTADO'),
    ajustados: contam('AJUSTADO'),
    rejeitados: contam('REJEITADO'),
  }

  // Resumo por terapeuta.
  const porTerapeutaMap = new Map<string, { nome: string; total: number; pendentes: number; contestados: number }>()
  for (const a of atends) {
    const k = a.terapeutaNome
    const e = porTerapeutaMap.get(k) || { nome: k, total: 0, pendentes: 0, contestados: 0 }
    e.total++
    if (a.statusValidacao === 'PENDENTE') e.pendentes++
    if (a.statusValidacao === 'CONTESTADO') e.contestados++
    porTerapeutaMap.set(k, e)
  }
  const porTerapeuta = [...porTerapeutaMap.values()].sort((a, b) => a.nome.localeCompare(b.nome))

  // Contestações a resolver.
  const contestacoes = atends
    .filter((a) => a.statusValidacao === 'CONTESTADO')
    .map((a) => ({
      belleId: a.belleId,
      terapeutaNome: a.terapeutaNome,
      clienteNome: a.clienteNome,
      servico: a.servico,
      data: a.data,
      valorComissao: a.valorComissao,
      observacaoContestacao: a.observacaoContestacao,
    }))

  const fech = await prisma.fechamentoValidacao.findUnique({ where: { unidadeSlug_ref: { unidadeSlug: unidade, ref } } })

  return NextResponse.json({
    unidadeAtual: { slug: unidade, nome: getUnidadeNome(unidade) },
    unidades,
    ref,
    resumo,
    porTerapeuta,
    contestacoes,
    liberado: fech?.liberado ?? false,
    liberadoEm: fech?.liberadoEm ?? null,
    liberadoPorNome: fech?.liberadoPorNome ?? null,
    forcado: fech?.forcado ?? false,
    forcadoInfo: fech?.forcadoInfo ? JSON.parse(fech.forcadoInfo) : null,
    // Só pode liberar quando não há PENDENTE nem CONTESTADO em aberto.
    podeLiberar: resumo.pendentes === 0 && resumo.contestados === 0,
    // Com contestação aberta, a liberação (nem forçada) fica indisponível.
    temContestacaoAberta: resumo.contestados > 0,
  })
}
