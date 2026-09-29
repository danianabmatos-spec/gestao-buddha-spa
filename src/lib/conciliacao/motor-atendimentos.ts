import { prisma } from '@/lib/prisma'
import { getRosterColaboradores, normalizarNome, type RosterItem } from '@/lib/conciliacao/roster-colaboradores'

// ─── Parte 2 · F2 · Motor de Conciliação de Atendimentos ────────────────────────
// Roda por unidade/dia DEPOIS da ingestão (que já classificou preliminarmente cada
// atendimento com Report 7 + Report 2421). Aqui fazemos o que exige cruzamento:
//   1. A_VERIFICAR_FINANCEIRO → casa com MovimentacaoBelle (Parte 1) por clienteId+dia
//      → FINANCEIRO (pago) ou SEM_JUSTIFICATIVA (🔴 serviço entregue sem lastro).
//   2. Gera/atualiza Divergencia (idempotente, preserva o loop de tratamento) para os
//      atendimentos que exigem ação: SEM_JUSTIFICATIVA, CORTESIA e DESCONTO
//      discricionários. Atendimento justificado que tinha divergência → concilia.
//
// A regra de CORTESIA DE COLABORADOR (roster do RH) refina o passo 2 (uma cortesia de
// colaborador CLT/coordenadora dentro do limite vira justificada e NÃO gera divergência)
// — plugável via `rosterColaboradores` (F2d).

const TIPOS_PROBLEMA = {
  SEM_JUSTIFICATIVA: 'ATENDIMENTO_SEM_JUSTIFICATIVA',
  CORTESIA: 'CORTESIA',
  DESCONTO: 'DESCONTO',
} as const

export interface ResultadoConciliacaoAtend {
  unidadeId: number
  data: string
  total: number
  financeiro: number
  semJustificativa: number
  cortesias: number
  descontos: number
  divergenciasAbertas: number
}

/**
 * Concilia os atendimentos de uma unidade/dia. Idempotente e re-executável (loop):
 * corrigiu o Belle + reprocessou → o que estava aberto fecha sozinho.
 */
export async function conciliarAtendimentosDia(
  unidadeId: number, data: string,
): Promise<ResultadoConciliacaoAtend> {
  const atendimentos = await prisma.atendimentoConc.findMany({ where: { unidadeId, data } })

  // Pagamentos reais do dia (Parte 1): entradas por cliente. Um cliente que pagou algo
  // no dia dá lastro financeiro ao seu atendimento avulso. Inclui voucher (forma='Voucher',
  // tipoMovimento null). ⚠️ NÃO filtrar tipoMovimento no SQL: `!= 'S'` exclui os NULL
  // (NULL != 'S' é desconhecido em SQL) e mataria os vouchers — filtra saídas no código.
  const movs = await prisma.movimentacaoBelle.findMany({
    where: { unidadeId, data },
    select: { clienteId: true, valorLiquido: true, formaPagamento: true, tipoMovimento: true },
  })
  // Cobertura por cliente/dia. Dinheiro/cartão/pix têm valor > 0. VOUCHER vem com
  // valor 0 no Belle (o valor de reembolso está no WordPress) → checar PRESENÇA, não valor.
  const cobPorCliente = new Map<string, { financeiro: number; voucher: boolean }>()
  for (const m of movs) {
    if (m.tipoMovimento === 'S') continue           // saída → não é lastro
    if (!m.clienteId) continue
    if (!m.formaPagamento) continue                 // sem forma → não é pagamento
    const c = cobPorCliente.get(m.clienteId) ?? { financeiro: 0, voucher: false }
    if (m.formaPagamento === 'Voucher') c.voucher = true
    else c.financeiro += m.valorLiquido ?? 0
    cobPorCliente.set(m.clienteId, c)
  }

  let financeiro = 0, semJustificativa = 0, cortesias = 0, descontos = 0

  for (const a of atendimentos) {
    // 1) Resolve A_VERIFICAR_FINANCEIRO contra a Parte 1 (dinheiro/cartão/pix) e voucher.
    if (a.classificacao === 'A_VERIFICAR_FINANCEIRO') {
      const cob = a.clienteId ? cobPorCliente.get(a.clienteId) : undefined
      if (cob && cob.financeiro > 0) {
        await prisma.atendimentoConc.update({
          where: { id: a.id },
          data: { classificacao: 'FINANCEIRO', justificado: true, covFinanceiro: cob.financeiro, covAberto: 0 },
        })
        a.classificacao = 'FINANCEIRO'; a.justificado = true
      } else if (cob && cob.voucher) {
        // Coberto por voucher (valor 0 no Belle) — justificado.
        await prisma.atendimentoConc.update({
          where: { id: a.id },
          data: { classificacao: 'VOUCHER', justificado: true, covVoucher: a.valorBruto ?? 0, covAberto: 0 },
        })
        a.classificacao = 'VOUCHER'; a.justificado = true
      } else {
        const aberto = a.valorBruto ?? 0
        await prisma.atendimentoConc.update({
          where: { id: a.id },
          data: { classificacao: 'SEM_JUSTIFICATIVA', justificado: false, covAberto: aberto },
        })
        a.classificacao = 'SEM_JUSTIFICATIVA'; a.justificado = false
      }
    }

    // 2) Divergência (ou conciliação) por atendimento.
    const problema = detectarProblema(a)
    if (problema) {
      if (problema.tipo === TIPOS_PROBLEMA.SEM_JUSTIFICATIVA) semJustificativa++
      else if (problema.tipo === TIPOS_PROBLEMA.CORTESIA) cortesias++
      else if (problema.tipo === TIPOS_PROBLEMA.DESCONTO) descontos++
      await upsertDivergenciaAtend(unidadeId, data, a, problema)
    } else {
      if (a.classificacao === 'FINANCEIRO') financeiro++
      await resolverDivergenciaSeExistir(a)
    }
  }

  await recalcularResumoAtendDia(unidadeId, data)

  const divergenciasAbertas = await prisma.divergencia.count({
    where: { unidadeId, data, tipo: { in: Object.values(TIPOS_PROBLEMA) }, status: { in: ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA'] } },
  })

  return { unidadeId, data, total: atendimentos.length, financeiro, semJustificativa, cortesias, descontos, divergenciasAbertas }
}

const LIMITE_MIN_COLABORADOR = 60 // direito: 1 sessão de até 60 min por mês

// Proprietários (donos) — cortesia sempre válida, SEM limite. Nome como aparece no Belle.
const PROPRIETARIOS = ['Daniana Matos', 'Felipe Soterio']

/** Nome do cliente combina com algum da lista? Tolera diferenças comuns entre o cadastro
 * completo (RH) e o nome curto (Belle): sobrenomes a mais, nome do meio faltando e
 * APELIDO no 1º nome (ex.: Belle "Lilly Campos" × RH "Lillyane Hass Campos"). */
function nomeCombinaRoster(nomeCliente: string, listaNorm: string[]): boolean {
  const a = normalizarNome(nomeCliente).split(' ').filter(Boolean)
  if (a.length < 2) return false
  for (const rn of listaNorm) {
    const b = rn.split(' ').filter(Boolean)
    if (b.length < 2) continue
    // 1) igual OU um é prefixo do outro por tokens (ex.: "Ana Paula De Jesus" ⊂ RH completo)
    const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]
    if (menor.every((t, i) => t === maior[i])) return true
    // 2) primeiro nome compatível (um começa com o outro, apelido) + último sobrenome igual
    const p1 = a[0], p2 = b[0]
    const curto = p1.length <= p2.length ? p1 : p2, longo = p1.length <= p2.length ? p2 : p1
    const primeiroOk = curto.length >= 3 && longo.startsWith(curto)
    const ultimoOk = a[a.length - 1].length >= 3 && a[a.length - 1] === b[b.length - 1]
    if (primeiroOk && ultimoOk) return true
  }
  return false
}

/**
 * F2d · Regra de cortesia de colaborador. Passo MENSAL determinístico. Olha TODOS os
 * atendimentos SINALIZADOS do mês (cortesia, desconto OU sem justificativa — a massagem
 * de cortesia do colaborador pode ser lançada de qualquer um desses jeitos) e, para os
 * que são de colaborador ativo (CLT/coordenadora, roster do RH, match tolerante de nome),
 * marca a 1ª sessão de até 60 min do mês como CORTESIA_COLABORADOR válida (fecha a
 * divergência); as demais (2ª+ ou > 60 min) = abuso (divergência). Não-colaborador fica
 * como está (flag da equipe). Fail-safe: roster vazio (RH fora) → ninguém é colaborador.
 */
export async function aplicarRegraColaborador(
  unidadeId: number, mesPrefix: string, rosterInj?: Map<string, RosterItem>,
): Promise<{ colaborador: number; validas: number; abusos: number }> {
  const roster = rosterInj ?? await getRosterColaboradores()
  const rosterNorm = Array.from(roster.keys())
  const propNorm = PROPRIETARIOS.map(normalizarNome)

  const flagged = await prisma.atendimentoConc.findMany({
    where: { unidadeId, data: { startsWith: mesPrefix }, classificacao: { in: ['CORTESIA', 'DESCONTO', 'SEM_JUSTIFICATIVA', 'CORTESIA_COLABORADOR', 'CORTESIA_PROPRIETARIO'] } },
    orderBy: [{ data: 'asc' }, { horario: 'asc' }, { id: 'asc' }],
  })

  // Agrupa: proprietário (dono) > colaborador (roster RH) > outros. Match tolerante de nome.
  const proprietarios: typeof flagged = []
  const porColaborador = new Map<string, typeof flagged>()
  const naoColaborador: typeof flagged = []
  for (const a of flagged) {
    if (nomeCombinaRoster(a.clienteNome, propNorm)) {
      proprietarios.push(a)
    } else if (rosterNorm.length && nomeCombinaRoster(a.clienteNome, rosterNorm)) {
      const chave = normalizarNome(a.clienteNome)
      const arr = porColaborador.get(chave); if (arr) arr.push(a); else porColaborador.set(chave, [a])
    } else {
      naoColaborador.push(a)
    }
  }

  let validas = 0, abusos = 0

  // Proprietário: cortesia SEMPRE válida, sem limite.
  for (const a of proprietarios) {
    validas++
    await prisma.atendimentoConc.update({ where: { id: a.id }, data: { classificacao: 'CORTESIA_PROPRIETARIO', justificado: true } })
    const atual = await prisma.atendimentoConc.findUnique({ where: { id: a.id } })
    if (atual) await resolverDivergenciaSeExistir(atual)
  }

  // Colaborador: 1ª sessão de até 60min do mês = válida; resto = abuso.
  for (const lista of porColaborador.values()) {
    let usouDireito = false
    for (const a of lista) {
      const dentroLimite = !usouDireito && (a.tempo ?? 0) <= LIMITE_MIN_COLABORADOR
      if (dentroLimite) usouDireito = true
      dentroLimite ? validas++ : abusos++
      await prisma.atendimentoConc.update({
        where: { id: a.id },
        data: { classificacao: 'CORTESIA_COLABORADOR', justificado: dentroLimite },
      })
      const atual = await prisma.atendimentoConc.findUnique({ where: { id: a.id } })
      if (atual) { const p = detectarProblema(atual); p ? await upsertDivergenciaAtend(unidadeId, atual.data, atual, p) : await resolverDivergenciaSeExistir(atual) }
    }
  }

  // Não-colaborador que ficou marcado CORTESIA_COLABORADOR/PROPRIETARIO (stale: saiu do
  // roster / lista) → reverte à classificação base (derivada da cobertura) e reabre a divergência.
  for (const a of naoColaborador) {
    if (a.classificacao === 'CORTESIA_COLABORADOR' || a.classificacao === 'CORTESIA_PROPRIETARIO') {
      const base = (a.covDesconto ?? 0) > 0 ? 'DESCONTO' : (a.covCortesia ?? 0) > 0 ? 'CORTESIA' : 'SEM_JUSTIFICATIVA'
      await prisma.atendimentoConc.update({ where: { id: a.id }, data: { classificacao: base, justificado: false } })
      const atual = await prisma.atendimentoConc.findUnique({ where: { id: a.id } })
      if (atual) { const p = detectarProblema(atual); if (p) await upsertDivergenciaAtend(unidadeId, atual.data, atual, p) }
    }
  }

  return { colaborador: porColaborador.size, validas, abusos }
}

interface Problema { tipo: string; valor: number; descricao: string; sugestao?: string }

const VALOR_DESCONTO_ANIVERSARIO = 50 // R$ fixo do desconto de aniversário

type AtendRow = Awaited<ReturnType<typeof prisma.atendimentoConc.findMany>>[number]

function detectarProblema(a: AtendRow): Problema | null {
  // Começa SEMPRE com cliente + terapia (o que a equipe precisa ver, mesmo cortado).
  const quem = `${a.clienteNome.trim()} · ${a.servico ?? 'serviço'}`
  if (a.classificacao === 'SEM_JUSTIFICATIVA') {
    return { tipo: TIPOS_PROBLEMA.SEM_JUSTIFICATIVA, valor: a.covAberto || a.valorBruto || 0,
      descricao: `${quem} — sem lastro (nem pagamento, plano, voucher ou cortesia)` }
  }
  if (a.classificacao === 'CORTESIA' && !a.justificado) {
    return { tipo: TIPOS_PROBLEMA.CORTESIA, valor: a.covCortesia || a.valorBruto || 0,
      descricao: `${quem} — cortesia sem justificativa da equipe` }
  }
  // Cortesia de colaborador ACIMA do limite (2ª no mês ou > 60 min) → abuso.
  if (a.classificacao === 'CORTESIA_COLABORADOR' && !a.justificado) {
    return { tipo: TIPOS_PROBLEMA.CORTESIA, valor: a.covCortesia || a.valorBruto || 0,
      descricao: `${quem} — cortesia de colaborador acima do direito (1×60min/mês)` }
  }
  if (a.classificacao === 'DESCONTO' && !a.justificado) {
    // Desconto de aniversário: R$50 + cliente faz aniversário no mês → traz a
    // justificativa pronta (mas NÃO some da tela — a equipe confirma com 1 clique).
    if (a.aniversarioMes && Math.abs((a.covDesconto ?? 0) - VALOR_DESCONTO_ANIVERSARIO) < 0.01) {
      return { tipo: TIPOS_PROBLEMA.DESCONTO, valor: a.covDesconto || 0,
        descricao: `${quem} — desconto de aniversário (R$50)`,
        sugestao: 'Desconto de aniversário: o cliente faz aniversário no mês do atendimento — desconto de R$50 válido.' }
    }
    return { tipo: TIPOS_PROBLEMA.DESCONTO, valor: a.covDesconto || 0,
      descricao: `${quem} — desconto discricionário sem justificativa` }
  }
  return null
}

/** Cria ou atualiza a Divergencia do atendimento; preserva status de tratamento humano. */
async function upsertDivergenciaAtend(unidadeId: number, data: string, a: AtendRow, p: Problema): Promise<void> {
  if (a.divergenciaId) {
    const existente = await prisma.divergencia.findUnique({ where: { id: a.divergenciaId } })
    if (existente) {
      // Tratada MANUALMENTE pela equipe (justificada/ignorada) → não reabre.
      if (['JUSTIFICADA', 'IGNORADA'].includes(existente.status)) return
      // Auto-conciliada pelo sistema mas o problema voltou → reabre.
      const status = existente.status === 'CONCILIADA' ? 'ABERTA' : existente.status
      await prisma.divergencia.update({
        where: { id: a.divergenciaId },
        data: { tipo: p.tipo, valorEsperado: p.valor, diferenca: p.valor, descricao: p.descricao, sugestaoAjuste: p.sugestao ?? null, status },
      })
      return
    }
  }
  const nova = await prisma.divergencia.create({
    data: {
      unidadeId, data, tipo: p.tipo, valorEsperado: p.valor, diferenca: p.valor,
      descricao: p.descricao, sugestaoAjuste: p.sugestao ?? null, status: 'ABERTA',
    },
  })
  await prisma.atendimentoConc.update({ where: { id: a.id }, data: { divergenciaId: nova.id } })
}

/** Atendimento virou justificado → concilia a divergência que porventura existia. */
async function resolverDivergenciaSeExistir(a: AtendRow): Promise<void> {
  if (!a.divergenciaId) return
  const d = await prisma.divergencia.findUnique({ where: { id: a.divergenciaId } })
  if (!d) return
  if (['JUSTIFICADA', 'IGNORADA', 'CONCILIADA'].includes(d.status)) return
  await prisma.divergencia.update({
    where: { id: a.divergenciaId },
    data: { status: 'CONCILIADA', reprocessadaEm: new Date() },
  })
}

/** Atualiza o resumo do dia (ConciliacaoDia) com a visão de atendimentos. */
async function recalcularResumoAtendDia(unidadeId: number, data: string): Promise<void> {
  const abertas = await prisma.divergencia.count({
    where: { unidadeId, data, tipo: { in: Object.values(TIPOS_PROBLEMA) }, status: { in: ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA'] } },
  })
  const dia = await prisma.conciliacaoDia.findUnique({ where: { unidadeId_data: { unidadeId, data } } })
  if (!dia) return
  // Não sobrescreve o status do dinheiro/cartão; só garante que abertas de atendimento contem.
  await prisma.conciliacaoDia.update({
    where: { unidadeId_data: { unidadeId, data } },
    data: { ultimoProcessamento: new Date() },
  })
  void abertas
}
