import { prisma } from '../prisma'
import { getClientesBelle, getPlanosClientes } from './relatorio-clientes'
import { getAgendamentosFuturos } from '../belle/client'
import { getUnidadeCredenciais } from '../belle/unidades-config'
import { sincronizarTotalPass } from './totalpass'

// Janela (em dias) para checar agendamentos futuros. 0 = desativa a checagem.
const AGENDA_DIAS = Number(process.env.AGENDAMENTOS_FUTUROS_DIAS ?? '30')
import type { StatusFrequencia, StatusPacote } from './mensagens'

export type { StatusFrequencia, StatusPacote }
export { gerarMensagemWhatsApp } from './mensagens'

// Filtros do Report 194 ("[Buddha] Clientes") — IDs variam por conta Belle
// Grupo A (Metrópole, Tatuapé, Shopping Anália, Higienópolis): 2857/2859
// Grupo B (Mooca, Anália Franco, Perdizes): 2767/2769
const CLIENTES_FILTROS: Record<string, { cadastro: number; ultAtend: number }> = {
  'shopping-metropole':     { cadastro: 2857, ultAtend: 2859 },
  'tatuape-gomescardim':    { cadastro: 2857, ultAtend: 2859 },
  'shopping-analia-franco': { cadastro: 2857, ultAtend: 2859 },
  'higienopolis':           { cadastro: 2857, ultAtend: 2859 },
  'mooca-plaza':            { cadastro: 2767, ultAtend: 2769 },
  'analia-franco':          { cadastro: 2767, ultAtend: 2769 },
  'perdizes':               { cadastro: 2767, ultAtend: 2769 },
}

// Todas as unidades usam Report 196 — "[Buddha] Relatório de Sessões de Planos"
// Filtros: id=1 (Período: vendas 5 anos) + id=2 (Validade: -5 anos a +5 anos)
const PLANOS_REPORT_ID = 196

// ─── Classificação de frequência ──────────────────────────────────────────────

function diasDesde(data: Date | null): number | null {
  if (!data) return null
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

function classificarFrequencia(
  dataCadastro: Date | null,
  ultimaSessao: Date | null,
): StatusFrequencia {
  // NOVO: cadastrado nos últimos 30 dias
  const diasCadastro = diasDesde(dataCadastro)
  if (diasCadastro !== null && diasCadastro <= 30) return 'NOVO'

  // Para os demais: baseado na última sessão
  const dias = diasDesde(ultimaSessao)
  if (dias === null || dias >= 90) return 'PERDIDO'
  if (dias >= 60) return 'EM_RISCO'
  return 'ATIVO'
}

// ─── Classificação de pacote ──────────────────────────────────────────────────

function classificarPacote(
  validade: Date | null,
  sessoesRestantes: number,
  ultimaSessao: Date | null,
): StatusPacote {
  // Sessões esgotadas → FINALIZADO, subdividido por dias desde a ÚLTIMA SESSÃO usada
  if (sessoesRestantes === 0) {
    const dias = diasDesde(ultimaSessao)
    if (dias === null)   return 'FINALIZADO_PLUS'  // sem data → conservador (menos urgente)
    if (dias <= 30)      return 'FINALIZADO_30'
    if (dias <= 90)      return 'FINALIZADO_90'
    if (dias <= 180)     return 'FINALIZADO_180'
    return 'FINALIZADO_PLUS'
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (!validade) return 'ATIVO'  // sem data de vencimento → ativo

  const dias = Math.floor((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  if (dias >= 0 && dias <= 30) return 'A_VENCER'   // vence nos próximos 30 dias
  if (dias >= 0)               return 'ATIVO'       // ativo com prazo folgado

  // Validade passou (ainda tem sessões) — 2 faixas
  const diasVencido = Math.abs(dias)
  if (diasVencido <= 30) return 'VENCIDO_ATE30'   // pode usar sem custo em até 30 dias
  return 'VENCIDO_MAIS30'                           // reativar com 20% do valor
}

// ─── Motor principal ──────────────────────────────────────────────────────────

export async function calcularScoresUnidade(unidadeSlug: string): Promise<number> {
  const config = getUnidadeCredenciais(unidadeSlug)
  if (!config) throw new Error(`Unidade não encontrada: ${unidadeSlug}`)

  const clientesFiltros = CLIENTES_FILTROS[unidadeSlug] ?? { cadastro: 2857, ultAtend: 2859 }

  // Busca em paralelo: clientes (frequência) + planos (pacotes) + agendamentos futuros
  const [clientes, planos, agendados] = await Promise.all([
    getClientesBelle(config.email, config.password, String(config.estab), clientesFiltros.cadastro, clientesFiltros.ultAtend),
    getPlanosClientes(config.email, config.password, String(config.estab), PLANOS_REPORT_ID),
    // Sem .catch: se a agenda falhar, o sync aborta e MANTÉM os dados anteriores
    // (não zera temAgendamentoFuturo → não manda msg para quem já tem horário).
    getAgendamentosFuturos(config.email, config.password, config.estab, AGENDA_DIAS),
  ])

  // Mapas de lookup: por ID (preferencial, evita homônimos) e por nome (fallback)
  const planoPorId = new Map<number, typeof planos[0]>()
  const planoPorNome = new Map<string, typeof planos[0]>()
  for (const p of planos) {
    if (p.clienteId != null) planoPorId.set(p.clienteId, p)
    planoPorNome.set(p.nomeCliente.toLowerCase(), p)
  }
  const planosMatchados = new Set<typeof planos[0]>()
  function acharPlano(clienteId: number | null, nomeLower: string): typeof planos[0] | undefined {
    if (clienteId != null && planoPorId.has(clienteId)) return planoPorId.get(clienteId)
    return planoPorNome.get(nomeLower)
  }

  // Filtra clientes com pelo menos 1 sessão OU cadastro recente (NOVO)
  const clientesValidos = clientes.filter((c) => {
    const diasCad = diasDesde(c.dataCadastro)
    const isNovo = diasCad !== null && diasCad <= 30
    return isNovo || c.totalSessoes > 0 || c.ultimaSessao !== null
  })

  // Conjunto de nomes já processados (para deduplica planos)
  const nomesProcessados = new Set<string>()
  let salvos = 0

  for (const cliente of clientesValidos) {
    const nomeLower = cliente.nome.toLowerCase()
    nomesProcessados.add(nomeLower)
    const plano = acharPlano(cliente.clienteId, nomeLower)
    if (plano) planosMatchados.add(plano)

    const statusFrequencia = classificarFrequencia(cliente.dataCadastro, cliente.ultimaSessao)

    let temPacote = false
    let statusPacote: StatusPacote | null = null
    let nomePlano: string | null = null
    let dataVencimentoPacote: Date | null = null
    let sessoesRestantes = 0
    let temPacoteAtivo = false
    let temPacoteSuspenso = false

    if (plano) {
      temPacote = true
      nomePlano = plano.nomePlano
      dataVencimentoPacote = plano.validade
      sessoesRestantes = plano.sessoesRestantes
      statusPacote = classificarPacote(plano.validade, plano.sessoesRestantes, cliente.ultimaSessao)
      temPacoteAtivo = plano.temPlanoAtivo
      temPacoteSuspenso = plano.temPlanoSuspenso
    }

    const isFrequenteSemPacote = !temPacote && cliente.totalSessoes >= 3

    // Agendamento futuro: casa por TELEFONE (robusto) OU por nome (fallback)
    const telDig = (cliente.telefone ?? '').replace(/\D/g, '')
    const agendou = agendados.nomes.has(nomeLower) || (telDig.length >= 10 && agendados.telefones.has(telDig))

    await prisma.clienteScore.upsert({
      where: { unidadeSlug_nomeCliente: { unidadeSlug, nomeCliente: cliente.nome } },
      create: {
        unidadeSlug,
        clienteId: cliente.clienteId,
        nomeCliente: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        dataCadastro: cliente.dataCadastro,
        primeiraSessao: cliente.primeiraSessao,
        ultimaSessao: cliente.ultimaSessao,
        totalSessoes: cliente.totalSessoes,
        statusFrequencia,
        temPacote,
        statusPacote,
        nomePlano,
        dataVencimentoPacote,
        sessoesRestantes,
        temPacoteAtivo,
        temPacoteSuspenso,
        temAgendamentoFuturo: agendou,
        isFrequenteSemPacote,
        ultimoCalculo: new Date(),
      },
      update: {
        clienteId: cliente.clienteId,
        telefone: cliente.telefone,
        email: cliente.email,
        dataCadastro: cliente.dataCadastro,
        primeiraSessao: cliente.primeiraSessao,
        ultimaSessao: cliente.ultimaSessao,
        totalSessoes: cliente.totalSessoes,
        statusFrequencia,
        temPacote,
        statusPacote,
        nomePlano,
        dataVencimentoPacote,
        sessoesRestantes,
        temPacoteAtivo,
        temPacoteSuspenso,
        temAgendamentoFuturo: agendou,
        isFrequenteSemPacote,
        ultimoCalculo: new Date(),
      },
    })
    salvos++
  }

  // Clientes com pacote que não apareceram no Report 194 (cadastro antigo)
  for (const plano of planos) {
    if (planosMatchados.has(plano)) continue  // já casado com um cliente acima
    const nomeLower = plano.nomeCliente.toLowerCase()
    if (nomesProcessados.has(nomeLower)) continue  // já processado acima

    // planos-only (sem histórico do Report 194) → sem última sessão conhecida
    const statusPacote = classificarPacote(plano.validade, plano.sessoesRestantes, null)

    await prisma.clienteScore.upsert({
      where: { unidadeSlug_nomeCliente: { unidadeSlug, nomeCliente: plano.nomeCliente } },
      create: {
        unidadeSlug,
        clienteId: plano.clienteId,
        nomeCliente: plano.nomeCliente,
        statusFrequencia: 'ATIVO',  // tem pacote → presumir ativo
        temPacote: true,
        statusPacote,
        nomePlano: plano.nomePlano,
        dataVencimentoPacote: plano.validade,
        sessoesRestantes: plano.sessoesRestantes,
        temPacoteAtivo: plano.temPlanoAtivo,
        temPacoteSuspenso: plano.temPlanoSuspenso,
        temAgendamentoFuturo: agendados.nomes.has(plano.nomeCliente.toLowerCase()),
        isFrequenteSemPacote: false,
        ultimoCalculo: new Date(),
      },
      update: {
        clienteId: plano.clienteId,
        temPacote: true,
        statusPacote,
        nomePlano: plano.nomePlano,
        dataVencimentoPacote: plano.validade,
        sessoesRestantes: plano.sessoesRestantes,
        temPacoteAtivo: plano.temPlanoAtivo,
        temPacoteSuspenso: plano.temPlanoSuspenso,
        temAgendamentoFuturo: agendados.nomes.has(plano.nomeCliente.toLowerCase()),
        isFrequenteSemPacote: false,
        ultimoCalculo: new Date(),
      },
    })
    salvos++
  }

  // ─── Detecção de conversões ─────────────────────────────────────────────────
  // Para cada contato dos últimos 30 dias ainda não convertido, verifica se
  // o cliente teve nova sessão ou renovação de pacote após o contato.
  await detectarConversoes(unidadeSlug)

  // Base TotalPass (best-effort — não quebra o sync principal se falhar)
  try {
    await sincronizarTotalPass(unidadeSlug)
  } catch (err) {
    console.error(`[totalpass] ${unidadeSlug}: erro —`, err instanceof Error ? err.message : String(err))
  }

  return salvos
}

async function detectarConversoes(unidadeSlug: string): Promise<void> {
  const trintaDias = new Date()
  trintaDias.setDate(trintaDias.getDate() - 30)

  const pendentes = await prisma.historicoContato.findMany({
    where: {
      unidadeSlug,
      converteu: false,
      criadoEm: { gte: trintaDias },
      clienteScoreId: { not: null },
    },
  })

  for (const contato of pendentes) {
    const atual = await prisma.clienteScore.findUnique({
      where: { id: contato.clienteScoreId! },
      select: { ultimaSessao: true, statusPacote: true, temPacote: true },
    })
    if (!atual) continue

    const novaSessao = atual.ultimaSessao && contato.ultimaSessaoSnap
      && new Date(atual.ultimaSessao) > new Date(contato.criadoEm)

    const renovouPacote = atual.statusPacote === 'ATIVO'
      && contato.statusPacoteSnap?.startsWith('VENCIDO')

    const adquiriuPacote = atual.temPacote && !contato.statusPacoteSnap

    if (novaSessao || renovouPacote || adquiriuPacote) {
      await prisma.historicoContato.update({
        where: { id: contato.id },
        data: {
          converteu: true,
          tipoConversao: adquiriuPacote ? 'novo_pacote' : renovouPacote ? 'renovacao_pacote' : 'nova_sessao',
          dataConversao: new Date(),
        },
      })
    }
  }
}
