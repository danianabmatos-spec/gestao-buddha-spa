import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadeEfetiva } from '@/lib/auth/guard'
import { tetoDiario, diasUteisEntre, ehFimDeSemana, montarPlano } from '@/lib/inteligencia/plano-envio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const unidade = unidadeEfetiva(session, searchParams.get('unidade'), 'shopping-metropole')

  const hoje = new Date()
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0)
  const limite20 = new Date(hoje); limite20.setDate(limite20.getDate() - 20)
  // "não contatado recentemente" (para não remandar dentro do mês)
  const naoRecente = { OR: [{ ultimoContato: null }, { ultimoContato: { lt: limite20 } }] }

  // 1) Primeiro envio da unidade (para o aquecimento do teto)
  const [primHist, primTP] = await Promise.all([
    prisma.historicoContato.aggregate({ where: { unidadeSlug: unidade }, _min: { criadoEm: true } }),
    prisma.clienteTotalPass.aggregate({ where: { unidadeSlug: unidade, ultimoContato: { not: null } }, _min: { ultimoContato: true } }),
  ])
  const candidatas = [primHist._min.criadoEm, primTP._min.ultimoContato].filter(Boolean) as Date[]
  const primeiroEnvio = candidatas.length ? new Date(Math.min(...candidatas.map(d => new Date(d).getTime()))) : null
  const diasAtivos = primeiroEnvio ? diasUteisEntre(primeiroEnvio, hoje) : 0
  const cap = tetoDiario(diasAtivos)

  // 2) Enviadas hoje (fila + totalpass)
  const [hojeHist, hojeTP] = await Promise.all([
    prisma.historicoContato.count({ where: { unidadeSlug: unidade, criadoEm: { gte: inicioDia } } }),
    prisma.clienteTotalPass.count({ where: { unidadeSlug: unidade, ultimoContato: { gte: inicioDia } } }),
  ])
  const enviadasHoje = hojeHist + hojeTP

  // 3) Pendentes por cluster (não agendados, não contatados recentemente)
  const [pac, freq, freqSem, tp] = await Promise.all([
    prisma.clienteScore.groupBy({ by: ['statusPacote'], where: { unidadeSlug: unidade, temPacote: true, temAgendamentoFuturo: false, ...naoRecente }, _count: { _all: true } }),
    prisma.clienteScore.groupBy({ by: ['statusFrequencia'], where: { unidadeSlug: unidade, temPacote: false, isFrequenteSemPacote: false, temAgendamentoFuturo: false, ...naoRecente }, _count: { _all: true } }),
    prisma.clienteScore.count({ where: { unidadeSlug: unidade, isFrequenteSemPacote: true, temAgendamentoFuturo: false, ...naoRecente } }),
    prisma.clienteTotalPass.groupBy({ by: ['sessoesMes'], where: { unidadeSlug: unidade, planoCancelado: false, sessoesMes: { lt: 2 }, ...naoRecente }, _count: { _all: true } }),
  ])
  const pendentes: Record<string, number> = {}
  for (const g of pac) if (g.statusPacote) pendentes[g.statusPacote] = g._count._all
  // Só as frequências ACIONÁVEIS (evita colidir 'ATIVO' de frequência com o de pacote)
  for (const g of freq) {
    if (g.statusFrequencia === 'NOVO' || g.statusFrequencia === 'EM_RISCO' || g.statusFrequencia === 'PERDIDO') {
      pendentes[g.statusFrequencia] = g._count._all
    }
  }
  pendentes['FREQUENTE_SEM_PACOTE'] = freqSem
  for (const g of tp) {
    const k = g.sessoesMes <= 0 ? 'TP0' : 'TP1'
    pendentes[k] = (pendentes[k] ?? 0) + g._count._all
  }

  const plano = montarPlano(pendentes, cap, enviadasHoje)

  return NextResponse.json({
    unidade,
    cap,
    enviadasHoje,
    restante: Math.max(0, cap - enviadasHoje),
    aFazer: plano.totalAFazer,
    diasAtivos,
    fimDeSemana: ehFimDeSemana(hoje),
    itens: plano.itens,
  })
}
