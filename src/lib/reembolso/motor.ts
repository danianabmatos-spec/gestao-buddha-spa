import { prisma } from '@/lib/prisma'

// ─── Motor de Reembolso de Vouchers ─────────────────────────────────────────────
// Porta a lógica da planilha "Reembolso vouchers <mês>" para o ERP.
//
// Por unidade, no mês de referência:
//   Vouchers + 7%(=Vouchers*0.07) + Omnichannel + Cortesias(reembolso)
//   − Compras(efetiva) − Treinamento(efetivo) − Royalties/Mkt  = Valor a reembolsar
//
// Regras:
// • Cortesias passam por um motor de crédito de permuta (crédito mensal com teto
//   acumulável). Só o excedente do que foi usado sobre o crédito vira reembolso.
// • PEX (prêmio com vigência): 20% de desconto nas compras + treinamento gratuito.
// • Royalties/Mkt = 8% do faturamento CAIXA — pago via este reembolso só na
//   Higienópolis (as demais pagam por outra via ⇒ 0).

export const SLUG_HIGIENOPOLIS = 'higienopolis'
export const ACRESCIMO_PCT = 0.07
// Acréscimo de 7% (Tabela 8) só se aplica a estas 4 unidades. As demais (Mooca,
// Tatuapé, Metrópole) não têm esse extra.
export const SLUGS_COM_ACRESCIMO_7 = new Set(['higienopolis', 'analia-franco', 'perdizes', 'shopping-analia-franco'])
export const ROYALTIES_MKT_PCT = 0.08 // 6% royalties + 2% mkt
export const PEX_DESCONTO_COMPRAS = 0.8 // paga 80% das compras (20% de desconto)
export const VALOR_TREINAMENTO = 1000 // R$ por terapeuta treinada (abatimento)

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface PermutaCfg {
  valorMensalPermutavel: number
  limiteAcumulo: number
}

export interface CalcInput {
  vouchers: number
  omnichannel: number
  cortesiaUsada: number
  saldoAnterior: number // saldo de permuta acumulado do mês anterior
  permuta: PermutaCfg
  compras: number
  treinamento: number
  faturamentoCaixa: number
  pex: boolean
  isHigienopolis: boolean
  recebe7pct: boolean
}

export interface CalcResult {
  acrescimo7: number
  creditoInicial: number
  cortesiaReembolso: number
  saldoAcumulado: number
  comprasEfetiva: number
  treinamentoEfetivo: number
  royaltiesMkt: number
  total: number
}

/** Núcleo puro do cálculo — sem banco, 100% testável. */
export function calcularUnidade(i: CalcInput): CalcResult {
  const acrescimo7 = round2(i.recebe7pct ? i.vouchers * ACRESCIMO_PCT : 0)

  // Motor de permuta (espelha as linhas 8/10/11 das abas Cortesias da planilha)
  const creditoInicial = Math.min(i.saldoAnterior + i.permuta.valorMensalPermutavel, i.permuta.limiteAcumulo)
  const cortesiaReembolso = round2(Math.max(i.cortesiaUsada - creditoInicial, 0))
  const saldoAcumulado = round2(Math.min(Math.max(creditoInicial - i.cortesiaUsada, 0), i.permuta.limiteAcumulo))

  const comprasEfetiva = round2(i.pex ? i.compras * PEX_DESCONTO_COMPRAS : i.compras)
  const treinamentoEfetivo = i.pex ? 0 : round2(i.treinamento)
  const royaltiesMkt = round2(i.isHigienopolis ? i.faturamentoCaixa * ROYALTIES_MKT_PCT : 0)

  const total = round2(
    i.vouchers + acrescimo7 + i.omnichannel + cortesiaReembolso
    - comprasEfetiva - treinamentoEfetivo - royaltiesMkt,
  )

  return { acrescimo7, creditoInicial: round2(creditoInicial), cortesiaReembolso, saldoAcumulado, comprasEfetiva, treinamentoEfetivo, royaltiesMkt, total }
}

// ─── Contexto (banco) ───────────────────────────────────────────────────────────

const DEFAULT_PERMUTA: PermutaCfg = { valorMensalPermutavel: 0, limiteAcumulo: 0 }

export async function getPermuta(unidadeId: number): Promise<PermutaCfg> {
  const cfg = await prisma.permutaConfig.findUnique({ where: { unidadeId } })
  return cfg ? { valorMensalPermutavel: cfg.valorMensalPermutavel, limiteAcumulo: cfg.limiteAcumulo } : DEFAULT_PERMUTA
}

/** PEX ativo se existe premiação vigente cobrindo (ano, mes) da unidade. */
export async function pexAtivo(unidadeId: number, ano: number, mes: number): Promise<boolean> {
  const p = await prisma.pexPremiacao.findFirst({
    where: { unidadeId, ano, mesInicio: { lte: mes }, mesFim: { gte: mes } },
  })
  return !!p
}

/**
 * Saldo de permuta acumulado que ENTRA no mês.
 * - Se existe o mês anterior no ERP: usa o saldo acumulado dele (acúmulo automático).
 * - Senão (1º mês registrado): usa o `saldoInicial` configurado (o que já vinha da planilha).
 */
export async function saldoAnterior(unidadeId: number, ano: number, mes: number): Promise<number> {
  const anoAnt = mes === 1 ? ano - 1 : ano
  const mesAnt = mes === 1 ? 12 : mes - 1
  const linha = await prisma.reembolsoUnidade.findFirst({
    where: { unidadeId, mesRef: { ano: anoAnt, mes: mesAnt } },
    select: { saldoAcumulado: true },
  })
  if (linha) return linha.saldoAcumulado
  const cfg = await prisma.permutaConfig.findUnique({ where: { unidadeId }, select: { saldoInicial: true } })
  return cfg?.saldoInicial ?? 0
}

/** Edita a config de permuta de uma unidade (mensal / teto / saldo inicial) e recalcula o mês. */
export async function patchPermuta(
  unidadeId: number,
  patch: { valorMensalPermutavel?: number; limiteAcumulo?: number; saldoInicial?: number },
  ano?: number,
  mes?: number,
): Promise<void> {
  const data: Record<string, number> = {}
  if (patch.valorMensalPermutavel !== undefined) data.valorMensalPermutavel = round2(patch.valorMensalPermutavel)
  if (patch.limiteAcumulo !== undefined) data.limiteAcumulo = round2(patch.limiteAcumulo)
  if (patch.saldoInicial !== undefined) data.saldoInicial = round2(patch.saldoInicial)
  await prisma.permutaConfig.upsert({ where: { unidadeId }, create: { unidadeId, ...data }, update: data })

  // Recalcula a linha do mês (se existir) para refletir o novo crédito/saldo.
  if (ano && mes) {
    const mesRow = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } } })
    if (mesRow) {
      const l = await prisma.reembolsoUnidade.findUnique({ where: { reembolsoMesId_unidadeId: { reembolsoMesId: mesRow.id, unidadeId } }, select: { id: true } })
      if (l) await recalcularUnidade(l.id)
    }
  }
}

/** Garante (idempotente) o ReembolsoMes de (ano, mes). */
export async function ensureMes(ano: number, mes: number) {
  const existente = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } } })
  if (existente) return existente
  return prisma.reembolsoMes.create({ data: { ano, mes } })
}

/** True se o mês está FECHADO (só-leitura). */
export async function mesEstaFechado(ano: number, mes: number): Promise<boolean> {
  const m = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } }, select: { status: true } })
  return m?.status === 'FECHADO'
}

/** Define o status do mês (ABERTO | FECHADO), criando-o se preciso. */
export async function setStatusMes(ano: number, mes: number, status: 'ABERTO' | 'FECHADO'): Promise<void> {
  const m = await ensureMes(ano, mes)
  await prisma.reembolsoMes.update({ where: { id: m.id }, data: { status } })
}

/** Garante a linha da unidade no mês (cria com snapshot de PEX se não existir). */
export async function ensureUnidadeRow(ano: number, mes: number, unidadeId: number): Promise<number> {
  const mesRow = await ensureMes(ano, mes)
  const existente = await prisma.reembolsoUnidade.findUnique({
    where: { reembolsoMesId_unidadeId: { reembolsoMesId: mesRow.id, unidadeId } },
    select: { id: true },
  })
  if (existente) return existente.id
  const pex = await pexAtivo(unidadeId, ano, mes)
  const criada = await prisma.reembolsoUnidade.create({
    data: { reembolsoMesId: mesRow.id, unidadeId, pex },
    select: { id: true },
  })
  return criada.id
}

/** Recalcula os derivados de uma ReembolsoUnidade e persiste. */
export async function recalcularUnidade(reembolsoUnidadeId: number): Promise<void> {
  const linha = await prisma.reembolsoUnidade.findUnique({
    where: { id: reembolsoUnidadeId },
    include: { mesRef: true, unidade: { select: { slug: true } } },
  })
  if (!linha) return

  const permuta = await getPermuta(linha.unidadeId)
  const anterior = await saldoAnterior(linha.unidadeId, linha.mesRef.ano, linha.mesRef.mes)

  const r = calcularUnidade({
    vouchers: linha.vouchers,
    omnichannel: linha.omnichannel,
    cortesiaUsada: linha.cortesiaUsada,
    saldoAnterior: anterior,
    permuta,
    compras: linha.compras,
    treinamento: linha.treinamento,
    faturamentoCaixa: linha.faturamentoCaixa,
    pex: linha.pex,
    isHigienopolis: linha.unidade.slug === SLUG_HIGIENOPOLIS,
    recebe7pct: SLUGS_COM_ACRESCIMO_7.has(linha.unidade.slug),
  })

  await prisma.reembolsoUnidade.update({
    where: { id: reembolsoUnidadeId },
    data: {
      creditoInicial: r.creditoInicial,
      cortesiaReembolso: r.cortesiaReembolso,
      saldoAcumulado: r.saldoAcumulado,
      royaltiesMkt: r.royaltiesMkt,
    },
  })
}

export interface CortesiaItem { codigo: string; nome: string; valor: number; dataUtilizacao?: string | null }
export interface PullPayload {
  ano: number
  mes: number
  unidadeId: number
  vouchers: number
  omnichannel: number
  cortesias: CortesiaItem[]
}

/**
 * Salva o que veio do WordPress (relay) para uma unidade no mês e recalcula.
 * cortesiaUsada = soma dos valores das cortesias. Substitui a lista anterior.
 */
export async function salvarPull(p: PullPayload): Promise<number> {
  const mes = await ensureMes(p.ano, p.mes)
  const cortesiaUsada = round2(p.cortesias.reduce((a, c) => a + (c.valor || 0), 0))
  const pex = await pexAtivo(p.unidadeId, p.ano, p.mes)

  const linha = await prisma.reembolsoUnidade.upsert({
    where: { reembolsoMesId_unidadeId: { reembolsoMesId: mes.id, unidadeId: p.unidadeId } },
    create: {
      reembolsoMesId: mes.id,
      unidadeId: p.unidadeId,
      vouchers: round2(p.vouchers),
      omnichannel: round2(p.omnichannel),
      cortesiaUsada,
      pex,
      fetchedAt: new Date(),
    },
    update: {
      vouchers: round2(p.vouchers),
      omnichannel: round2(p.omnichannel),
      cortesiaUsada,
      pex,
      fetchedAt: new Date(),
    },
  })

  // Substitui a lista de cortesias auditável
  await prisma.reembolsoCortesia.deleteMany({ where: { reembolsoUnidadeId: linha.id } })
  if (p.cortesias.length) {
    await prisma.reembolsoCortesia.createMany({
      data: p.cortesias.map((c) => ({
        reembolsoUnidadeId: linha.id,
        codigo: c.codigo || '',
        nome: c.nome || '',
        valor: c.valor || 0,
        dataUtilizacao: c.dataUtilizacao ?? null,
      })),
    })
  }

  await recalcularUnidade(linha.id)
  return linha.id
}

export type ManualPatch = Partial<Pick<CalcInput, 'compras' | 'treinamento' | 'faturamentoCaixa'>> & { pex?: boolean }

/** Atualiza campos manuais de uma linha existente e recalcula. */
export async function patchManual(reembolsoUnidadeId: number, patch: ManualPatch): Promise<void> {
  const data: Record<string, number | boolean> = {}
  if (patch.compras !== undefined) data.compras = round2(patch.compras)
  if (patch.treinamento !== undefined) data.treinamento = round2(patch.treinamento)
  if (patch.faturamentoCaixa !== undefined) data.faturamentoCaixa = round2(patch.faturamentoCaixa)
  if (patch.pex !== undefined) data.pex = patch.pex
  if (Object.keys(data).length) {
    await prisma.reembolsoUnidade.update({ where: { id: reembolsoUnidadeId }, data })
  }
  await recalcularUnidade(reembolsoUnidadeId)
}

/** Edita campos manuais por (ano, mes, unidade) — cria a linha se ainda não existir. */
export async function patchManualPorUnidade(ano: number, mes: number, unidadeId: number, patch: ManualPatch): Promise<void> {
  const id = await ensureUnidadeRow(ano, mes, unidadeId)
  await patchManual(id, patch)
}

/** Conciliação bancária: valor recebido em conta + flag conferido. NÃO afeta o cálculo
 *  do reembolso e é permitido mesmo com o mês fechado (o dinheiro cai depois). */
export async function patchConciliacao(ano: number, mes: number, unidadeId: number, patch: { valorRecebido?: number; conciliado?: boolean }): Promise<void> {
  const id = await ensureUnidadeRow(ano, mes, unidadeId)
  const data: Record<string, number | boolean> = {}
  if (patch.valorRecebido !== undefined) data.valorRecebido = round2(patch.valorRecebido)
  if (patch.conciliado !== undefined) data.conciliado = patch.conciliado
  if (Object.keys(data).length) await prisma.reembolsoUnidade.update({ where: { id }, data })
}

// ─── Compras (itens que somam no total — memória de cálculo) ─────────────────────

/** Recalcula o total de Compras da unidade = soma dos itens, e recalcula a linha. */
async function recomputeCompras(reembolsoUnidadeId: number): Promise<void> {
  const agg = await prisma.reembolsoCompra.aggregate({ where: { reembolsoUnidadeId }, _sum: { valor: true } })
  await prisma.reembolsoUnidade.update({ where: { id: reembolsoUnidadeId }, data: { compras: round2(agg._sum.valor ?? 0) } })
  await recalcularUnidade(reembolsoUnidadeId)
}

/** Adiciona um item de compra (cria a linha da unidade se preciso). */
export async function addCompra(ano: number, mes: number, unidadeId: number, descricao: string, valor: number): Promise<void> {
  const id = await ensureUnidadeRow(ano, mes, unidadeId)
  await prisma.reembolsoCompra.create({ data: { reembolsoUnidadeId: id, descricao: descricao || 'Compra', valor: round2(valor) } })
  await recomputeCompras(id)
}

/** Remove um item de compra e recalcula o total. */
export async function removeCompra(compraId: number): Promise<void> {
  const item = await prisma.reembolsoCompra.findUnique({ where: { id: compraId }, select: { reembolsoUnidadeId: true } })
  if (!item) return
  await prisma.reembolsoCompra.delete({ where: { id: compraId } })
  await recomputeCompras(item.reembolsoUnidadeId)
}

// ─── Treinamentos (terapeutas — R$1.000 cada; PEX ⇒ efetivo 0) ───────────────────

/** Treinamento bruto da unidade = nº de terapeutas × R$1.000. Recalcula a linha. */
async function recomputeTreinamento(reembolsoUnidadeId: number): Promise<void> {
  const n = await prisma.reembolsoTreinamento.count({ where: { reembolsoUnidadeId } })
  await prisma.reembolsoUnidade.update({ where: { id: reembolsoUnidadeId }, data: { treinamento: n * VALOR_TREINAMENTO } })
  await recalcularUnidade(reembolsoUnidadeId)
}

/** Adiciona uma terapeuta treinada (cria a linha da unidade se preciso). */
export async function addTreinamento(ano: number, mes: number, unidadeId: number, terapeuta: string): Promise<void> {
  const id = await ensureUnidadeRow(ano, mes, unidadeId)
  await prisma.reembolsoTreinamento.create({ data: { reembolsoUnidadeId: id, terapeuta: terapeuta || 'Terapeuta' } })
  await recomputeTreinamento(id)
}

/** Remove uma terapeuta treinada e recalcula. */
export async function removeTreinamento(treinamentoId: number): Promise<void> {
  const item = await prisma.reembolsoTreinamento.findUnique({ where: { id: treinamentoId }, select: { reembolsoUnidadeId: true } })
  if (!item) return
  await prisma.reembolsoTreinamento.delete({ where: { id: treinamentoId } })
  await recomputeTreinamento(item.reembolsoUnidadeId)
}

// ─── Resumo do mês (as 7 unidades + total) ──────────────────────────────────────

export interface ResumoLinha {
  reembolsoUnidadeId: number | null
  unidadeId: number
  nome: string
  slug: string
  vouchers: number
  acrescimo7: number
  omnichannel: number
  cortesiaReembolso: number
  cortesiaUsada: number
  compras: number
  comprasEfetiva: number
  treinamento: number
  treinamentoEfetivo: number
  royaltiesMkt: number
  faturamentoCaixa: number
  pex: boolean
  isHigienopolis: boolean
  total: number
  valorRecebido: number
  conciliado: boolean
  fetchedAt: string | null
  puxado: boolean
  comprasItens: { id: number; descricao: string; valor: number }[]
  treinamentoItens: { id: number; terapeuta: string }[]
}

/** Monta o RESUMO do mês (recalcula on-the-fly para refletir configs atuais). */
export async function getResumo(ano: number, mes: number): Promise<{ ano: number; mes: number; status: string; linhas: ResumoLinha[]; totais: Record<string, number> }> {
  const mesRow = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } } })
  const unidades = await prisma.unidade.findMany({ where: { ativa: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true, slug: true } })
  const linhasRaw = mesRow
    ? await prisma.reembolsoUnidade.findMany({ where: { reembolsoMesId: mesRow.id } })
    : []
  const porUnidade = new Map(linhasRaw.map((l) => [l.unidadeId, l]))

  const linhas: ResumoLinha[] = []
  for (const u of unidades) {
    const l = porUnidade.get(u.id)
    const isHigienopolis = u.slug === SLUG_HIGIENOPOLIS
    if (!l) {
      linhas.push({
        reembolsoUnidadeId: null,
        unidadeId: u.id, nome: u.nome, slug: u.slug,
        vouchers: 0, acrescimo7: 0, omnichannel: 0, cortesiaReembolso: 0, cortesiaUsada: 0,
        compras: 0, comprasEfetiva: 0, treinamento: 0, treinamentoEfetivo: 0,
        royaltiesMkt: 0, faturamentoCaixa: 0, pex: false, isHigienopolis,
        total: 0, valorRecebido: 0, conciliado: false, fetchedAt: null, puxado: false, comprasItens: [], treinamentoItens: [],
      })
      continue
    }
    const permuta = await getPermuta(u.id)
    const anterior = await saldoAnterior(u.id, ano, mes)
    const r = calcularUnidade({
      vouchers: l.vouchers, omnichannel: l.omnichannel, cortesiaUsada: l.cortesiaUsada,
      saldoAnterior: anterior, permuta, compras: l.compras, treinamento: l.treinamento,
      faturamentoCaixa: l.faturamentoCaixa, pex: l.pex, isHigienopolis,
      recebe7pct: SLUGS_COM_ACRESCIMO_7.has(u.slug),
    })
    const compraItens = await prisma.reembolsoCompra.findMany({
      where: { reembolsoUnidadeId: l.id }, orderBy: { id: 'asc' },
      select: { id: true, descricao: true, valor: true },
    })
    const treinoItens = await prisma.reembolsoTreinamento.findMany({
      where: { reembolsoUnidadeId: l.id }, orderBy: { id: 'asc' },
      select: { id: true, terapeuta: true },
    })
    linhas.push({
      reembolsoUnidadeId: l.id,
      unidadeId: u.id, nome: u.nome, slug: u.slug,
      vouchers: l.vouchers, acrescimo7: r.acrescimo7, omnichannel: l.omnichannel,
      cortesiaReembolso: r.cortesiaReembolso, cortesiaUsada: l.cortesiaUsada,
      compras: l.compras, comprasEfetiva: r.comprasEfetiva,
      treinamento: l.treinamento, treinamentoEfetivo: r.treinamentoEfetivo,
      royaltiesMkt: r.royaltiesMkt, faturamentoCaixa: l.faturamentoCaixa,
      pex: l.pex, isHigienopolis, total: r.total,
      valorRecebido: l.valorRecebido, conciliado: l.conciliado,
      fetchedAt: l.fetchedAt ? l.fetchedAt.toISOString() : null, puxado: !!l.fetchedAt,
      comprasItens: compraItens, treinamentoItens: treinoItens,
    })
  }

  const soma = (k: keyof ResumoLinha) => round2(linhas.reduce((a, x) => a + (Number(x[k]) || 0), 0))
  const totais = {
    vouchers: soma('vouchers'), acrescimo7: soma('acrescimo7'), omnichannel: soma('omnichannel'),
    cortesiaReembolso: soma('cortesiaReembolso'), comprasEfetiva: soma('comprasEfetiva'),
    treinamentoEfetivo: soma('treinamentoEfetivo'), royaltiesMkt: soma('royaltiesMkt'), total: soma('total'),
    valorRecebido: soma('valorRecebido'), conciliadas: linhas.filter((l) => l.conciliado).length,
  }

  return { ano, mes, status: mesRow?.status ?? 'ABERTO', linhas, totais }
}

// ─── Controle de Cortesias / Permutas (a "aba Cortesias" da planilha) ────────────

export interface CortesiaItemView { codigo: string; nome: string; valor: number; dataUtilizacao: string | null }
export interface CortesiaUnidadeView {
  unidadeId: number
  nome: string
  slug: string
  valorMensalPermutavel: number
  limiteAcumulo: number
  saldoInicial: number
  saldoAnterior: number
  creditoInicial: number
  cortesiaUsada: number
  cortesiaReembolso: number
  saldoAcumulado: number
  itens: CortesiaItemView[]
}

/** Detalhe do controle de permuta por unidade + a lista de cada cortesia usada. */
export async function getCortesiasControle(ano: number, mes: number): Promise<{ ano: number; mes: number; unidades: CortesiaUnidadeView[]; totais: { usado: number; aReembolsar: number } }> {
  const mesRow = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } } })
  const unidades = await prisma.unidade.findMany({ where: { ativa: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true, slug: true } })
  const linhas = mesRow ? await prisma.reembolsoUnidade.findMany({ where: { reembolsoMesId: mesRow.id } }) : []
  const porUnidade = new Map(linhas.map((l) => [l.unidadeId, l]))

  const out: CortesiaUnidadeView[] = []
  for (const u of unidades) {
    const permuta = await getPermuta(u.id)
    const cfg = await prisma.permutaConfig.findUnique({ where: { unidadeId: u.id }, select: { saldoInicial: true } })
    const anterior = await saldoAnterior(u.id, ano, mes)
    const l = porUnidade.get(u.id)
    const cortesiaUsada = l?.cortesiaUsada ?? 0
    const r = calcularUnidade({
      vouchers: 0, omnichannel: 0, cortesiaUsada, saldoAnterior: anterior, permuta,
      compras: 0, treinamento: 0, faturamentoCaixa: 0, pex: false, isHigienopolis: false, recebe7pct: false,
    })
    const itens = l
      ? (await prisma.reembolsoCortesia.findMany({ where: { reembolsoUnidadeId: l.id }, orderBy: { valor: 'desc' } }))
          .map((c) => ({ codigo: c.codigo, nome: c.nome, valor: c.valor, dataUtilizacao: c.dataUtilizacao }))
      : []
    out.push({
      unidadeId: u.id, nome: u.nome, slug: u.slug,
      valorMensalPermutavel: permuta.valorMensalPermutavel, limiteAcumulo: permuta.limiteAcumulo,
      saldoInicial: cfg?.saldoInicial ?? 0,
      saldoAnterior: anterior, creditoInicial: r.creditoInicial, cortesiaUsada,
      cortesiaReembolso: r.cortesiaReembolso, saldoAcumulado: r.saldoAcumulado, itens,
    })
  }

  const totais = {
    usado: round2(out.reduce((a, x) => a + x.cortesiaUsada, 0)),
    aReembolsar: round2(out.reduce((a, x) => a + x.cortesiaReembolso, 0)),
  }
  return { ano, mes, unidades: out, totais }
}
