// Módulo client-safe: sem imports de servidor (Prisma, fs, etc.)

export type StatusFrequencia = 'NOVO' | 'ATIVO' | 'EM_RISCO' | 'PERDIDO'
export type StatusPacote =
  | 'ATIVO'
  | 'A_VENCER'
  | 'FINALIZADO_30'    // finalizado (0 sessões), última sessão há até 30 dias
  | 'FINALIZADO_90'    // última sessão entre 31 e 90 dias
  | 'FINALIZADO_180'   // última sessão entre 91 e 180 dias
  | 'FINALIZADO_PLUS'  // última sessão há mais de 180 dias
  | 'VENCIDO_ATE30'    // vencido há até 30 dias — ainda pode usar sem custo
  | 'VENCIDO_MAIS30'   // vencido há mais de 30 dias — reativar com 20%

// ─── Clusters de mensagem ───────────────────────────────────────────────────────
// Cada cluster tem um texto editável (guardado no banco) e um texto padrão (fallback).

export type ClusterMensagem =
  | 'PACOTE_ATIVO'
  | 'PACOTE_A_VENCER'
  | 'PACOTE_FINALIZADO_30'
  | 'PACOTE_FINALIZADO_90'
  | 'PACOTE_FINALIZADO_180'
  | 'PACOTE_FINALIZADO_PLUS'
  | 'PACOTE_VENCIDO_ATE30'
  | 'PACOTE_VENCIDO_MAIS30'
  | 'FREQUENTE_SEM_PACOTE'
  | 'PERDIDO'
  | 'EM_RISCO'
  | 'NOVO'
  | 'PADRAO'
  | 'TOTALPASS_2'   // TotalPass: nenhuma sessão agendada no mês → convidar p/ as 2
  | 'TOTALPASS_1'   // TotalPass: 1 agendada → convidar p/ a 2ª

export interface ClusterInfo {
  cluster: ClusterMensagem
  label: string
  descricao: string
  variaveis: string[]   // placeholders disponíveis, ex.: '{nome}', '{dias}'
  padrao: string        // texto padrão (fallback quando não há edição salva)
}

const V_NOME = '{nome}'
const V_DIAS = '{dias}'
const V_SESSOES = '{sessoes}'
const V_VALIDADE = '{validade}'

// Ordem = como aparecem no editor
export const CLUSTERS_MENSAGEM: ClusterInfo[] = [
  {
    cluster: 'PACOTE_ATIVO',
    label: 'Pacote ativo (sem agendamento)',
    descricao: 'Tem pacote ativo com sessões, mas ainda não marcou o próximo horário — convide para agendar.',
    variaveis: [V_NOME, V_SESSOES, V_VALIDADE],
    padrao: `Olá ${V_NOME}! 🌿 No seu pacote do Buddha Spa ainda há ${V_SESSOES} sessão(ões) para agendar, com validade até ${V_VALIDADE}. Que tal já reservar seu próximo momento de cuidado? É só me chamar. ✨`,
  },
  {
    cluster: 'PACOTE_A_VENCER',
    label: 'Pacote a vencer',
    descricao: 'Pacote vence nos próximos 30 dias e ainda tem sessões.',
    variaveis: [V_NOME, V_DIAS],
    padrao: `Olá ${V_NOME}! Seu pacote vence em ${V_DIAS} dias e ainda temos sessões para você! 🌿 Vamos agendar antes que expire? E se quiser renovar já, temos condições especiais esperando por você no Buddha Spa. ✨`,
  },
  {
    cluster: 'PACOTE_FINALIZADO_30',
    label: 'Finalizado — última sessão ≤30 dias',
    descricao: 'Usou todas as sessões; última visita há até 30 dias. Momento quente para renovar.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🎉 Você usou todas as sessões do seu pacote — incrível! Que tal renovarmos e garantir mais momentos de cuidado? Aqui no Buddha Spa, temos condições especiais para clientes fiéis como você. 🌿`,
  },
  {
    cluster: 'PACOTE_FINALIZADO_90',
    label: 'Finalizado — última sessão ≤90 dias',
    descricao: 'Usou todas as sessões; última visita entre 31 e 90 dias.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🎉 Você usou todas as sessões do seu pacote — incrível! Que tal renovarmos e garantir mais momentos de cuidado? Aqui no Buddha Spa, temos condições especiais para clientes fiéis como você. 🌿`,
  },
  {
    cluster: 'PACOTE_FINALIZADO_180',
    label: 'Finalizado — última sessão ≤180 dias',
    descricao: 'Usou todas as sessões; última visita entre 91 e 180 dias.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 💫 Sentimos sua falta! Você aproveitou todas as sessões do seu pacote — que tal voltar a se cuidar? Temos condições especiais esperando por você no Buddha Spa. 🌿`,
  },
  {
    cluster: 'PACOTE_FINALIZADO_PLUS',
    label: 'Finalizado — última sessão +180 dias',
    descricao: 'Usou todas as sessões; última visita há mais de 180 dias.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 💫 Faz um tempo que não te vemos por aqui! Você já foi cliente de pacote do Buddha Spa e adoraríamos te receber de novo. Que tal retomar seus momentos de cuidado? 🌿`,
  },
  {
    cluster: 'PACOTE_VENCIDO_ATE30',
    label: 'Vencido ≤30 dias (uso grátis)',
    descricao: 'Pacote venceu há até 30 dias — ainda pode usar as sessões SEM custo adicional.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌸 Seu pacote venceu, mas você ainda pode usar suas sessões restantes SEM custo adicional por até 30 dias da data de vencimento. Vamos agendar antes que esse prazo passe? 🌿`,
  },
  {
    cluster: 'PACOTE_VENCIDO_MAIS30',
    label: 'Vencido +30 dias (reativar 20%)',
    descricao: 'Venceu há mais de 30 dias — pode reativar as sessões vencidas com 20% do valor.',
    variaveis: [V_NOME, V_SESSOES],
    padrao: `Olá ${V_NOME}! 🌸 Vi aqui que seu pacote do Buddha Spa venceu com ${V_SESSOES} sessão(ões) ainda não utilizada(s). Você pode reativá-las com uma taxa de apenas 20% sobre o valor original. Quer retomar seus momentos de cuidado? Me chama que eu te explico tudo. 🌿`,
  },
  {
    cluster: 'FREQUENTE_SEM_PACOTE',
    label: 'Frequente sem pacote',
    descricao: '3+ sessões avulsas — candidata a pacote.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌸 Você já é uma cliente especial do Buddha Spa — e como você vem com frequência, queria te apresentar nossos pacotes. Além de economizar, garante sempre seu horário. Posso te contar mais? 🌿`,
  },
  {
    cluster: 'PERDIDO',
    label: 'Cliente perdido',
    descricao: 'Não volta há 90–180 dias.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 💫 Sentimos muito a sua falta aqui no Buddha Spa. Sabemos como a rotina fica corrida, mas você merece esse momento de pausa e autocuidado. Quando quiser voltar, estamos aqui com tudo pronto para te receber. Vamos agendar? 🌿`,
  },
  {
    cluster: 'EM_RISCO',
    label: 'Cliente em risco',
    descricao: 'Não volta entre 60 e 89 dias.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌸 Faz um tempinho que não te vemos por aqui... Quando vem nos visitar? Temos novidades incríveis esperando por você. Que tal agendarmos um momento só seu? 🌿`,
  },
  {
    cluster: 'NOVO',
    label: 'Cliente novo',
    descricao: 'Cadastrado nos últimos 30 dias.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌸 Seja muito bem-vinda ao Buddha Spa! Como foi sua experiência conosco? Adoraríamos saber. E se tiver qualquer dúvida sobre nossos serviços, é só chamar. Estamos aqui para cuidar de você. 🌿`,
  },
  {
    cluster: 'PADRAO',
    label: 'Mensagem padrão',
    descricao: 'Usada quando nenhum outro cluster se aplica.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌿 Obrigada por fazer parte do Buddha Spa. Estamos sempre aqui para cuidar de você com muito carinho. 💫`,
  },
  {
    cluster: 'TOTALPASS_2',
    label: 'TotalPass — 2 sessões do mês',
    descricao: 'Cliente TotalPass que ainda não agendou nenhuma sessão no mês (tem direito a 2).',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌿 Você tem 2 sessões de 60 min disponíveis este mês pelo seu TotalPass no Buddha Spa. Que tal já agendar seus momentos de cuidado? É só me chamar que reservo seus horários. ✨`,
  },
  {
    cluster: 'TOTALPASS_1',
    label: 'TotalPass — última sessão do mês',
    descricao: 'Cliente TotalPass que já agendou 1 sessão no mês — falta a 2ª.',
    variaveis: [V_NOME],
    padrao: `Olá ${V_NOME}! 🌿 Você ainda tem 1 sessão TotalPass para aproveitar este mês no Buddha Spa! Vamos agendar antes que o mês acabe? É só me chamar. ✨`,
  },
]

const PADRAO_POR_CLUSTER: Record<ClusterMensagem, string> = Object.fromEntries(
  CLUSTERS_MENSAGEM.map((c) => [c.cluster, c.padrao]),
) as Record<ClusterMensagem, string>

export const CLUSTERS_VALIDOS = new Set<string>(CLUSTERS_MENSAGEM.map((c) => c.cluster))

// ─── Resolução de cluster ───────────────────────────────────────────────────────
// Mesma ordem de prioridade da lógica original.

export function resolverCluster(
  statusFrequencia: StatusFrequencia,
  statusPacote: StatusPacote | null,
  isFrequenteSemPacote: boolean,
): ClusterMensagem {
  if (statusPacote === 'FINALIZADO_30')   return 'PACOTE_FINALIZADO_30'
  if (statusPacote === 'FINALIZADO_90')   return 'PACOTE_FINALIZADO_90'
  if (statusPacote === 'FINALIZADO_180')  return 'PACOTE_FINALIZADO_180'
  if (statusPacote === 'FINALIZADO_PLUS') return 'PACOTE_FINALIZADO_PLUS'
  if (statusPacote === 'VENCIDO_ATE30')   return 'PACOTE_VENCIDO_ATE30'
  if (statusPacote === 'VENCIDO_MAIS30')  return 'PACOTE_VENCIDO_MAIS30'
  if (statusPacote === 'A_VENCER')     return 'PACOTE_A_VENCER'
  if (statusPacote === 'ATIVO')        return 'PACOTE_ATIVO'  // convite para agendar
  if (isFrequenteSemPacote)            return 'FREQUENTE_SEM_PACOTE'
  if (statusFrequencia === 'PERDIDO')  return 'PERDIDO'
  if (statusFrequencia === 'EM_RISCO') return 'EM_RISCO'
  if (statusFrequencia === 'NOVO')     return 'NOVO'
  return 'PADRAO'
}

// ─── Trava anti-mensagem-errada ─────────────────────────────────────────────────
// Retorna o MOTIVO de bloqueio (string) se o cliente NÃO deve ser contatado, senão null.
// Regra dura ÚNICA: quem já tem AGENDAMENTO FUTURO não é contatado (ele já vem).
//   - Pacote ATIVO SEM agendamento → deve ser contatado (convite para agendar a sessão).
//   - A_VENCER / FINALIZADO_* / VENCIDO_* → lembrete/renovação normalmente.
export function motivoSupressao(
  _statusPacote: StatusPacote | null,
  flags: { temAgendamentoFuturo?: boolean },
): string | null {
  if (flags.temAgendamentoFuturo) return 'Já tem agendamento marcado'
  return null
}

// ─── Substituição de variáveis ──────────────────────────────────────────────────

function formatarValidade(v: Date | string | null | undefined): string {
  if (!v) return 'em breve'
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return 'em breve'
  // A validade é uma DATA de calendário (sem hora), guardada à meia-noite UTC
  // (ex.: "2026-11-19T00:00:00Z"). Formatar em fuso local (São Paulo, −3) puxava
  // para o dia anterior (18/11). Formata em UTC para preservar o dia correto.
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

export function renderMensagem(
  texto: string,
  vars: { nome: string; dias?: number | null; sessoes?: number | null; validade?: Date | string | null },
): string {
  const primeiroNome = vars.nome.split(' ')[0]
  const dias = vars.dias != null ? String(vars.dias) : 'alguns'
  const sessoes = vars.sessoes != null ? String(vars.sessoes) : ''
  return texto
    .replaceAll('{nome}', primeiroNome)
    .replaceAll('{dias}', dias)
    .replaceAll('{sessoes}', sessoes)
    .replaceAll('{validade}', formatarValidade(vars.validade))
}

// ─── Geração da mensagem final ──────────────────────────────────────────────────
// `templates` é o mapa de textos editados (cluster → texto). Quando ausente,
// usa os textos padrão — mantém compatibilidade com quem chama sem esse argumento.

export function gerarMensagemWhatsApp(
  statusFrequencia: StatusFrequencia,
  statusPacote: StatusPacote | null,
  isFrequenteSemPacote: boolean,
  nomeCliente: string,
  diasParaVencer?: number | null,
  templates?: Partial<Record<ClusterMensagem, string>>,
  extras?: { sessoes?: number | null; validade?: Date | string | null },
): string {
  const cluster = resolverCluster(statusFrequencia, statusPacote, isFrequenteSemPacote)
  const texto = templates?.[cluster] || PADRAO_POR_CLUSTER[cluster]
  return renderMensagem(texto, {
    nome: nomeCliente, dias: diasParaVencer, sessoes: extras?.sessoes, validade: extras?.validade,
  })
}

// ─── TotalPass ──────────────────────────────────────────────────────────────────

// Cluster do convite conforme sessões já agendadas no mês (2 sessões/mês).
export function resolverClusterTotalPass(sessoesMes: number): ClusterMensagem | null {
  if (sessoesMes <= 0) return 'TOTALPASS_2'
  if (sessoesMes === 1) return 'TOTALPASS_1'
  return null // 2+ → completo, não envia
}

export function gerarMensagemTotalPass(
  sessoesMes: number,
  nomeCliente: string,
  templates?: Partial<Record<ClusterMensagem, string>>,
): string {
  const cluster = resolverClusterTotalPass(sessoesMes)
  if (!cluster) return ''
  const texto = templates?.[cluster] || PADRAO_POR_CLUSTER[cluster]
  return renderMensagem(texto, { nome: nomeCliente })
}
