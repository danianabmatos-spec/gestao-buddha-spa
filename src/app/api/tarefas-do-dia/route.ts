import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  resolverClusterCentral,
  resolverClusterTotalPassCentral,
  clusterEnviaHoje,
  contextoDiaBrasil,
  janelaRecencia,
  gerarMensagemCentral,
  telefoneCanonico,
  TITULO_CENTRAL,
  PRIO_CENTRAL,
  tipoTarefaCentral,
  prioridadeLabelCentral,
  type ClusterCentral,
} from '@/lib/inteligencia/central-clusters'

// Endpoint consumido pela Central de Atendimento (servidor-a-servidor).
// Devolve as "tarefas do dia" da Inteligência de Clientes já FILTRADAS pelo
// calendário de envio de cada cluster (só o que deve sair HOJE), por unidade
// (a Central envia o NOME da unidade). Autenticação por Bearer token compartilhado.
//
// São 6 clusters (1 cliente em cada, pelo plano mais atual). Regras gerais:
//   • não contatar quem tem agendamento futuro nem plano suspenso;
//   • prioridade TotalPass > Pacote vigente > Pacote vencido <1a > Frequente > Sentimos falta.
// A lógica dos clusters/calendário vive em @/lib/inteligencia/central-clusters.

export const dynamic = 'force-dynamic'

// Unidades: slug interno do ERP ↔ nome exibido (o que a Central envia no ?unidade=)
const UNIDADES = [
  { slug: 'shopping-metropole',     nome: 'Shopping Metrópole' },
  { slug: 'analia-franco',          nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes',               nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim',    nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza',            nome: 'Mooca Plaza' },
  { slug: 'higienopolis',           nome: 'Higienópolis' },
]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const NOME_PARA_SLUG = new Map(UNIDADES.map((u) => [norm(u.nome), u.slug]))
const SLUG_PARA_NOME = new Map(UNIDADES.map((u) => [u.slug, u.nome]))

function telefoneComDDI(t: string | null): string {
  const d = String(t ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.length >= 12 && d.startsWith('55') ? d : '55' + d
}

function autorizado(req: NextRequest): boolean {
  const token = process.env.CENTRAL_BEARER_TOKEN
  if (!token) return false // fail-closed: sem token configurado, nega
  return req.headers.get('authorization') === `Bearer ${token}`
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'nao_autorizado' }, { status: 401 })

  const nomeUnidade = new URL(req.url).searchParams.get('unidade')?.trim() || ''
  let slugs: string[]
  if (nomeUnidade) {
    const slug = NOME_PARA_SLUG.get(norm(nomeUnidade))
    if (!slug) return NextResponse.json({ tarefas: [] }) // unidade desconhecida → vazio
    slugs = [slug]
  } else {
    slugs = UNIDADES.map((u) => u.slug) // sem filtro → todas
  }

  const hoje = new Date()
  const nowMs = hoje.getTime()
  const ctxDia = contextoDiaBrasil(hoje)

  // Pré-filtro de recência na query: a MENOR janela é 7d (Pacote vigente); o restante
  // é conferido depois por cluster (passouRecencia).
  const limite7 = new Date(hoje); limite7.setDate(limite7.getDate() - 7)
  const naoRecente = { OR: [{ ultimoContato: null }, { ultimoContato: { lt: limite7 } }] }
  const passouRecencia = (ultimoContato: Date | null, cluster: ClusterCentral) => {
    if (!ultimoContato) return true
    const dias = Math.floor((nowMs - new Date(ultimoContato).getTime()) / 86_400_000)
    return dias >= janelaRecencia(cluster)
  }

  // De-para: os textos editáveis são salvos com a taxonomia interna (ClusterMensagem,
  // ex.: TOTALPASS_1), mas a Central gera pela taxonomia ClusterCentral (ex.:
  // TOTALPASS_1_SESSAO). Reindexamos os textos salvos pelos nomes da Central para que
  // as edições do editor de mensagens reflitam nas tarefas consumidas pela Central.
  const CENTRAL_PARA_EDITOR: Record<ClusterCentral, string> = {
    TOTALPASS_1_SESSAO: 'TOTALPASS_1',
    TOTALPASS_2_SESSOES: 'TOTALPASS_2',
    PACOTE_VIGENTE: 'PACOTE_ATIVO',
    FREQUENTE_SEM_PLANO: 'FREQUENTE_SEM_PACOTE',
    PACOTE_VENCIDO_RENOVAR: 'PACOTE_VENCIDO_MAIS30', // aproximado
    SENTIMOS_FALTA: 'PERDIDO',                       // aproximado
  }
  const salvos = Object.fromEntries(
    (await prisma.templateMensagem.findMany()).map((t) => [t.cluster, t.texto]),
  ) as Record<string, string>
  const templates = Object.fromEntries(
    (Object.entries(CENTRAL_PARA_EDITOR) as [ClusterCentral, string][])
      .map(([central, editor]) => [central, salvos[editor]])
      .filter(([, texto]) => texto),
  ) as Partial<Record<ClusterCentral, string>>

  const [comPacote, frequente, totalpass, comAgenda, bloqueados] = await Promise.all([
    // Pacote vigente / vencido / sentimos-falta (ex-pacote). Suspenso é excluído já aqui.
    prisma.clienteScore.findMany({
      where: {
        unidadeSlug: { in: slugs },
        temPacote: true, temAgendamentoFuturo: false, temPacoteSuspenso: false,
        ...naoRecente,
      },
      take: 5000,
    }),
    // Frequente sem plano (3+ sessões avulsas).
    prisma.clienteScore.findMany({
      where: {
        unidadeSlug: { in: slugs },
        temPacote: false, temAgendamentoFuturo: false, isFrequenteSemPacote: true,
        ...naoRecente,
      },
      take: 3000,
    }),
    prisma.clienteTotalPass.findMany({
      where: { unidadeSlug: { in: slugs }, planoCancelado: false, sessoesMes: { lt: 2 }, ...naoRecente },
      take: 2000,
    }),
    // Telefones (na unidade) com agendamento futuro — para NÃO contatar quem já vem.
    // Cobre o TotalPass, cujo telefone vem do ClienteScore no sync.
    prisma.clienteScore.findMany({
      where: { unidadeSlug: { in: slugs }, temAgendamentoFuturo: true, telefone: { not: null } },
      select: { telefone: true },
    }),
    // Bloqueios manuais (cancelamento / opt-out): das unidades consultadas + globais ("*").
    prisma.contatoBloqueado.findMany({
      where: { unidadeSlug: { in: [...slugs, '*'] } },
      select: { unidadeSlug: true, telefone: true },
    }),
  ])
  const telsComAgenda = new Set(
    comAgenda.map((c) => String(c.telefone ?? '').replace(/\D/g, '')).filter((t) => t.length >= 10),
  )
  // Bloqueio global ("*") vale para todos; bloqueio de unidade só casa unidade+telefone.
  // Telefone canonizado (sem DDI 55) nos dois lados para não haver falso-negativo.
  const bloqGlobal = new Set(bloqueados.filter((b) => b.unidadeSlug === '*').map((b) => telefoneCanonico(b.telefone)))
  const bloqUnidade = new Set(
    bloqueados.filter((b) => b.unidadeSlug !== '*').map((b) => b.unidadeSlug + '|' + telefoneCanonico(b.telefone)),
  )
  const estaBloqueado = (unidadeSlug: string, telDig: string) => {
    const c = telefoneCanonico(telDig)
    return bloqGlobal.has(c) || bloqUnidade.has(unidadeSlug + '|' + c)
  }

  interface Item {
    chave: string
    prio: number
    ds: number
    cluster: ClusterCentral
    telefone: string        // dígitos, para o calendário de distribuição
    ultimoContato: Date | null
    tarefa: Record<string, unknown>
  }
  const itens: Item[] = []

  // Fonte 1 — Inteligência de pacote/frequência (ClienteScore)
  for (const c of [...comPacote, ...frequente]) {
    if (!c.telefone || !c.telefone.trim()) continue
    const cluster = resolverClusterCentral(
      {
        temPacoteAtivo: c.temPacoteAtivo,
        temPacoteSuspenso: c.temPacoteSuspenso,
        temAgendamentoFuturo: c.temAgendamentoFuturo,
        dataVencimentoPacote: c.dataVencimentoPacote,
        sessoesRestantes: c.sessoesRestantes,
        ultimaSessao: c.ultimaSessao,
        totalSessoes: c.totalSessoes,
      },
      nowMs,
    )
    if (!cluster) continue
    const telDig = String(c.telefone).replace(/\D/g, '')
    if (estaBloqueado(c.unidadeSlug, telDig)) continue // cancelado / opt-out
    const ds = c.ultimaSessao ? Math.floor((nowMs - new Date(c.ultimaSessao).getTime()) / 86_400_000) : 9999
    itens.push({
      chave: c.unidadeSlug + '|' + telDig,
      prio: PRIO_CENTRAL[cluster],
      ds,
      cluster,
      telefone: telDig,
      ultimoContato: c.ultimoContato,
      tarefa: {
        id: String(c.id),
        titulo: TITULO_CENTRAL[cluster],
        cliente: c.nomeCliente,
        telefone: telefoneComDDI(c.telefone),
        unidade: SLUG_PARA_NOME.get(c.unidadeSlug) ?? c.unidadeSlug,
        tipo: tipoTarefaCentral(cluster),
        prioridade: prioridadeLabelCentral(cluster),
        status: 'pendente',
        criadaEm: hoje.toISOString(),
        motivo: cluster,
        mensagemSugerida: gerarMensagemCentral(
          cluster,
          c.nomeCliente,
          { sessoes: c.sessoesRestantes, validade: c.dataVencimentoPacote },
          templates,
        ),
      },
    })
  }

  // Fonte 2 — TotalPass (2 sessões/mês). id prefixado com "tp-" (ids Int colidem com ClienteScore).
  for (const t of totalpass) {
    if (!t.telefone || !t.telefone.trim()) continue
    const telDig = String(t.telefone).replace(/\D/g, '')
    if (telsComAgenda.has(telDig)) continue // já tem agendamento futuro → não incomodar
    if (estaBloqueado(t.unidadeSlug, telDig)) continue // cancelado / opt-out
    const cluster = resolverClusterTotalPassCentral(t.sessoesMes)
    if (!cluster) continue
    itens.push({
      chave: t.unidadeSlug + '|' + telDig,
      prio: PRIO_CENTRAL[cluster],
      ds: 0,
      cluster,
      telefone: telDig,
      ultimoContato: t.ultimoContato,
      tarefa: {
        id: 'tp-' + t.id,
        titulo: TITULO_CENTRAL[cluster],
        cliente: t.nomeCliente,
        telefone: telefoneComDDI(t.telefone),
        unidade: SLUG_PARA_NOME.get(t.unidadeSlug) ?? t.unidadeSlug,
        tipo: tipoTarefaCentral(cluster),
        prioridade: prioridadeLabelCentral(cluster),
        status: 'pendente',
        criadaEm: hoje.toISOString(),
        motivo: cluster,
        mensagemSugerida: gerarMensagemCentral(cluster, t.nomeCliente, {}, templates),
      },
    })
  }

  // 1) Dedup por telefone DENTRO da unidade → cada cliente fica no cluster de MAIOR
  //    prioridade (casais/famílias no mesmo nº → só a tarefa mais urgente). Isso já
  //    coloca o cliente no seu ÚNICO cluster, antes de qualquer filtro de dia.
  itens.sort((a, b) => a.prio - b.prio || b.ds - a.ds)
  const vistos = new Set<string>()
  const unicos = itens.filter((it) => {
    if (vistos.has(it.chave)) return false
    vistos.add(it.chave)
    return true
  })

  // 2) Só então aplica o CALENDÁRIO do cluster (envia hoje?) + a recência por cluster.
  //    Assim um cliente TotalPass não vira "vigente" numa segunda: ou é dia dele, ou não sai.
  const doDia = unicos.filter(
    (it) => clusterEnviaHoje(it.cluster, it.telefone, ctxDia) && passouRecencia(it.ultimoContato, it.cluster),
  )

  // Garante que TODAS as tarefas TotalPass entrem (são poucas e a equipe precisa atuar
  // nelas); o teto corta só a fila de reativação, que pode ser grande.
  const CAP = 1000
  const tp = doDia.filter((it) => it.tarefa.tipo === 'totalpass')
  const resto = doDia.filter((it) => it.tarefa.tipo !== 'totalpass').slice(0, Math.max(0, CAP - tp.length))
  const tarefas = [...tp, ...resto]
    .sort((a, b) => a.prio - b.prio || b.ds - a.ds)
    .map((it) => it.tarefa)

  return NextResponse.json({ tarefas })
}
