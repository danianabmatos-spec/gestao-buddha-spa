import { prisma } from '@/lib/prisma'
import { getToken, HEADERS, BASE_URL } from '@/lib/belle/client-auth'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { conciliarDia } from '@/lib/conciliacao/motor'

// ─── F1 · Ingestão de Movimentações do Belle (Report 103) ───────────────────────
// Puxa TODAS as formas de pagamento (sem filtro de forma) do "Relatório de
// Movimentação - Detalhado" por unidade + período e grava normalizado em
// MovimentacaoBelle (upsert por Cód). Depois recalcula o resumo ConciliacaoDia.
//
// Colunas do Report 103 (confirmadas ao vivo):
//   [0] Cód. (id único)         [1] Nº Pcl.        [2] Lançamento     [3] Vencimento
//   [4] Confirmação             [5] CPF/CNPJ       [6] Cliente        [7] Pagador
//   [8] Origem ("Venda #...")   [9] Responsável    [10] Forma Pgto.   [11] Tipo (E/S)
//   [12] Vlr. Bruto             [13] Taxas         [14] Juros/Multa   [15] Vlr. Líquido
//   [16] Conf. (S/N)            children: [[servico, tipo, resp, valorStr, ...]]

const REPORT_MOVIMENTACAO = 103
const PAGE_SIZE = 500

type Row = Record<string, unknown> & { children?: unknown[][] }

export interface MovimentacaoNormalizada {
  belleMovId: string
  vendaRef: string | null
  data: string // YYYY-MM-DD
  clienteNome: string
  clienteId: string | null
  cpf: string | null
  responsavel: string | null
  servico: string | null
  tipoVenda: string | null
  formaPagamento: string | null
  tipoMovimento: string | null
  confirmado: boolean
  parcelas: number
  valorBruto: number
  taxas: number
  valorLiquido: number
}

// "17097218-Lina Lobato" → { id, nome }
function parseIdNome(raw: unknown): { id: string | null; nome: string } {
  const s = String(raw ?? '').trim()
  if (!s.includes('-')) return { id: null, nome: s }
  const idPart = s.split('-')[0].trim()
  const id = /^\d+$/.test(idPart) ? idPart : null
  const nome = s.split('-').slice(1).join('-').trim()
  return { id, nome }
}

// "01/09/2026" → "2026-09-01"
function dataBRtoISO(val: unknown): string | null {
  const m = String(val ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// Aceita número (368) ou string BR ("1.140,00") ou string ponto ("0.00").
function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  let s = String(v ?? '').trim()
  if (!s) return 0
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// "PIX  " → "PIX"; colapsa espaços internos.
function normalizaForma(v: unknown): string | null {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ')
  return s || null
}

// "1/3" → 3 (total de parcelas); fallback 1.
function parseParcelas(v: unknown): number {
  const m = String(v ?? '').match(/\/(\d+)/)
  return m ? Number(m[1]) : 1
}

function resumoServicos(children?: unknown[][]): { servico: string | null; tipoVenda: string | null } {
  if (!Array.isArray(children) || children.length === 0) return { servico: null, tipoVenda: null }
  const nomes = children.map(c => parseIdNome(c?.[0]).nome).filter(Boolean)
  const tipos = Array.from(new Set(children.map(c => String(c?.[1] ?? '').trim()).filter(Boolean)))
  return {
    servico: nomes.length ? nomes.join(' + ') : null,
    tipoVenda: tipos.length ? tipos.join(', ') : null,
  }
}

export function normalizarRow(row: Row): MovimentacaoNormalizada | null {
  const belleMovId = String(row['0'] ?? '').trim()
  if (!belleMovId) return null
  const { id: clienteId, nome } = parseIdNome(row['6'])
  const { servico, tipoVenda } = resumoServicos(row.children)
  return {
    belleMovId,
    vendaRef: String(row['8'] ?? '').trim() || null,
    data: dataBRtoISO(row['4']) ?? '',
    clienteNome: nome,
    clienteId,
    cpf: String(row['5'] ?? '').trim() || null,
    responsavel: String(row['9'] ?? '').trim() || null,
    servico,
    tipoVenda,
    formaPagamento: normalizaForma(row['10']),
    tipoMovimento: String(row['11'] ?? '').trim() || null,
    confirmado: String(row['16'] ?? '').trim().toUpperCase() === 'S',
    parcelas: parseParcelas(row['1']),
    valorBruto: parseValor(row['12']),
    taxas: parseValor(row['13']),
    valorLiquido: parseValor(row['15']),
  }
}

async function fetchPagina(
  token: string, estab: string, filters: unknown[], offset: number,
): Promise<{ rows: Row[]; total: number }> {
  const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({
      reportId: REPORT_MOVIMENTACAO, sortColumn: null, sortOrder: 1, estab,
      ignoreRecords: false, offsetRecords: offset, maxRecords: PAGE_SIZE, filters,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!resp.ok) throw new Error(`Belle report 103 falhou: ${resp.status}`)
  const data = await resp.json()
  return { rows: (data.data as Row[]) || [], total: data.record_count ?? 0 }
}

/** Busca todas as movimentações (todas as formas de pagamento) no período. */
export async function buscarMovimentacoes(
  email: string, senha: string, estab: string, dataIniISO: string, dataFimISO: string,
): Promise<Row[]> {
  const token = await getToken(email, senha)
  const filters = [
    { id: 2, value: 2 }, // Tipo Data = Confirmação
    { id: 3, operator: { id: 'BETWEEN', alias: 'BETWEEN', description: 'Entre', allow_multiple_values: '1' }, value: dataIniISO, value2: dataFimISO },
    // sem filtro de forma de pagamento → todas
  ]
  const { rows: first, total } = await fetchPagina(token, estab, filters, 0)
  const all = [...first]
  if (first.length > 0 && total > first.length) {
    const offsets: number[] = []
    for (let o = first.length; o < total; o += first.length) offsets.push(o)
    const BATCH = 5
    for (let i = 0; i < offsets.length; i += BATCH) {
      const res = await Promise.all(offsets.slice(i, i + BATCH).map(o => fetchPagina(token, estab, filters, o)))
      for (const { rows } of res) all.push(...rows)
    }
  }
  return all
}

export interface ResultadoIngestao {
  unidadeSlug: string
  unidadeId: number
  periodo: { de: string; ate: string }
  lidas: number
  gravadas: number
  dias: number
}

/**
 * Ingestão completa: busca no Belle, normaliza, faz upsert em MovimentacaoBelle
 * (por unidadeId+Cód) e recalcula o resumo ConciliacaoDia de cada dia tocado.
 */
export async function ingerirMovimentacoes(
  unidadeSlug: string, dataIniISO: string, dataFimISO: string,
): Promise<ResultadoIngestao> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Unidade sem credenciais: ${unidadeSlug}`)
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
  if (!unidade) throw new Error(`Unidade não encontrada no banco: ${unidadeSlug}`)
  const unidadeId = unidade.id

  const rows = await buscarMovimentacoes(cred.email, cred.password, String(cred.estab), dataIniISO, dataFimISO)
  const normalizadas = rows.map(r => normalizarRow(r)).filter((m): m is MovimentacaoNormalizada => !!m && !!m.data)

  const diasTocados = new Set<string>()
  for (const m of normalizadas) {
    diasTocados.add(m.data)
    await prisma.movimentacaoBelle.upsert({
      where: { unidadeId_belleMovId: { unidadeId, belleMovId: m.belleMovId } },
      create: { unidadeId, ...m },
      update: {
        vendaRef: m.vendaRef, data: m.data, clienteNome: m.clienteNome, clienteId: m.clienteId,
        cpf: m.cpf, responsavel: m.responsavel, servico: m.servico, tipoVenda: m.tipoVenda,
        formaPagamento: m.formaPagamento, tipoMovimento: m.tipoMovimento, confirmado: m.confirmado,
        parcelas: m.parcelas, valorBruto: m.valorBruto, taxas: m.taxas, valorLiquido: m.valorLiquido,
      },
    })
  }

  // Após ingerir, concilia cada dia tocado (dinheiro na F2; cartão/pix/parceiros na F3)
  // — isso também atualiza o resumo ConciliacaoDia.
  for (const data of diasTocados) {
    await conciliarDia(unidadeId, data)
  }

  return {
    unidadeSlug, unidadeId,
    periodo: { de: dataIniISO, ate: dataFimISO },
    lidas: rows.length, gravadas: normalizadas.length, dias: diasTocados.size,
  }
}
