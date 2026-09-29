import { prisma } from '@/lib/prisma'
import { getToken, HEADERS, BASE_URL } from '@/lib/belle/client-auth'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { conciliarAtendimentosDia, aplicarRegraColaborador } from '@/lib/conciliacao/motor-atendimentos'

// ─── Parte 2 · F1 · Ingestão da Conciliação de Atendimentos ─────────────────────
// Cruza o UNIVERSO de atendimentos "Atendido" (Report 7) com o CLASSIFICADOR de
// cobertura não-financeira (Report 2421 "Descontos Aplicados", coluna Origem Desconto)
// e grava 1 linha por atendimento em AtendimentoConc (upsert por belleAtendId).
//
// Report 7 "Relatório de Atendimentos" (universo):
//   [0] ID  [1] Data  [2] Horário  [3] Cliente  [6] Serviço  [7] Tempo
//   [8] Profissional  [9] Plano (0=sem)  [11] Tipo  [12] Status ("Atendido")
//   ⚠️ o filtro de data do Report 7 é frouxo → filtramos por [1] Data no código.
//
// Report 2421 "Relatório de Descontos Aplicados" (classificador):
//   [4] Descrição ("{idAtend} - Serviço")  [5] Cliente  [6] Origem Desconto
//   [7] Vlr Bruto  [8] Desconto (R$)  [9] Vlr Final
//
// A classificação FINANCEIRA (dinheiro/cartão/pix via Parte 1) e a regra de
// CORTESIA DE COLABORADOR (roster do RH) entram na F2. Aqui, atendimento sem plano
// e sem desconto fica em A_VERIFICAR_FINANCEIRO (provável pago) — NÃO vira alarme.

const REPORT_ATENDIMENTOS = 7
const REPORT_DESCONTOS = 2421
// Report "Atendimentos com Sessões Compradas": mesmo universo do 7, mas o Cliente vem
// como "id-nome" → usamos só pra enriquecer o clienteId (chave p/ cruzar MovimentacaoBelle).
const REPORT_ATEND_CLIENTE = 241130472
// "Relatório de Uso de Vouchers" — TODOS os vouchers usados (site E local); a Descrição
// começa com o ID do atendimento. (NÃO usar getVouchersUsados aqui: ele filtra só
// 'commerce'/site e perderia os vouchers locais, que também cobrem o atendimento.)
const REPORT_VOUCHERS = 2422
// "Relatório de Aniversariantes" — clientes que fazem aniversário no período. [0] Código
// do Cliente (= clienteId). Usado p/ sugerir a justificativa do desconto de aniversário (R$50).
const REPORT_ANIVERSARIANTES = 1
const VALOR_DESCONTO_ANIVERSARIO = 50 // R$ fixo do desconto de aniversário

type Cell = unknown
type Row = Cell[]

// ── helpers ─────────────────────────────────────────────────────────────────────
function s(v: unknown): string { return String(v ?? '').trim() }

function normData(v: unknown): string {
  const t = s(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : t.slice(0, 10)
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  let t = s(v)
  if (!t) return 0
  if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (t.includes(',')) t = t.replace(',', '.')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : n
}

// "1794-Limpeza de Pele 90" → "Limpeza de Pele 90"
function limparServico(v: unknown): string {
  return s(v).replace(/^\s*\d+\s*-\s*/, '').trim()
}

// "73602150 - Drenagem 50" → "73602150"
function idAtendDaDescricao(v: unknown): string {
  return s(v).split(' - ')[0].trim()
}

// ── modelos de dados ──────────────────────────────────────────────────────────
export interface AtendimentoUniverso {
  belleAtendId: string
  data: string
  horario: string | null
  clienteNome: string
  clienteId: string | null
  servico: string | null
  tempo: number | null
  profissional: string | null
  planoId: string | null   // null quando "0"
  tipo: string | null
  statusAtend: string
}

export interface LinhaDesconto {
  origem: string           // Report 2421 [6] Origem Desconto (bruto)
  bruto: number
  desconto: number
  final: number
}

export interface Classificacao {
  classificacao: string
  justificado: boolean
  valorBruto: number
  covPlano: number
  covVoucher: number
  covParceria: number
  covCortesia: number
  covDesconto: number
  origemDesconto: string | null
}

// ── categorização da Origem Desconto (Report 2421 [6]) ───────────────────────────
const reVoucher = /^uso de voucher:/i
const reCortesia = /uso de promoc[aã]o:\s*cortesia/i
const reParceria = /uso de promoc[aã]o:\s*(pagamento\s*)?(gympass|total\s*pass)/i
const reDescontoPromo = /uso de promoc[aã]o:\s*desconto/i
const reVendaPlano = /venda de planos/i

/**
 * Classifica UM atendimento a partir do plano (Report 7) + linhas de desconto
 * (Report 2421) + se teve voucher usado (Report 2422, site OU local — ambos são
 * cobertura válida do atendimento). Função PURA — testável isoladamente.
 * Prioridade: PLANO > CORTESIA > PARCERIA > VOUCHER > DESCONTO > A_VERIFICAR_FINANCEIRO.
 * (Cortesia antes de voucher pra uma cortesia nunca ser mascarada.)
 */
export function classificarAtendimento(planoId: string | null, descontos: LinhaDesconto[], temVoucher = false): Classificacao {
  let covVoucher = 0, covParceria = 0, covCortesia = 0, covDesconto = 0
  let valorBruto = 0
  const origens = new Set<string>()

  for (const d of descontos) {
    origens.add(d.origem)
    if (d.bruto > valorBruto) valorBruto = d.bruto
    if (reVendaPlano.test(d.origem)) continue           // desconto na VENDA do plano, não é cobertura do atendimento
    if (reVoucher.test(d.origem)) covVoucher += d.desconto
    else if (reCortesia.test(d.origem)) covCortesia += d.desconto
    else if (reParceria.test(d.origem)) covParceria += d.desconto
    else if (reDescontoPromo.test(d.origem)) covDesconto += d.desconto
    else covDesconto += d.desconto                       // "Agenda"(sem plano), "Normal", outros → discricionário
  }

  const origemDesconto = origens.size ? Array.from(origens).join(' | ') : null

  let classificacao: string
  let justificado: boolean
  let covPlano = 0

  if (planoId) {
    classificacao = 'PLANO'; justificado = true; covPlano = valorBruto
    // sob plano, o "desconto" (origem Agenda) é a própria cobertura do plano → não é discricionário
    covDesconto = 0
  } else if (covCortesia > 0) {
    classificacao = 'CORTESIA'; justificado = false      // regra colaborador (RH) decide na F2
  } else if (covParceria > 0) {
    classificacao = 'PARCERIA'; justificado = true
  } else if (covVoucher > 0 || temVoucher) {
    classificacao = 'VOUCHER'; justificado = true        // voucher site (2421) OU local (2422)
    if (temVoucher && covVoucher === 0) covVoucher = valorBruto
  } else if (covDesconto > 0) {
    classificacao = 'DESCONTO'; justificado = false      // desconto discricionário → exige justificativa
  } else {
    classificacao = 'A_VERIFICAR_FINANCEIRO'; justificado = false // sem plano/desconto → provável pago; cruzar Parte 1 (F2)
  }

  return { classificacao, justificado, valorBruto, covPlano, covVoucher, covParceria, covCortesia, covDesconto, origemDesconto }
}

// ── resolução de colunas por TÍTULO (as colunas do Report 7 variam por unidade:
// algumas têm "Tem Preferência" a mais, deslocando Status/Plano/Tipo). Nunca usar
// índice fixo — resolver pelo cabeçalho que o Belle devolve. ────────────────────────
interface ReportData { rows: Row[]; titulos: string[] }

function normTitulo(x: unknown): string {
  return String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Devolve uma função que acha o índice da coluna por título exato ou por regex. */
function indexador(titulos: string[]) {
  const nt = titulos.map(normTitulo)
  return (exato: string, ...fallback: RegExp[]): number => {
    let i = nt.indexOf(exato)
    if (i >= 0) return i
    for (const re of fallback) { i = nt.findIndex((t) => re.test(t)); if (i >= 0) return i }
    return -1
  }
}

// ── busca no Belle (genérica, paginada) ──────────────────────────────────────────
async function buscarReport(token: string, estab: string, reportId: number, ini: string, fim: string): Promise<ReportData> {
  const payload = (offset: number) => ({
    reportId, sortColumn: null, sortOrder: 1, estab, ignoreRecords: false,
    ...(offset > 0 ? { offsetRecords: offset } : {}),
    filters: [{
      id: 1,
      field: { type_id: 'data', description: 'Período' },
      operator: { allow_multiple_values: true, description: 'Entre', id: null },
      value: ini, value2: fim,
    }],
  })
  async function pagina(offset: number): Promise<{ rows: Row[]; total: number; cols: { title?: string; description?: string; name?: string }[] }> {
    const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify(payload(offset)),
      signal: AbortSignal.timeout(90_000),
    })
    if (!resp.ok) throw new Error(`Belle report ${reportId} falhou: ${resp.status}`)
    const data = await resp.json()
    return { rows: (data.data as Row[]) || [], total: data.record_count ?? 0, cols: data.columns ?? [] }
  }
  const { rows: first, total, cols } = await pagina(0)
  const all = [...first]
  while (all.length < total) {
    const { rows } = await pagina(all.length)
    if (!rows.length) break
    all.push(...rows)
  }
  const titulos = (cols || []).map((c) => String(c.title ?? c.description ?? c.name ?? ''))
  return { rows: all, titulos }
}

// ── normalização (por título de coluna — robusto a variação entre unidades) ─────────
function normalizarAtendimentos({ rows, titulos }: ReportData, clienteIdPorAtend: Map<string, string>): AtendimentoUniverso[] {
  const at = indexador(titulos)
  const iId = at('id'), iData = at('data'), iHora = at('horario', /horario/),
    iCli = at('cliente'), iServ = at('servico', /servico/), iTempo = at('tempo'),
    iProf = at('profissional'), iPlano = at('plano'), iTipo = at('tipo'), iStatus = at('status')
  const get = (row: Row, i: number) => (i >= 0 ? row[i] : undefined)
  const out: AtendimentoUniverso[] = []
  for (const row of rows) {
    const belleAtendId = s(get(row, iId))
    if (!belleAtendId) continue
    const planoRaw = s(get(row, iPlano))
    out.push({
      belleAtendId,
      data: normData(get(row, iData)),
      horario: s(get(row, iHora)) || null,
      clienteNome: s(get(row, iCli)),
      clienteId: clienteIdPorAtend.get(belleAtendId) ?? null,
      servico: limparServico(get(row, iServ)) || null,
      tempo: get(row, iTempo) != null && s(get(row, iTempo)) !== '' ? Number(get(row, iTempo)) : null,
      profissional: s(get(row, iProf)) || null,
      planoId: planoRaw && planoRaw !== '0' ? planoRaw : null,
      tipo: s(get(row, iTipo)) || null,
      statusAtend: s(get(row, iStatus)),
    })
  }
  return out
}

/** Monta o mapa atendId → clienteId a partir do Report 241130472 (ID + Cliente "id-nome"). */
function mapearClienteId({ rows, titulos }: ReportData): Map<string, string> {
  const at = indexador(titulos)
  const iId = at('id'), iCli = at('cliente')
  const mapa = new Map<string, string>()
  for (const row of rows) {
    const atendId = s(iId >= 0 ? row[iId] : row[0])
    const cli = s(iCli >= 0 ? row[iCli] : row[3])
    const idPart = cli.includes('-') ? cli.split('-')[0].trim() : ''
    if (atendId && /^\d+$/.test(idPart)) mapa.set(atendId, idPart)
  }
  return mapa
}

/** Monta o mapa idAtend → linhas de desconto a partir do Report 2421 (Descontos Aplicados). */
function mapearDescontos({ rows, titulos }: ReportData): Map<string, LinhaDesconto[]> {
  const at = indexador(titulos)
  const iDesc = at('descricao', /descri/), iOrigem = at('origem desconto', /origem/),
    iBruto = at('valor bruto', /bruto/), iVlrDesc = at('desconto (r$)', /^desconto/), iFinal = at('valor final', /final/)
  const mapa = new Map<string, LinhaDesconto[]>()
  for (const row of rows) {
    const idA = idAtendDaDescricao(iDesc >= 0 ? row[iDesc] : row[4])
    if (!idA) continue
    const linha: LinhaDesconto = {
      origem: s(iOrigem >= 0 ? row[iOrigem] : row[6]),
      bruto: parseValor(iBruto >= 0 ? row[iBruto] : row[7]),
      desconto: parseValor(iVlrDesc >= 0 ? row[iVlrDesc] : row[8]),
      final: parseValor(iFinal >= 0 ? row[iFinal] : row[9]),
    }
    const arr = mapa.get(idA)
    if (arr) arr.push(linha); else mapa.set(idA, [linha])
  }
  return mapa
}

export interface ResultadoIngestaoAtend {
  unidadeSlug: string
  unidadeId: number
  periodo: { de: string; ate: string }
  atendidosLidos: number
  gravados: number
  distribuicao: Record<string, number>
}

/**
 * Ingestão F1: busca Report 7 + Report 2421, classifica cada atendimento "Atendido"
 * do período e faz upsert idempotente em AtendimentoConc.
 */
export async function ingerirAtendimentos(
  unidadeSlug: string, dataIniISO: string, dataFimISO: string,
): Promise<ResultadoIngestaoAtend> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Unidade sem credenciais: ${unidadeSlug}`)
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
  if (!unidade) throw new Error(`Unidade não encontrada no banco: ${unidadeSlug}`)
  const unidadeId = unidade.id
  const estab = String(cred.estab)

  const token = await getToken(cred.email, cred.password)
  const [rep7, rep2421, repCli, repVch] = await Promise.all([
    buscarReport(token, estab, REPORT_ATENDIMENTOS, dataIniISO, dataFimISO),
    buscarReport(token, estab, REPORT_DESCONTOS, dataIniISO, dataFimISO),
    buscarReport(token, estab, REPORT_ATEND_CLIENTE, dataIniISO, dataFimISO),
    buscarReport(token, estab, REPORT_VOUCHERS, dataIniISO, dataFimISO),
  ])

  const descontosPorAtend = mapearDescontos(rep2421)
  const clienteIdPorAtend = mapearClienteId(repCli)

  // Atendimentos cobertos por VOUCHER (site OU local) — a Descrição do Report 2422 começa
  // com o ID do atendimento. Ambos os tipos são cobertura válida do serviço (o voucher
  // local foi vendido antes e gerou financeiro; hoje é só uso).
  const atVch = indexador(repVch.titulos)
  const iDescVch = atVch('descricao', /descri/)
  const atendComVoucher = new Set<string>()
  for (const row of repVch.rows) {
    const idA = idAtendDaDescricao(iDescVch >= 0 ? row[iDescVch] : row[4])
    if (idA) atendComVoucher.add(idA)
  }

  // Universo: só "Atendido" e dentro do range (o filtro de data do Report 7 é frouxo).
  // Colunas resolvidas por título (variam por unidade — ex.: coluna "Tem Preferência").
  const atendidos = normalizarAtendimentos(rep7, clienteIdPorAtend)
    .filter((a) =>
      a.statusAtend.toUpperCase() === 'ATENDIDO' &&
      a.data >= dataIniISO && a.data <= dataFimISO)

  // Aniversariantes por mês (Report 1) — clientes que fazem aniversário no MÊS do
  // atendimento (não só no range da sincronização). Usado p/ sugerir a justificativa
  // do desconto de aniversário.
  const aniversarioPorMes = new Map<string, Set<string>>()
  for (const mes of new Set(atendidos.map((a) => a.data.slice(0, 7)))) {
    try {
      const [y, m] = mes.split('-').map(Number)
      const ultimo = new Date(y, m, 0).getDate()
      const repAniv = await buscarReport(token, estab, REPORT_ANIVERSARIANTES, `${mes}-01`, `${mes}-${String(ultimo).padStart(2, '0')}`)
      const iCod = indexador(repAniv.titulos)('codigo do cliente', /codigo/, /cliente/)
      const set = new Set<string>()
      for (const row of repAniv.rows) { const cid = s(iCod >= 0 ? row[iCod] : row[0]); if (/^\d+$/.test(cid)) set.add(cid) }
      aniversarioPorMes.set(mes, set)
    } catch (e) {
      console.error(`[atendimentos] aniversariantes ${unidadeSlug} ${mes}:`, e instanceof Error ? e.message : e)
    }
  }

  const distribuicao: Record<string, number> = {}
  let gravados = 0
  const diasTocados = new Set<string>()

  for (const a of atendidos) {
    diasTocados.add(a.data)
    const cls = classificarAtendimento(a.planoId, descontosPorAtend.get(a.belleAtendId) ?? [], atendComVoucher.has(a.belleAtendId))
    distribuicao[cls.classificacao] = (distribuicao[cls.classificacao] ?? 0) + 1
    const aniversarioMes = !!(a.clienteId && aniversarioPorMes.get(a.data.slice(0, 7))?.has(a.clienteId))
    const dados = {
      data: a.data, horario: a.horario, clienteNome: a.clienteNome, clienteId: a.clienteId,
      servico: a.servico, tempo: a.tempo, profissional: a.profissional, planoId: a.planoId,
      tipo: a.tipo, statusAtend: a.statusAtend, valorBruto: cls.valorBruto,
      covPlano: cls.covPlano, covVoucher: cls.covVoucher, covParceria: cls.covParceria,
      covCortesia: cls.covCortesia, covDesconto: cls.covDesconto,
      classificacao: cls.classificacao, justificado: cls.justificado, aniversarioMes,
      origemDesconto: cls.origemDesconto,
    }
    await prisma.atendimentoConc.upsert({
      where: { unidadeId_belleAtendId: { unidadeId, belleAtendId: a.belleAtendId } },
      create: { unidadeId, belleAtendId: a.belleAtendId, ...dados },
      update: dados,
    })
    gravados++
  }

  // Motor F2: cruza os A_VERIFICAR com a Parte 1 e gera divergências, por dia tocado.
  for (const data of diasTocados) {
    await conciliarAtendimentosDia(unidadeId, data)
  }

  // Regra de cortesia de colaborador (F2d): passo mensal por mês tocado.
  const meses = new Set(Array.from(diasTocados).map((d) => d.slice(0, 7)))
  for (const mes of meses) {
    await aplicarRegraColaborador(unidadeId, mes)
  }

  return {
    unidadeSlug, unidadeId,
    periodo: { de: dataIniISO, ate: dataFimISO },
    atendidosLidos: atendidos.length, gravados, distribuicao,
  }
}
