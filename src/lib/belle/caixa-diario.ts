import { getToken, HEADERS, BASE_URL } from './client-auth'
import { getUnidadeCredenciais } from './unidades-config'
import { prisma } from '@/lib/prisma'
import { format, eachDayOfInterval, parseISO } from 'date-fns'

export interface CaixaDiario {
  data: string // "dd/MM"
  valor: number
}

// Achata a árvore de totalizações do Belle (os valores vêm aninhados dentro de
// grupos). Sem isso, o 'total recebido em caixa' não é encontrado e o dia vira 0.
function flatten(data: any[]): any[] {
  const out: any[] = []
  for (const item of data || []) {
    out.push(item)
    if (Array.isArray(item?.totais)) out.push(...flatten(item.totais))
  }
  return out
}

const REPORT_IDS_RECEITAS: Record<string, number> = {
  'adm.shoppingmetropole@buddhaspa.com.br': 241153509,
}
const UNIDADES_CONSOLIDADO = [
  'administracao.shoppinganaliafranco@buddhaspa.com.br',
  'administracao.perdizes@buddhaspa.com.br',
  'adm.tatuapegomescardim@buddhaspa.com.br',
]

function totalizacaoPorLabel(data: any[], labelParcial: string): number {
  const lower = labelParcial.toLowerCase()
  const item = flatten(data).find(
    (t: any) => typeof t.value === 'number' && t.label && t.label.toLowerCase().includes(lower)
  )
  return item?.value ?? 0
}

async function buscarCaixaDia(token: string, email: string, estab: string, data: string): Promise<number> {
  const usaConsolidado = UNIDADES_CONSOLIDADO.includes(email)
  const reportId = usaConsolidado ? 241130697 : (REPORT_IDS_RECEITAS[email] || 184)
  const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({
      reportId, sortColumn: null, sortOrder: 1, estab, ignoreRecords: false,
      filters: [{ id: 1, field: { type_id: 'data', description: 'Período' }, operator: { allow_multiple_values: true, description: 'Entre', id: null }, value: data, value2: data }],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!resp.ok) return 0
  const resultado = await resp.json()
  if (usaConsolidado) {
    if (resultado.data && resultado.data.length > 0) {
      const row = resultado.data[0] as any[]
      const dadosReceitas = row[row.length - 1]
      if (typeof dadosReceitas === 'object' && dadosReceitas !== null) {
        return parseFloat(dadosReceitas.total_recebido || '0')
      }
    }
    return 0
  }
  return totalizacaoPorLabel(resultado.totalization_data || [], 'total recebido em caixa')
}

// Recebido EM DINHEIRO no dia (para conferir o caixa físico). Nas unidades normais
// vem da label "Total Forma Pag. Dinheiro"; nas consolidadas, do campo `dinheiro`.
export async function getRecebimentoDinheiroDia(unidadeSlug: string, data: string): Promise<number> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) return 0
  const token = await getToken(cred.email, cred.password)
  const usaConsolidado = UNIDADES_CONSOLIDADO.includes(cred.email)
  const reportId = usaConsolidado ? 241130697 : (REPORT_IDS_RECEITAS[cred.email] || 184)
  const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${cred.estab}`, {
    method: 'POST', headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({
      reportId, sortColumn: null, sortOrder: 1, estab: String(cred.estab), ignoreRecords: false,
      filters: [{ id: 1, field: { type_id: 'data', description: 'Período' }, operator: { allow_multiple_values: true, description: 'Entre', id: null }, value: data, value2: data }],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!resp.ok) return 0
  const j = await resp.json()
  if (usaConsolidado) {
    const row = j.data?.[0]
    const last = Array.isArray(row) ? row[row.length - 1] : null
    return last && typeof last === 'object' ? (parseFloat((last as any).dinheiro || '0') || 0) : 0
  }
  return totalizacaoPorLabel(j.totalization_data || [], 'forma pag. dinheiro')
}

// Entrada de DINHEIRO ACUMULADA no mês até `dataAteh`, do Report 103 "Movimentação
// Detalhado" por data de CONFIRMAÇÃO (o mesmo que a Daniana usa no Belle). Soma o
// totalizador "Entrada - Dinheiro" (Valor Bruto). Report 103 é de sistema (mesmo id
// p/ todas as unidades); a isolação vem do login de cada unidade.
export async function getEntradaDinheiroAcumulada(unidadeSlug: string, dataAteh: string): Promise<number> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) return 0
  const token = await getToken(cred.email, cred.password)
  const ini = `${dataAteh.slice(0, 7)}-01` // 1º dia do mês do dataAteh
  const filters = [
    { id: 2, value: 2 }, // Tipo Data = Confirmação
    { id: 3, operator: { id: 'BETWEEN', alias: 'BETWEEN', description: 'Entre', allow_multiple_values: '1' }, value: ini, value2: dataAteh },
  ]
  const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${cred.estab}`, {
    method: 'POST', headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify({ reportId: 103, sortColumn: null, sortOrder: 1, estab: String(cred.estab), ignoreRecords: false, offsetRecords: 0, maxRecords: 500, filters }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!resp.ok) return 0
  const j = await resp.json()
  const grupos: any[] = j.totalization_data || []
  const dinheiro = grupos.find((g) => String(g?.label || '').toLowerCase().includes('entrada - dinheiro'))
  if (!dinheiro) return 0
  const bruto = (dinheiro.totais || []).find((t: any) => /bruto/i.test(String(t?.label || '')))
  const v = bruto?.value
  return typeof v === 'number' ? v : (Number(v) || 0)
}

// Caixa diário do período, com CACHE: dias fechados (< hoje) nunca mudam → servidos
// do banco (CaixaDiarioCache). Só o dia de hoje (e dias sem cache) vão ao Belle.
export async function getCaixaDiario(unidade: string, dataIni: string, dataFim: string): Promise<CaixaDiario[]> {
  const credenciais = getUnidadeCredenciais(unidade)
  if (!credenciais) return []

  const todosDias = eachDayOfInterval({ start: parseISO(dataIni), end: parseISO(dataFim) })
  const hojeStr = format(new Date(), 'yyyy-MM-dd')

  const cacheRows = await prisma.caixaDiarioCache.findMany({
    where: { unidadeSlug: unidade, dia: { in: todosDias.map(d => format(d, 'yyyy-MM-dd')) } },
  })
  const cacheMap = new Map(cacheRows.map(r => [r.dia, r.valor]))

  const diasParaBuscar = todosDias.filter(d => {
    const s = format(d, 'yyyy-MM-dd')
    return s === hojeStr || !cacheMap.has(s)
  })

  if (diasParaBuscar.length > 0) {
    const token = await getToken(credenciais.email, credenciais.password)
    const batchSize = 4
    for (let i = 0; i < diasParaBuscar.length; i += batchSize) {
      const batch = diasParaBuscar.slice(i, i + batchSize)
      const results = await Promise.all(batch.map(async (dia) => {
        const s = format(dia, 'yyyy-MM-dd')
        const valor = Math.round(await buscarCaixaDia(token, credenciais.email, String(credenciais.estab), s))
        return { s, valor }
      }))
      for (const { s, valor } of results) {
        cacheMap.set(s, valor)
        if (s < hojeStr && valor > 0) {
          await prisma.caixaDiarioCache.upsert({
            where: { unidadeSlug_dia: { unidadeSlug: unidade, dia: s } },
            create: { unidadeSlug: unidade, dia: s, valor },
            update: { valor },
          })
        }
      }
    }
  }

  return todosDias.map(d => ({
    data: format(d, 'dd/MM'),
    valor: cacheMap.get(format(d, 'yyyy-MM-dd')) ?? 0,
  }))
}
