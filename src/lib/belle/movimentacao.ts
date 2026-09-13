import { getToken, HEADERS, BASE_URL } from './client-auth'

// ─── Report 103 — "Relatório de Movimentação - Detalhado" (Financeiro) ──────────
// Usado para montar a base de clientes que pagam com TotalPass.
// Colunas úteis: [4]=Confirmação (data BR), [6]=Cliente "ID-Nome", [10]=Forma de pagamento.

const REPORT_MOVIMENTACAO = 103
const FORMA_TOTALPASS = 'Parcerias Comerciais - TotalPass'

export interface ClienteTotalPassBelle {
  clienteId: number | null
  nome: string
  ultimoUso: Date | null   // maior data de confirmação no período
  usos: number             // qtd de movimentos TotalPass no período
}

function parseIdNome(raw: unknown): { id: number | null; nome: string } {
  const s = String(raw || '').trim()
  if (!s.includes('-')) return { id: null, nome: s }
  const idPart = s.split('-')[0].trim()
  const id = /^\d+$/.test(idPart) ? parseInt(idPart, 10) : null
  const nome = s.split('-').slice(1).join('-').trim()
  return { id, nome }
}

// "13/08/2026" → Date
function parseDataBR(val: unknown): Date | null {
  const s = String(val || '').trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return isNaN(d.getTime()) ? null : d
}

/** Clientes que usaram TotalPass no ano (por data de confirmação), agrupados por cliente. */
export async function getClientesTotalPass(
  email: string,
  senha: string,
  estab: string,
  ano: number = new Date().getFullYear(),
): Promise<ClienteTotalPassBelle[]> {
  const token = await getToken(email, senha)
  const hoje = new Date().toISOString().slice(0, 10)

  const filters = [
    { id: 2, value: 2 }, // Tipo Data = Confirmação
    { id: 3, operator: { id: 'BETWEEN', alias: 'BETWEEN', description: 'Entre', allow_multiple_values: '1' }, value: `${ano}-01-01`, value2: hoje },
    { id: 10, value: FORMA_TOTALPASS }, // Forma de Pagamento = TotalPass
  ]

  async function fetchPagina(offset: number): Promise<{ rows: unknown[][]; total: number }> {
    const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify({
        reportId: REPORT_MOVIMENTACAO, sortColumn: null, sortOrder: 1, estab,
        ignoreRecords: false, offsetRecords: offset, maxRecords: 500, filters,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!resp.ok) return { rows: [], total: 0 }
    const data = await resp.json()
    return { rows: data.data || [], total: data.record_count ?? 0 }
  }

  const { rows: firstPage, total } = await fetchPagina(0)
  const allRows: unknown[][] = [...firstPage]
  if (firstPage.length > 0 && total > firstPage.length) {
    const pageSize = firstPage.length
    const offsets: number[] = []
    for (let o = pageSize; o < total; o += pageSize) offsets.push(o)
    const BATCH = 5
    for (let i = 0; i < offsets.length; i += BATCH) {
      const results = await Promise.all(offsets.slice(i, i + BATCH).map(o => fetchPagina(o)))
      for (const { rows } of results) allRows.push(...rows)
    }
  }

  // Agrupa por cliente (ID quando existe, senão nome)
  const mapa = new Map<string, ClienteTotalPassBelle>()
  for (const row of allRows) {
    const { id: clienteId, nome } = parseIdNome(row[6])
    if (!nome) continue
    const conf = parseDataBR(row[4])
    const chave = clienteId != null ? `id:${clienteId}` : `nome:${nome.toLowerCase()}`
    const ex = mapa.get(chave)
    if (ex) {
      ex.usos++
      if (conf && (!ex.ultimoUso || conf > ex.ultimoUso)) ex.ultimoUso = conf
    } else {
      mapa.set(chave, { clienteId, nome, ultimoUso: conf, usos: 1 })
    }
  }
  return Array.from(mapa.values())
}
