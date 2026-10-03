import { prisma } from '@/lib/prisma'

// ─── F2 · Motor de Conciliação ──────────────────────────────────────────────────
// Compara as movimentações do Belle (MovimentacaoBelle) com as fontes de verdade e
// gera Divergencia. Esta fatia cobre o DINHEIRO (caixa), que já mora no gestao
// (ContagemCaixa + SaidaCaixa) e não depende de nenhuma API externa.
//
// Cartão (operadora), Pix (banco) e parceiros (check-in) entram na F3.

// Tolerância de arredondamento/troco no fechamento do caixa (R$).
export const TOLERANCIA_DINHEIRO = 2.0
// Cartão casa por valor exato (só absorve centavo de arredondamento).
export const TOLERANCIA_CARTAO = 0.01

const FORMA_DINHEIRO = 'Dinheiro'
const FORMAS_CARTAO = ['Cartão de Crédito', 'Cartão de Débito']
const ORIGEM_CARTAO = 'OPERADORA_CARTAO'
const FORMA_TOTALPASS = 'Parcerias Comerciais - TotalPass'
const FORMA_GYMPASS = 'Parcerias Comerciais - Gympass'
const ORIGEM_TOTALPASS = 'TOTALPASS'
const ORIGEM_GYMPASS = 'GYMPASS'
const FORMA_VOUCHER = 'Voucher'
const ORIGEM_VOUCHER = 'VOUCHER_SITE'
// Pix DIRETO (QR/chave) cai direto na conta → casa com o extrato do banco. No Belle essa
// forma se chama "PIX Conta Corrente". "PIX Máquina" liquida pela adquirente (Rede) e
// aparece no banco como "RECEBIMENTO REDE" (cartão), NÃO como Pix — por isso fica de fora.
const FORMAS_PIX = ['PIX Conta Corrente']
const ORIGEM_PIX = 'BANCO_PIX'
const STATUS_ABERTOS = ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA'] as const

export interface AvaliacaoDinheiro {
  temFonte: boolean          // existe fechamento de caixa p/ comparar?
  conciliado: boolean
  dinheiroBelle: number      // o que o Belle diz que entrou em dinheiro
  dinheiroReal: number       // o que realmente havia no caixa
  diferenca: number          // real − belle (>0 sobra física; <0 falta física)
  tipo: 'FALTA_NO_BELLE' | 'VALOR_DIVERGENTE' | null
}

/**
 * Núcleo puro da conciliação de dinheiro — sem I/O, fácil de testar.
 * dinheiroReal = fechamento − fundoAbertura + saídas (sangrias).
 */
export function avaliarDinheiro(params: {
  dinheiroBelle: number
  fundoAbertura: number | null
  valorFechamento: number | null
  saidas: number
  tolerancia?: number
}): AvaliacaoDinheiro {
  const tol = params.tolerancia ?? TOLERANCIA_DINHEIRO
  const { dinheiroBelle, fundoAbertura, valorFechamento, saidas } = params

  // Sem fechamento contado não dá pra conciliar dinheiro (dia ainda aberto).
  if (valorFechamento == null) {
    return { temFonte: false, conciliado: false, dinheiroBelle, dinheiroReal: 0, diferenca: 0, tipo: null }
  }

  const dinheiroReal = valorFechamento - (fundoAbertura ?? 0) + saidas
  const diferenca = Number((dinheiroReal - dinheiroBelle).toFixed(2))

  if (Math.abs(diferenca) <= tol) {
    return { temFonte: true, conciliado: true, dinheiroBelle, dinheiroReal, diferenca, tipo: null }
  }
  // Caixa tem MAIS que o Belle → pagamento em dinheiro não lançado no Belle.
  // Caixa tem MENOS → dinheiro registrado no Belle que não está no caixa.
  const tipo = diferenca > 0 ? 'FALTA_NO_BELLE' : 'VALOR_DIVERGENTE'
  return { temFonte: true, conciliado: false, dinheiroBelle, dinheiroReal, diferenca, tipo }
}

export interface ItemValor { id: number; valor: number }
export interface ResultadoMatch {
  pares: { belleId: number; fonteId: number }[]
  belleSemPar: number[]   // lançado no Belle, sem transação na operadora
  fonteSemPar: number[]   // transação na operadora, sem lançamento no Belle
}

/**
 * Casamento guloso por valor (exato dentro da tolerância) — sem I/O, testável.
 * Cada transação da operadora casa com no máximo um lançamento do Belle e vice-versa.
 */
export function casarPorValor(belle: ItemValor[], fontes: ItemValor[], tolerancia = TOLERANCIA_CARTAO): ResultadoMatch {
  const pares: { belleId: number; fonteId: number }[] = []
  const fonteUsada = new Set<number>()
  const belleUsado = new Set<number>()
  // Ordena por valor p/ um casamento estável.
  const bs = [...belle].sort((a, b) => a.valor - b.valor)
  const fs = [...fontes].sort((a, b) => a.valor - b.valor)
  for (const b of bs) {
    const f = fs.find((x) => !fonteUsada.has(x.id) && Math.abs(x.valor - b.valor) <= tolerancia)
    if (f) {
      pares.push({ belleId: b.id, fonteId: f.id })
      fonteUsada.add(f.id)
      belleUsado.add(b.id)
    }
  }
  return {
    pares,
    belleSemPar: bs.filter((b) => !belleUsado.has(b.id)).map((b) => b.id),
    fonteSemPar: fs.filter((f) => !fonteUsada.has(f.id)).map((f) => f.id),
  }
}

/** Concilia o dinheiro de um dia: avalia caixa × Belle e mantém a Divergencia. */
export async function conciliarDinheiroDia(unidadeId: number, data: string): Promise<AvaliacaoDinheiro> {
  const movsDinheiro = await prisma.movimentacaoBelle.findMany({
    where: { unidadeId, data, formaPagamento: FORMA_DINHEIRO },
  })
  const dinheiroBelle = movsDinheiro
    .filter((m) => (m.tipoMovimento ?? 'E').toUpperCase() !== 'S')
    .reduce((s, m) => s + (m.valorLiquido || 0), 0)

  const caixa = await prisma.contagemCaixa.findUnique({ where: { unidadeId_data: { unidadeId, data } } })
  const saidasAgg = await prisma.saidaCaixa.aggregate({ where: { unidadeId, data }, _sum: { valor: true } })
  const saidas = saidasAgg._sum.valor ?? 0

  const aval = avaliarDinheiro({
    dinheiroBelle,
    fundoAbertura: caixa?.fundoAbertura ?? null,
    valorFechamento: caixa?.valorFechamento ?? null,
    saidas,
  })

  // Divergência de dinheiro em aberto deste dia (se houver).
  const existente = await prisma.divergencia.findFirst({
    where: { unidadeId, data, formaPagamento: FORMA_DINHEIRO, status: { in: [...STATUS_ABERTOS] } },
  })

  const novoStatusMov = !aval.temFonte ? 'PENDENTE' : aval.conciliado ? 'CONCILIADA' : 'DIVERGENTE'
  await prisma.movimentacaoBelle.updateMany({
    where: { unidadeId, data, formaPagamento: FORMA_DINHEIRO },
    data: { statusConcil: novoStatusMov },
  })

  if (!aval.temFonte) return aval // dia sem fechamento: não cria nem fecha divergência

  if (aval.conciliado) {
    // Bateu: se havia divergência aberta, ela foi resolvida.
    if (existente) {
      await prisma.divergencia.update({
        where: { id: existente.id },
        data: { status: 'CONCILIADA', reprocessadaEm: new Date(), valorEncontrado: aval.dinheiroReal, diferenca: aval.diferenca },
      })
    }
    return aval
  }

  // Não bateu: cria ou atualiza a divergência preservando o estado do loop.
  const dados = {
    unidadeId,
    data,
    tipo: aval.tipo!,
    formaPagamento: FORMA_DINHEIRO,
    valorEsperado: aval.dinheiroBelle,   // o que o Belle registra
    valorEncontrado: aval.dinheiroReal,  // o que há no caixa
    diferenca: aval.diferenca,
  }
  if (existente) {
    // Se já estava em tratamento/reprocessada e ainda diverge → REPROCESSADA; senão mantém ABERTA.
    const status = existente.status === 'ABERTA' ? 'ABERTA' : 'REPROCESSADA'
    await prisma.divergencia.update({
      where: { id: existente.id },
      data: { ...dados, status, reprocessadaEm: existente.status === 'ABERTA' ? null : new Date() },
    })
  } else {
    await prisma.divergencia.create({ data: { ...dados, status: 'ABERTA' } })
  }
  return aval
}

export interface ResultadoMatchDia { temFonte: boolean; casados: number; belleSemPar: number; fonteSemPar: number }

interface ConfigMatch {
  formas: string[]        // formas de pagamento no Belle
  origem: string          // origem correspondente em FonteExterna
  tipoBelleSemPar: string // divergência p/ lançamento Belle sem par (SOBRA_NO_BELLE | SEM_CHECKIN)
}

/**
 * Casa lançamentos do Belle (por valor BRUTO) com as transações de uma FonteExterna
 * e mantém as divergências por item. Genérico:
 *  - Cartão  → tipoBelleSemPar = SOBRA_NO_BELLE (lançou cartão, sem venda na operadora)
 *  - Parceiro→ tipoBelleSemPar = SEM_CHECKIN   (lançou parceiro, sem check-in = perde reembolso)
 * Em ambos, transação externa sem par no Belle = FALTA_NO_BELLE.
 * Sem dados externos ainda → deixa pendente e NÃO flaga (evita alarme falso).
 */
export async function conciliarPorMatch(unidadeId: number, data: string, cfg: ConfigMatch): Promise<ResultadoMatchDia> {
  const belleMovs = (await prisma.movimentacaoBelle.findMany({
    where: { unidadeId, data, formaPagamento: { in: cfg.formas } },
  })).filter((m) => (m.tipoMovimento ?? 'E').toUpperCase() !== 'S')

  const fontes = await prisma.fonteExterna.findMany({ where: { unidadeId, data, origem: cfg.origem } })

  if (fontes.length === 0) {
    if (belleMovs.length) {
      await prisma.movimentacaoBelle.updateMany({
        where: { unidadeId, data, formaPagamento: { in: cfg.formas } },
        data: { statusConcil: 'PENDENTE' },
      })
    }
    return { temFonte: false, casados: 0, belleSemPar: 0, fonteSemPar: 0 }
  }

  const match = casarPorValor(
    belleMovs.map((m) => ({ id: m.id, valor: m.valorBruto })),
    fontes.map((f) => ({ id: f.id, valor: f.valor })),
  )
  const paresBelle = new Set(match.pares.map((p) => p.belleId))
  const paresFonte = new Set(match.pares.map((p) => p.fonteId))

  for (const p of match.pares) {
    await prisma.movimentacaoBelle.update({ where: { id: p.belleId }, data: { statusConcil: 'CONCILIADA' } })
    await prisma.fonteExterna.update({ where: { id: p.fonteId }, data: { statusMatch: 'CASADA', movimentacaoId: p.belleId } })
  }
  await fecharDivergenciasLigadas(match.pares.map((p) => p.belleId), match.pares.map((p) => p.fonteId))

  for (const m of belleMovs.filter((b) => !paresBelle.has(b.id))) {
    await prisma.movimentacaoBelle.update({ where: { id: m.id }, data: { statusConcil: 'DIVERGENTE' } })
    await manterDivergenciaLigada({
      unidadeId, data, tipo: cfg.tipoBelleSemPar, formaPagamento: m.formaPagamento,
      valorEsperado: m.valorBruto, valorEncontrado: 0, diferenca: Number((-m.valorBruto).toFixed(2)),
      movimentacaoId: m.id,
    })
  }

  for (const f of fontes.filter((x) => !paresFonte.has(x.id))) {
    await prisma.fonteExterna.update({ where: { id: f.id }, data: { statusMatch: 'SEM_PAR' } })
    await manterDivergenciaLigada({
      unidadeId, data, tipo: 'FALTA_NO_BELLE', formaPagamento: f.formaPagamento ?? cfg.origem,
      valorEsperado: 0, valorEncontrado: f.valor, diferenca: Number(f.valor.toFixed(2)),
      fonteExternaId: f.id,
    })
  }

  return { temFonte: true, casados: match.pares.length, belleSemPar: match.belleSemPar.length, fonteSemPar: match.fonteSemPar.length }
}

/** Cartão: casa Belle (Crédito/Débito) × operadora (Rede/Getnet/Stone). */
export function conciliarCartaoDia(unidadeId: number, data: string): Promise<ResultadoMatchDia> {
  return conciliarPorMatch(unidadeId, data, { formas: FORMAS_CARTAO, origem: ORIGEM_CARTAO, tipoBelleSemPar: 'SOBRA_NO_BELLE' })
}

/** Fecha (CONCILIADA) divergências abertas ligadas a movs/fontes que casaram. */
async function fecharDivergenciasLigadas(movIds: number[], fonteIds: number[]): Promise<void> {
  if (movIds.length) {
    await prisma.divergencia.updateMany({
      where: { movimentacaoId: { in: movIds }, status: { in: [...STATUS_ABERTOS] } },
      data: { status: 'CONCILIADA', reprocessadaEm: new Date() },
    })
  }
  if (fonteIds.length) {
    await prisma.divergencia.updateMany({
      where: { fonteExternaId: { in: fonteIds }, status: { in: [...STATUS_ABERTOS] } },
      data: { status: 'CONCILIADA', reprocessadaEm: new Date() },
    })
  }
}

/** Cria/atualiza uma divergência ligada a um mov ou fonte, preservando o loop. */
async function manterDivergenciaLigada(d: {
  unidadeId: number; data: string; tipo: string; formaPagamento: string | null
  valorEsperado: number; valorEncontrado: number; diferenca: number
  movimentacaoId?: number; fonteExternaId?: number
}): Promise<void> {
  const existente = await prisma.divergencia.findFirst({
    where: {
      status: { in: [...STATUS_ABERTOS] },
      ...(d.movimentacaoId ? { movimentacaoId: d.movimentacaoId } : {}),
      ...(d.fonteExternaId ? { fonteExternaId: d.fonteExternaId } : {}),
    },
  })
  const base = {
    unidadeId: d.unidadeId, data: d.data, tipo: d.tipo, formaPagamento: d.formaPagamento,
    valorEsperado: d.valorEsperado, valorEncontrado: d.valorEncontrado, diferenca: d.diferenca,
    movimentacaoId: d.movimentacaoId ?? null, fonteExternaId: d.fonteExternaId ?? null,
  }
  if (existente) {
    const status = existente.status === 'ABERTA' ? 'ABERTA' : 'REPROCESSADA'
    await prisma.divergencia.update({
      where: { id: existente.id },
      data: { ...base, status, reprocessadaEm: existente.status === 'ABERTA' ? null : new Date() },
    })
  } else {
    await prisma.divergencia.create({ data: { ...base, status: 'ABERTA' } })
  }
}

// O banco COMPENSA o Pix na data útil seguinte: um Pix recebido sex/sáb/dom "posta" na
// segunda. O Belle registra na data real do atendimento. Por isso o match não pode ser por
// dia exato — casamos por valor dentro de uma JANELA de ±3 dias (medido no extrato real:
// ±0d=65%, ±1d=80%, ±3d=95%, ±5d=98% — ±3 pega o fim de semana sem abrir demais).
export const JANELA_PIX_DIAS = 3
const diasEntre = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000)

/**
 * Pix (banco) × Belle — mão dupla, no escopo da UNIDADE INTEIRA (como voucher), NÃO por dia.
 * Casa Belle (forma 'PIX Conta Corrente') com o extrato do banco (FonteExterna BANCO_PIX) por
 * VALOR exato + data mais próxima dentro de ±JANELA_PIX_DIAS (compensação bancária).
 *   - Belle sem par no banco → SOBRA_NO_BELLE (lançou e não caiu na conta).
 *   - Banco sem par no Belle → FALTA_NO_BELLE (caiu na conta e não foi lançado).
 * Sem NENHUM extrato ainda → Belle fica pendente e NÃO flaga (evita alarme falso). Roda pela
 * ingestão de OFX (ingerirOFX), igual o voucher roda pela ingestão do WordPress.
 */
export async function conciliarPixUnidade(unidadeId: number): Promise<ResultadoMatchDia> {
  const belle = (await prisma.movimentacaoBelle.findMany({
    where: { unidadeId, formaPagamento: { in: FORMAS_PIX } },
  })).filter((m) => (m.tipoMovimento ?? 'E').toUpperCase() !== 'S')
  const fontes = await prisma.fonteExterna.findMany({ where: { unidadeId, origem: ORIGEM_PIX } })

  const diasAfetados = new Set<string>()
  for (const m of belle) diasAfetados.add(m.data)
  for (const f of fontes) diasAfetados.add(f.data)

  // Sem extrato → não dá pra afirmar nada: Belle pendente, fecha o que estava aberto.
  if (fontes.length === 0) {
    if (belle.length) {
      await prisma.movimentacaoBelle.updateMany({
        where: { unidadeId, formaPagamento: { in: FORMAS_PIX } }, data: { statusConcil: 'PENDENTE' },
      })
      await prisma.divergencia.updateMany({
        where: { unidadeId, formaPagamento: { in: FORMAS_PIX }, status: { in: [...STATUS_ABERTOS] } },
        data: { status: 'CONCILIADA', reprocessadaEm: new Date() },
      })
      for (const data of diasAfetados) await recalcularResumoDia(unidadeId, data)
    }
    return { temFonte: false, casados: 0, belleSemPar: 0, fonteSemPar: 0 }
  }

  // Casamento guloso: p/ cada Belle (do mais antigo), pega a fonte de MESMO valor com a data
  // mais próxima dentro da janela. Cada fonte casa no máximo uma vez.
  const fonteUsada = new Set<number>()
  const movCasados: number[] = []
  const fontesCasadas: number[] = []
  for (const m of [...belle].sort((a, b) => a.data.localeCompare(b.data))) {
    let melhor = -1, melhorDiff = Infinity
    for (const f of fontes) {
      if (fonteUsada.has(f.id)) continue
      if (Math.abs(f.valor - m.valorBruto) > TOLERANCIA_CARTAO) continue
      const dd = diasEntre(f.data, m.data)
      if (dd <= JANELA_PIX_DIAS && dd < melhorDiff) { melhorDiff = dd; melhor = f.id }
    }
    if (melhor >= 0) {
      fonteUsada.add(melhor); movCasados.push(m.id); fontesCasadas.push(melhor)
      await prisma.movimentacaoBelle.update({ where: { id: m.id }, data: { statusConcil: 'CONCILIADA' } })
      await prisma.fonteExterna.update({ where: { id: melhor }, data: { statusMatch: 'CASADA', movimentacaoId: m.id } })
    }
  }
  await fecharDivergenciasLigadas(movCasados, fontesCasadas)

  // Belle sem par → SOBRA_NO_BELLE (lançou, não caiu).
  const casadosSet = new Set(movCasados)
  let belleSemPar = 0
  for (const m of belle.filter((x) => !casadosSet.has(x.id))) {
    belleSemPar++
    await prisma.movimentacaoBelle.update({ where: { id: m.id }, data: { statusConcil: 'DIVERGENTE' } })
    await manterDivergenciaLigada({
      unidadeId, data: m.data, tipo: 'SOBRA_NO_BELLE', formaPagamento: m.formaPagamento,
      valorEsperado: m.valorBruto, valorEncontrado: 0, diferenca: Number((-m.valorBruto).toFixed(2)),
      movimentacaoId: m.id,
    })
  }

  // Banco sem par → FALTA_NO_BELLE (caiu, não lançou).
  let fonteSemPar = 0
  for (const f of fontes.filter((x) => !fonteUsada.has(x.id))) {
    fonteSemPar++
    await prisma.fonteExterna.update({ where: { id: f.id }, data: { statusMatch: 'SEM_PAR' } })
    await manterDivergenciaLigada({
      unidadeId, data: f.data, tipo: 'FALTA_NO_BELLE', formaPagamento: f.formaPagamento ?? 'Pix - Banco',
      valorEsperado: 0, valorEncontrado: f.valor, diferenca: Number(f.valor.toFixed(2)),
      fonteExternaId: f.id,
    })
  }

  for (const data of diasAfetados) await recalcularResumoDia(unidadeId, data)
  return { temFonte: true, casados: movCasados.length, belleSemPar, fonteSemPar }
}

/** Parceiro (TotalPass/Gympass): casa Belle × check-ins da plataforma. Sem check-in = SEM_CHECKIN. */
export function conciliarParceiroDia(
  unidadeId: number, data: string, forma: string, origem: string,
): Promise<ResultadoMatchDia> {
  return conciliarPorMatch(unidadeId, data, { formas: [forma], origem, tipoBelleSemPar: 'SEM_CHECKIN' })
}

/**
 * Voucher do site: casa por CÓDIGO (não por valor), no escopo da UNIDADE INTEIRA —
 * SEM barreira de dia nem de mês. Um voucher pode ser validado no WordPress num mês e
 * usado no Belle em outro; casar por dia gerava divergência dupla (SEM_VALIDACAO num dia
 * + FALTA_NO_BELLE no outro). Aqui juntamos TODOS os usados × TODOS os validados da
 * unidade e casamos por código.
 *   - USADO no Belle (forma 'Voucher', código em vendaRef) sem validação → SEM_VALIDACAO
 *     (reembolso em risco), ancorado no dia do lançamento.
 *   - VALIDADO no WP (FonteExterna VOUCHER_SITE, código em refExterna) sem uso no Belle →
 *     FALTA_NO_BELLE, ancorado no dia da validação.
 * Sem NENHUM dado do WP ainda → tudo pendente (não flaga). Recalcula o resumo de cada
 * dia tocado (usados + validados).
 */
export async function conciliarVouchersUnidade(unidadeId: number): Promise<ResultadoMatchDia> {
  const belleV = await prisma.movimentacaoBelle.findMany({ where: { unidadeId, formaPagamento: FORMA_VOUCHER } })
  const fontes = await prisma.fonteExterna.findMany({ where: { unidadeId, origem: ORIGEM_VOUCHER } })

  // Todo dia que tem voucher (usado ou validado) precisa do resumo recalculado no fim.
  const diasAfetados = new Set<string>()
  for (const m of belleV) diasAfetados.add(m.data)
  for (const f of fontes) diasAfetados.add(f.data)

  // Sem nenhuma validação do WP → não dá pra afirmar nada: pendente e fecha o que estava aberto.
  if (fontes.length === 0) {
    if (belleV.length) {
      await prisma.movimentacaoBelle.updateMany({
        where: { unidadeId, formaPagamento: FORMA_VOUCHER }, data: { statusConcil: 'PENDENTE' },
      })
      await prisma.divergencia.updateMany({
        where: { unidadeId, formaPagamento: FORMA_VOUCHER, status: { in: [...STATUS_ABERTOS] } },
        data: { status: 'CONCILIADA', reprocessadaEm: new Date() },
      })
      for (const data of diasAfetados) await recalcularResumoDia(unidadeId, data)
    }
    return { temFonte: false, casados: 0, belleSemPar: 0, fonteSemPar: 0 }
  }

  const fontePorCodigo = new Map<string, (typeof fontes)[number]>()
  for (const f of fontes) { if (f.refExterna) fontePorCodigo.set(f.refExterna.toUpperCase().trim(), f) }
  const fontesUsadas = new Set<number>()
  const movsCasados: number[] = []
  let belleSemPar = 0

  for (const m of belleV) {
    const codigo = (m.vendaRef ?? '').toUpperCase().trim()
    const f = codigo ? fontePorCodigo.get(codigo) : undefined
    if (f && !fontesUsadas.has(f.id)) {
      fontesUsadas.add(f.id)
      movsCasados.push(m.id)
      await prisma.movimentacaoBelle.update({ where: { id: m.id }, data: { statusConcil: 'CONCILIADA' } })
      await prisma.fonteExterna.update({ where: { id: f.id }, data: { statusMatch: 'CASADA', movimentacaoId: m.id } })
    } else {
      belleSemPar++
      await prisma.movimentacaoBelle.update({ where: { id: m.id }, data: { statusConcil: 'DIVERGENTE' } })
      await manterDivergenciaLigada({
        unidadeId, data: m.data, tipo: 'SEM_VALIDACAO', formaPagamento: FORMA_VOUCHER,
        valorEsperado: m.valorBruto, valorEncontrado: 0, diferenca: Number((-m.valorBruto).toFixed(2)),
        movimentacaoId: m.id,
      })
    }
  }
  await fecharDivergenciasLigadas(movsCasados, [...fontesUsadas])

  // Validado no WP mas não usado no Belle → FALTA_NO_BELLE.
  let fonteSemPar = 0
  for (const f of fontes.filter((x) => !fontesUsadas.has(x.id))) {
    fonteSemPar++
    await prisma.fonteExterna.update({ where: { id: f.id }, data: { statusMatch: 'SEM_PAR' } })
    await manterDivergenciaLigada({
      unidadeId, data: f.data, tipo: 'FALTA_NO_BELLE', formaPagamento: FORMA_VOUCHER,
      valorEsperado: 0, valorEncontrado: f.valor, diferenca: Number(f.valor.toFixed(2)),
      fonteExternaId: f.id,
    })
  }

  for (const data of diasAfetados) await recalcularResumoDia(unidadeId, data)
  return { temFonte: true, casados: movsCasados.length, belleSemPar, fonteSemPar }
}

/**
 * Orquestra a conciliação de um dia (dinheiro + cartão + parceiros) e atualiza o
 * resumo ConciliacaoDia. Pix (Itaú/Santander) e voucher do site entram a seguir na F3.
 */
export async function conciliarDia(unidadeId: number, data: string): Promise<void> {
  await conciliarDinheiroDia(unidadeId, data)
  await conciliarCartaoDia(unidadeId, data)
  await conciliarParceiroDia(unidadeId, data, FORMA_TOTALPASS, ORIGEM_TOTALPASS)
  await conciliarParceiroDia(unidadeId, data, FORMA_GYMPASS, ORIGEM_GYMPASS)
  // Pix e Voucher NÃO são por dia: casam na unidade inteira (janela/cross-mês) — ver
  // conciliarPixUnidade() (ingestão de OFX) e conciliarVouchersUnidade() (ingestão WP).
  await recalcularResumoDia(unidadeId, data)
}

/** Recalcula o resumo ConciliacaoDia de um dia a partir das movs e divergências atuais. */
async function recalcularResumoDia(unidadeId: number, data: string): Promise<void> {
  const movs = await prisma.movimentacaoBelle.findMany({ where: { unidadeId, data } })
  const entradas = movs.filter((m) => (m.tipoMovimento ?? 'E').toUpperCase() !== 'S')
  const totalBelle = entradas.reduce((s, m) => s + (m.valorLiquido || 0), 0)
  const totalConciliado = movs
    .filter((m) => m.statusConcil === 'CONCILIADA')
    .reduce((s, m) => s + (m.valorLiquido || 0), 0)

  const abertas = await prisma.divergencia.count({
    where: { unidadeId, data, status: { in: [...STATUS_ABERTOS] } },
  })
  const emTratamento = await prisma.divergencia.count({
    where: { unidadeId, data, status: { in: ['EM_TRATAMENTO', 'REPROCESSADA'] } },
  })
  const status = abertas === 0 ? 'CONCILIADO' : emTratamento > 0 ? 'EM_TRATAMENTO' : 'ABERTO'

  await prisma.conciliacaoDia.upsert({
    where: { unidadeId_data: { unidadeId, data } },
    create: {
      unidadeId, data, totalBelle, totalConciliado,
      qtdMovimentacoes: movs.length, qtdDivergencias: abertas, qtdAbertas: abertas,
      status, ultimoProcessamento: new Date(),
    },
    update: {
      totalBelle, totalConciliado,
      qtdMovimentacoes: movs.length, qtdDivergencias: abertas, qtdAbertas: abertas,
      status, ultimoProcessamento: new Date(),
    },
  })
}
