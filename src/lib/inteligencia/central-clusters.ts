// Módulo client-safe (sem Prisma/fs): define os 6 clusters de "tarefas do dia"
// consumidos pela Central de Atendimento e o CALENDÁRIO de envio de cada um.
//
// Isolado de mensagens.ts/motor.ts de propósito: aquelas peças alimentam outras
// telas do ERP (scores, plano-dia, erp/tarefas) com a taxonomia interna (13 clusters).
// Aqui vive só a taxonomia da Central — 6 clusters, 1 cliente em cada, com regras
// de dia de envio embutidas.
//
// Regras gerais (valem para TODOS):
//   • NÃO contatar quem tem agendamento futuro (já vem).
//   • NÃO contatar quem tem plano SUSPENSO no Belle.
//   • Cada cliente entra em UM cluster só, pelo plano mais atual, por PRIORIDADE:
//       1) TotalPass → 2) Pacote vigente → 3) Pacote vencido <1 ano
//       → 4) Frequente sem plano → 5) Sentimos sua falta

export type ClusterCentral =
  | 'TOTALPASS_1_SESSAO'      // TotalPass: 1 sessão a agendar (já agendou 1)
  | 'TOTALPASS_2_SESSOES'     // TotalPass: 2 sessões a agendar (não agendou nenhuma)
  | 'PACOTE_VIGENTE'          // pacote ativo/vigente
  | 'PACOTE_VENCIDO_RENOVAR'  // validade venceu há 15..364 dias, com sessões não usadas
  | 'FREQUENTE_SEM_PLANO'     // 3+ sessões e visita recente, sem plano ativo
  | 'SENTIMOS_FALTA'          // sem plano ativo e sem visita há +1 ano

const DIA_MS = 86_400_000

// Normaliza telefone para COMPARAÇÃO/bloqueio: só dígitos, sem o DDI 55 quando presente.
// Assim "5581994319257" (com DDI) e "81994319257" (cru do Belle) batem. Um mobile de
// DDD 55 (RS) tem 11 dígitos → não é tocado (só corta 55 em números de 12/13 dígitos).
export function telefoneCanonico(t: unknown): string {
  const d = String(t ?? '').replace(/\D/g, '')
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d
}

// ─── Prioridade (menor = vence o desempate e o dedup por telefone) ──────────────
export const PRIO_CENTRAL: Record<ClusterCentral, number> = {
  TOTALPASS_1_SESSAO: 1,
  TOTALPASS_2_SESSOES: 2,
  PACOTE_VIGENTE: 3,
  PACOTE_VENCIDO_RENOVAR: 4,
  FREQUENTE_SEM_PLANO: 5,
  SENTIMOS_FALTA: 6,
}

export const TITULO_CENTRAL: Record<ClusterCentral, string> = {
  TOTALPASS_1_SESSAO: 'TotalPass: convidar para a última sessão do mês',
  TOTALPASS_2_SESSOES: 'TotalPass: convidar para agendar as 2 sessões do mês',
  PACOTE_VIGENTE: 'Convidar para agendar as sessões do pacote vigente',
  PACOTE_VENCIDO_RENOVAR: 'Oferecer renovação das sessões não usadas (20%)',
  FREQUENTE_SEM_PLANO: 'Oferecer plano a cliente frequente',
  SENTIMOS_FALTA: 'Reativar cliente — sentimos sua falta',
}

export function tipoTarefaCentral(cluster: ClusterCentral): 'totalpass' | 'follow-up' | 'reativacao' {
  if (cluster === 'TOTALPASS_1_SESSAO' || cluster === 'TOTALPASS_2_SESSOES') return 'totalpass'
  if (cluster === 'PACOTE_VIGENTE' || cluster === 'FREQUENTE_SEM_PLANO') return 'follow-up'
  return 'reativacao'
}

export function prioridadeLabelCentral(cluster: ClusterCentral): 'alta' | 'normal' | 'baixa' {
  const p = PRIO_CENTRAL[cluster]
  return p <= 3 ? 'alta' : p <= 5 ? 'normal' : 'baixa'
}

// Janela (dias) para NÃO recontatar o mesmo cliente no mesmo cluster.
export function janelaRecencia(cluster: ClusterCentral): number {
  if (cluster === 'PACOTE_VIGENTE') return 7                                   // lembrete semanal (segundas)
  if (cluster === 'TOTALPASS_1_SESSAO' || cluster === 'TOTALPASS_2_SESSOES') return 14
  return 20                                                                     // reativação/renovação
}

// ─── Resolução de cluster a partir dos campos do ClienteScore ───────────────────
// Retorna o cluster de MAIOR prioridade que o cliente satisfaz, ou null (não contatar).
// `nowMs` = referência de "agora" (facilita teste). TotalPass é resolvido à parte.

export interface CamposScore {
  temPacoteAtivo: boolean
  temPacoteSuspenso: boolean
  temAgendamentoFuturo: boolean
  dataVencimentoPacote: Date | null
  sessoesRestantes: number
  ultimaSessao: Date | null
  totalSessoes: number
}

export function resolverClusterCentral(c: CamposScore, nowMs: number): ClusterCentral | null {
  // Regras duras: quem já vem ou está suspenso nunca é contatado.
  if (c.temAgendamentoFuturo) return null
  if (c.temPacoteSuspenso) return null

  // 2) Pacote vigente — plano ativo de fato (sessão sobrando + validade futura).
  if (c.temPacoteAtivo) return 'PACOTE_VIGENTE'

  const diasVenc = c.dataVencimentoPacote
    ? Math.floor((nowMs - new Date(c.dataVencimentoPacote).getTime()) / DIA_MS)
    : null
  const diasSessao = c.ultimaSessao
    ? Math.floor((nowMs - new Date(c.ultimaSessao).getTime()) / DIA_MS)
    : null

  // 3) Pacote vencido há <1 ano, com sessões não usadas → renovar com 20%.
  //    Só depois de 30 dias da validade: até lá o cliente ainda usa as sessões
  //    sem custo (janela grátis), então a oferta de renovação entra após esse prazo.
  if (diasVenc !== null && c.sessoesRestantes > 0 && diasVenc > 30 && diasVenc < 365) {
    return 'PACOTE_VENCIDO_RENOVAR'
  }

  // 4) Frequente sem plano — 3+ sessões no total E visita recente (≤90d), sem plano ativo.
  //    (Aproximação do "3+ no trimestre": a base só guarda o total histórico.)
  if (c.totalSessoes >= 3 && diasSessao !== null && diasSessao <= 90) {
    return 'FREQUENTE_SEM_PLANO'
  }

  // 5) Sentimos sua falta — sem plano ativo e com última visita conhecida há +1 ano.
  //    Sem data de visita não assumimos "sumido há +1 ano" (não dispara à toa).
  if (diasSessao !== null && diasSessao > 365) {
    return 'SENTIMOS_FALTA'
  }

  return null
}

export function resolverClusterTotalPassCentral(sessoesMes: number): ClusterCentral | null {
  if (sessoesMes <= 0) return 'TOTALPASS_2_SESSOES' // 2 a agendar
  if (sessoesMes === 1) return 'TOTALPASS_1_SESSAO' // 1 a agendar
  return null                                        // 2+ agendadas → completo
}

// ─── Contexto do dia (fuso America/Sao_Paulo) ───────────────────────────────────
export interface ContextoDia {
  weekday: number          // 0=Dom … 6=Sáb
  dom: number              // dia do mês
  primeiraTercaDom: number // dia do mês em que cai a 1ª terça-feira
}

export function contextoDiaBrasil(now: Date): ContextoDia {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: 'numeric',
  }).formatToParts(now)
  const wdStr = partes.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  const domStr = partes.find((p) => p.type === 'day')?.value ?? '1'
  const MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = MAP[wdStr] ?? 0
  const dom = parseInt(domStr, 10) || 1
  // weekday do dia 1 do mês → dia da 1ª terça (Tue=2)
  const wdDia1 = (((weekday - (dom - 1)) % 7) + 7) % 7
  const primeiraTercaDom = ((2 - wdDia1 + 7) % 7) + 1
  return { weekday, dom, primeiraTercaDom }
}

// Hash estável do telefone — base da distribuição (dia de início do cliente).
function hashTelefone(telefone: string): number {
  const d = telefone.replace(/\D/g, '')
  let h = 0
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0
  return h
}
// Distribui a lista pela janela [inicio..fim] (dias da semana), estável por telefone e
// com CARRY-OVER: o balde do cliente define o dia de INÍCIO; a partir dele segue disponível
// até o fim da janela, se ainda não foi concluído. Ex.: janela seg→sex tem 5 baldes.
function ehDiaDistribuicao(telefone: string, ctx: ContextoDia, inicio: number, fim: number): boolean {
  if (ctx.weekday < inicio || ctx.weekday > fim) return false
  const nDias = fim - inicio + 1
  const bucket = hashTelefone(telefone) % nDias
  return ctx.weekday >= inicio + bucket
}

// O cluster do cliente deve aparecer HOJE?
// Semântica de CARRY-OVER: o calendário define o dia de INÍCIO de cada ciclo; a partir
// daí a tarefa continua disponível nos dias seguintes ATÉ ser concluída (a conclusão
// grava ultimoContato e a recência a tira da fila). Assim nada "some" por não ter sido
// feito no dia exato.
export function clusterEnviaHoje(cluster: ClusterCentral, telefone: string, ctx: ContextoDia): boolean {
  switch (cluster) {
    case 'TOTALPASS_1_SESSAO':
    case 'TOTALPASS_2_SESSOES':
      // Campanha do mês: da 1ª terça em diante, o mês todo, até ser concluída.
      return ctx.dom >= ctx.primeiraTercaDom
    case 'PACOTE_VIGENTE':
      // Semanal: da segunda em diante (seg→sáb; domingo de folga), até ser concluída.
      return ctx.weekday >= 1
    case 'PACOTE_VENCIDO_RENOVAR':
      return true // elegibilidade é por data (+30 dias após validade), qualquer dia
    case 'FREQUENTE_SEM_PLANO':
      return ehDiaDistribuicao(telefone, ctx, 1, 5) // segunda→sexta, com carry-over até sexta
    case 'SENTIMOS_FALTA':
      return ehDiaDistribuicao(telefone, ctx, 3, 5) // quarta→sexta, com carry-over até sexta
  }
}

// ─── Mensagens padrão (variáveis: {nome} {sessoes} {validade}) ───────────────────
export const MENSAGENS_CENTRAL: Record<ClusterCentral, string> = {
  TOTALPASS_1_SESSAO:
    'Olá {nome}! 🌿 Você ainda tem 1 sessão de 60 min para aproveitar este mês pelo seu TotalPass no Buddha Spa. Vamos agendar seu momento de cuidado antes que o mês acabe? É só me chamar que reservo seu horário. ✨',
  TOTALPASS_2_SESSOES:
    'Olá {nome}! 🌿 Você tem 2 sessões de 60 min disponíveis este mês pelo seu TotalPass no Buddha Spa. Que tal já garantir seus dois momentos de cuidado? É só me chamar que reservo seus horários. ✨',
  PACOTE_VIGENTE:
    'Olá {nome}! 🌿 No seu pacote do Buddha Spa ainda há {sessoes} sessão(ões) para agendar, com validade até {validade}. Que tal já reservar seu próximo momento de cuidado? É só me chamar. ✨',
  PACOTE_VENCIDO_RENOVAR:
    'Olá {nome}! 🌸 Vi aqui que seu pacote do Buddha Spa venceu com {sessoes} sessão(ões) ainda não utilizada(s). Você pode reativá-las com uma taxa de apenas 20% sobre o valor original. Quer retomar seus momentos de cuidado? Me chama que eu te explico tudo. 🌿',
  FREQUENTE_SEM_PLANO:
    'Olá {nome}! 🌸 Que alegria ter você sempre por aqui no Buddha Spa! Como você vem com frequência, queria te apresentar nossos pacotes — uma forma de cuidar de você com mais vantagens e garantir sempre o seu horário. Posso te contar os benefícios? 🌿',
  SENTIMOS_FALTA:
    'Olá {nome}! 💫 Sentimos muito a sua falta aqui no Buddha Spa. Sabemos como a rotina fica corrida, mas você merece esse momento de pausa e autocuidado. Quando quiser voltar, estamos aqui com tudo pronto para te receber. Vamos agendar? 🌿',
}

function formatarValidade(d: Date | null): string {
  if (!d) return 'em breve'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d))
}

// Gera a mensagem final. `templates` é o override editável (cluster → texto); quando
// ausente, usa o padrão. Substitui {nome} (1º nome), {sessoes} e {validade}.
export function gerarMensagemCentral(
  cluster: ClusterCentral,
  nomeCliente: string,
  extras: { sessoes?: number; validade?: Date | null },
  templates?: Partial<Record<ClusterCentral, string>>,
): string {
  const texto = templates?.[cluster] || MENSAGENS_CENTRAL[cluster]
  const primeiroNome = (nomeCliente || '').trim().split(/\s+/)[0] || 'tudo bem'
  return texto
    .replaceAll('{nome}', primeiroNome)
    .replaceAll('{sessoes}', String(extras.sessoes ?? 0))
    .replaceAll('{validade}', formatarValidade(extras.validade ?? null))
}
