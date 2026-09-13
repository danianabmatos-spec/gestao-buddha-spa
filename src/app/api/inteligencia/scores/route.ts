import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAutoSync } from '@/lib/inteligencia/scheduler'
import { getSession, unauthorized, unidadeEfetiva } from '@/lib/auth/guard'
import { resolverCluster, motivoSupressao } from '@/lib/inteligencia/mensagens'
import type { StatusFrequencia, StatusPacote } from '@/lib/inteligencia/mensagens'

ensureAutoSync()

// Ordem de prioridade dentro de cada grupo de pacote
const PRIORIDADE_PACOTE: Record<string, number> = {
  A_VENCER:       1,  // urgente — renovar antes de vencer
  VENCIDO_ATE30:  2,  // janela grátis (30 dias) — usar antes de expirar
  FINALIZADO_30:  3,  // acabou de finalizar — renovação quente
  VENCIDO_MAIS30: 4,  // reativar com 20%
  FINALIZADO_90:  5,
  FINALIZADO_180: 6,
  FINALIZADO_PLUS: 7,
  ATIVO:          8,  // convite para agendar
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  // RECEPÇÃO é sempre travada na própria unidade; DONA escolhe via ?unidade=
  const unidade  = unidadeEfetiva(session, searchParams.get('unidade'), 'shopping-metropole')
  const statusFreq    = searchParams.get('statusFrequencia') || undefined
  const statusPacote  = searchParams.get('statusPacote') || undefined
  const frequente     = searchParams.get('isFrequenteSemPacote')

  const hoje = new Date()
  const inicioDia = new Date(hoje)
  inicioDia.setHours(0, 0, 0, 0)

  const where: Record<string, unknown> = {
    unidadeSlug: unidade,
    // Oculta clientes já contatados hoje
    OR: [
      { ultimoContato: null },
      { ultimoContato: { lt: inicioDia } },
    ],
  }

  if (statusFreq) where.statusFrequencia = statusFreq
  if (statusPacote) {
    if (statusPacote === 'COM_PACOTE')      where.temPacote = true
    else if (statusPacote === 'SEM_PACOTE') where.temPacote = false
    else                                    where.statusPacote = statusPacote
  }
  if (frequente === 'true') where.isFrequenteSemPacote = true

  // Busca em 2 partes para garantir que TODOS os clientes com pacote apareçam
  // (são poucos e prioritários) e limitar só os de frequência (podem ser milhares).
  const [clientesPacote, clientesFreq] = await Promise.all([
    prisma.clienteScore.findMany({
      where: { ...where, temPacote: true },
      orderBy: [{ ultimaSessao: 'desc' }],
      take: 2000,
    }),
    prisma.clienteScore.findMany({
      where: { ...where, temPacote: false },
      orderBy: [{ statusFrequencia: 'asc' }, { ultimaSessao: 'desc' }],
      take: 800,
    }),
  ])
  const clientes = [...clientesPacote, ...clientesFreq]

  // Contagens por grupo (total, incluindo contatados)
  const whereTotal: Record<string, unknown> = { unidadeSlug: unidade }
  const [freqCounts, pacoteCounts, frequenteCount] = await Promise.all([
    prisma.clienteScore.groupBy({
      by: ['statusFrequencia'],
      // Frequência conta só quem NÃO tem pacote e NÃO é frequente-sem-pacote
      // (cascata: pacote > frequente-sem-pacote > frequência) → 1 cluster por cliente
      where: { ...whereTotal, temPacote: false, isFrequenteSemPacote: false },
      _count: { statusFrequencia: true },
    }),
    prisma.clienteScore.groupBy({
      by: ['statusPacote'],
      where: { ...whereTotal, temPacote: true },
      _count: { statusPacote: true },
    }),
    prisma.clienteScore.count({
      where: { ...whereTotal, isFrequenteSemPacote: true },
    }),
  ])

  const resumoFrequencia: Record<string, number> = {}
  for (const g of freqCounts) {
    resumoFrequencia[g.statusFrequencia] = g._count.statusFrequencia
  }

  const resumoPacote: Record<string, number> = { FREQUENTE_SEM_PACOTE: frequenteCount }
  for (const g of pacoteCounts) {
    if (g.statusPacote) resumoPacote[g.statusPacote] = g._count.statusPacote
  }

  const clientesComDias = clientes
    .map((c) => {
      const diasSemSessao = c.ultimaSessao
        ? Math.floor((hoje.getTime() - new Date(c.ultimaSessao).getTime()) / (1000 * 60 * 60 * 24))
        : null
      const diasParaVencer = c.dataVencimentoPacote
        ? Math.floor((new Date(c.dataVencimentoPacote).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        : null
      const prioridade = PRIORIDADE_PACOTE[c.statusPacote ?? ''] ?? 99
      // Cluster da mensagem (para referência) + trava anti-mensagem-errada
      const cluster = resolverCluster(
        c.statusFrequencia as StatusFrequencia,
        c.statusPacote as StatusPacote | null,
        c.isFrequenteSemPacote,
      )
      const motivoBloqueio = motivoSupressao(c.statusPacote as StatusPacote | null, {
        temAgendamentoFuturo: c.temAgendamentoFuturo,
      })
      return { ...c, diasSemSessao, diasParaVencer, prioridade, cluster, bloqueado: !!motivoBloqueio, motivoBloqueio }
    })
    // Prioriza: pacote por prioridade → não-agendados (acionáveis) antes → depois por urgência
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade
      // Dentro do grupo: quem AINDA NÃO está agendado/bloqueado vem primeiro (facilita a ação)
      if (a.bloqueado !== b.bloqueado) return a.bloqueado ? 1 : -1
      // A_VENCER: vence mais cedo primeiro
      if (a.statusPacote === 'A_VENCER') {
        return (a.diasParaVencer ?? 99) - (b.diasParaVencer ?? 99)
      }
      // EM_RISCO: mais próximo de ser perdido primeiro
      if (a.statusFrequencia === 'EM_RISCO') {
        return (b.diasSemSessao ?? 0) - (a.diasSemSessao ?? 0)
      }
      // FREQUENTE_SEM_PACOTE: mais sessões primeiro
      if (a.isFrequenteSemPacote) return (b.totalSessoes ?? 0) - (a.totalSessoes ?? 0)
      return 0
    })

  return NextResponse.json({ clientes: clientesComDias, resumoFrequencia, resumoPacote, unidade })
}
