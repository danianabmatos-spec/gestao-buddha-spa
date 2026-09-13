import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnidadesDisponiveis } from '@/lib/belle/unidades-config'
import { tetoDiario, diasUteisEntre, ehFimDeSemana } from '@/lib/inteligencia/plano-envio'
import { autorizadoErp } from '@/lib/erp/auth'
import { idsReservados } from '@/lib/inteligencia/reservas'
import {
  resolverCluster, motivoSupressao, gerarMensagemWhatsApp,
  CLUSTERS_MENSAGEM,
} from '@/lib/inteligencia/mensagens'
import type { StatusFrequencia, StatusPacote, ClusterMensagem } from '@/lib/inteligencia/mensagens'

// ─── Fase 1 da integração Inteligência → Central de Atendimento ─────────────────
// Expõe, para a Central consumir, a FILA ACIONÁVEL do dia de UMA unidade + o teto
// anti-ban + a mensagem já sugerida. Serviço-a-serviço: autentica por `x-erp-key`
// (mesma chave que o ERP usa para falar com a Central). Fora da proteção de login
// do proxy (o matcher só cobre /api/inteligencia/*), então protege-se aqui.
//
// A Central mostra esta fila à recepção, envia pelo PRÓPRIO número (histórico único)
// e depois confirma o envio de volta (endpoint /concluir — Fase 2).

export const dynamic = 'force-dynamic'

const MAX_TAREFAS = 500

// Ordem de prioridade dentro dos grupos de pacote (espelha /api/inteligencia/scores)
const PRIORIDADE_PACOTE: Record<string, number> = {
  A_VENCER: 1, VENCIDO_ATE30: 2, FINALIZADO_30: 3, VENCIDO_MAIS30: 4,
  FINALIZADO_90: 5, FINALIZADO_180: 6, FINALIZADO_PLUS: 7, ATIVO: 8,
}
// Frequência acionável fica logo após os pacotes
const PRIORIDADE_FREQ: Record<string, number> = {
  EM_RISCO: 20, FREQUENTE_SEM_PACOTE: 21, PERDIDO: 22, NOVO: 23,
}

const LABEL_POR_CLUSTER = new Map(CLUSTERS_MENSAGEM.map((c) => [c.cluster, c.label]))

export async function GET(req: NextRequest) {
  if (!autorizadoErp(req)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const unidade = new URL(req.url).searchParams.get('unidade') || ''
  if (!getUnidadesDisponiveis().includes(unidade)) {
    return NextResponse.json({ error: 'unidade inválida ou não informada' }, { status: 400 })
  }

  const hoje = new Date()
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0)
  const limite20 = new Date(hoje); limite20.setDate(limite20.getDate() - 20)
  // "não contatado recentemente" — evita remandar dentro do mês
  const naoRecente = { OR: [{ ultimoContato: null }, { ultimoContato: { lt: limite20 } }] }

  // Templates editáveis (cluster → texto). Sem edição salva, usa o padrão.
  const salvos = await prisma.templateMensagem.findMany()
  const templates = Object.fromEntries(salvos.map((t) => [t.cluster, t.texto])) as Partial<Record<ClusterMensagem, string>>

  // ── Teto anti-ban do dia (mesma regra do /api/inteligencia/plano-dia) ──────────
  const [primHist, primTP, hojeHist, hojeTP] = await Promise.all([
    prisma.historicoContato.aggregate({ where: { unidadeSlug: unidade }, _min: { criadoEm: true } }),
    prisma.clienteTotalPass.aggregate({ where: { unidadeSlug: unidade, ultimoContato: { not: null } }, _min: { ultimoContato: true } }),
    prisma.historicoContato.count({ where: { unidadeSlug: unidade, criadoEm: { gte: inicioDia } } }),
    prisma.clienteTotalPass.count({ where: { unidadeSlug: unidade, ultimoContato: { gte: inicioDia } } }),
  ])
  const primeiras = [primHist._min.criadoEm, primTP._min.ultimoContato].filter(Boolean) as Date[]
  const primeiroEnvio = primeiras.length ? new Date(Math.min(...primeiras.map((d) => new Date(d).getTime()))) : null
  const diasAtivos = primeiroEnvio ? diasUteisEntre(primeiroEnvio, hoje) : 0
  const cap = tetoDiario(diasAtivos)
  const enviadasHoje = hojeHist + hojeTP

  // ── Fila acionável (não agendados, não contatados recentemente, com telefone) ──
  const [comPacote, semPacote] = await Promise.all([
    prisma.clienteScore.findMany({
      where: { unidadeSlug: unidade, temPacote: true, temAgendamentoFuturo: false, ...naoRecente },
      take: 2000,
    }),
    prisma.clienteScore.findMany({
      where: {
        unidadeSlug: unidade, temPacote: false, temAgendamentoFuturo: false,
        AND: [
          naoRecente,
          { OR: [{ isFrequenteSemPacote: true }, { statusFrequencia: { in: ['NOVO', 'EM_RISCO', 'PERDIDO'] } }] },
        ],
      },
      take: 1000,
    }),
  ])

  const reservados = idsReservados() // esconde quem outra atendente já está trabalhando

  const tarefas = [...comPacote, ...semPacote]
    .filter((c) => c.telefone && c.telefone.trim())
    .filter((c) => !reservados.has(c.id))
    // Reforço da trava anti-mensagem-errada (além do filtro de agendamento na query)
    .filter((c) => !motivoSupressao(c.statusPacote as StatusPacote | null, { temAgendamentoFuturo: c.temAgendamentoFuturo }))
    .map((c) => {
      const diasParaVencer = c.dataVencimentoPacote
        ? Math.floor((new Date(c.dataVencimentoPacote).getTime() - hoje.getTime()) / 86_400_000)
        : null
      const diasSemSessao = c.ultimaSessao
        ? Math.floor((hoje.getTime() - new Date(c.ultimaSessao).getTime()) / 86_400_000)
        : null
      const cluster = resolverCluster(
        c.statusFrequencia as StatusFrequencia,
        c.statusPacote as StatusPacote | null,
        c.isFrequenteSemPacote,
      )
      const prioridade = c.temPacote
        ? (PRIORIDADE_PACOTE[c.statusPacote ?? ''] ?? 99)
        : (PRIORIDADE_FREQ[c.isFrequenteSemPacote ? 'FREQUENTE_SEM_PACOTE' : c.statusFrequencia] ?? 99)
      return {
        clienteScoreId: c.id,
        nome: c.nomeCliente,
        telefone: c.telefone,
        motivo: cluster,
        motivoLabel: LABEL_POR_CLUSTER.get(cluster) ?? cluster,
        statusPacote: c.statusPacote,
        statusFrequencia: c.statusFrequencia,
        nomePlano: c.nomePlano,
        sessoesRestantes: c.sessoesRestantes,
        diasParaVencer,
        diasSemSessao,
        prioridade,
        mensagemSugerida: gerarMensagemWhatsApp(
          c.statusFrequencia as StatusFrequencia,
          c.statusPacote as StatusPacote | null,
          c.isFrequenteSemPacote,
          c.nomeCliente,
          diasParaVencer,
          templates,
          { sessoes: c.sessoesRestantes, validade: c.dataVencimentoPacote },
        ),
      }
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade
      if (a.statusPacote === 'A_VENCER') return (a.diasParaVencer ?? 99) - (b.diasParaVencer ?? 99)
      return (b.diasSemSessao ?? 0) - (a.diasSemSessao ?? 0)
    })
    .slice(0, MAX_TAREFAS)

  return NextResponse.json({
    unidade,
    geradoEm: hoje.toISOString(),
    teto: {
      cap,
      enviadasHoje,
      restante: Math.max(0, cap - enviadasHoje),
      diasAtivos,
      fimDeSemana: ehFimDeSemana(hoje),
    },
    total: tarefas.length,
    tarefas,
  })
}
