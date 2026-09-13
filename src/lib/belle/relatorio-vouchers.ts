import { getToken, HEADERS, BASE_URL } from './client-auth'

export interface VoucherUsado {
  idVenda: string
  lançamento: string
  dataExecucao: string
  cliente: string
  descricao: string
  origem: string
  valorBruto: number
  desconto: number
  valorFinal: number
  origemDesconto: string
  tipo: 'E-commerce' | 'Normal'
  codigoVoucher?: string // Extraído de origemDesconto
}

/**
 * Busca relatório de vouchers USADOS do Belle
 * Endpoint: BI/v1.0/report/build
 * ReportId: 2422 (Relatório de Uso de Vouchers)
 */
async function fetchReportPage(
  token: string,
  dataIniISO: string,
  dataFimISO: string,
  offsetRecords: number = 0
): Promise<any> {
  const payload: any = {
    reportId: 2422,
    sortColumn: null,
    sortOrder: 1,
    estab: '1',
    filters: [
      { id: '121101', value: 'commerce' },
      { id: '121096', value: '' },
      { id: '121095', value: '' },
      { id: '121094', value: '' },
      { id: '121093', value: '' },
      { id: '121092', value: '' },
      { id: '121091', value: '' },
      { id: '121090', value: '' },
      { id: '121089', value: '' },
      { id: '121088', value: '' },
      { id: '121088', value2: '' },
      { id: '121088', range: true },
      { id: '121087', value: dataIniISO },
      { id: '121087', value2: dataFimISO },
      { id: '121087', range: false }
    ],
    ignoreRecords: false
  }

  // Adiciona offsetRecords apenas se > 0 (igual ao Belle web)
  if (offsetRecords > 0) {
    payload.offsetRecords = offsetRecords
  }

  const resp = await fetch(
    `${BASE_URL}/BI/v1.0/report/build?estabGeral=1`,
    {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify(payload)
    }
  )

  if (!resp.ok) {
    throw new Error(`Belle relatório vouchers failed: ${resp.status}`)
  }

  return resp.json()
}

export async function getVouchersUsados(
  email: string,
  senha: string,
  dataIni: string, // "2026-06-01"
  dataFim: string, // "2026-06-06"
  estab: number
): Promise<VoucherUsado[]> {
  const token = await getToken(email, senha)

  // Converte datas para ISO format
  const dataIniISO = new Date(dataIni + 'T03:00:00.000Z').toISOString()
  const dataFimISO = new Date(dataFim + 'T03:00:00.000Z').toISOString()

  // Busca primeira página
  const firstPage = await fetchReportPage(token, dataIniISO, dataFimISO, 0)

  const recordCount = firstPage.record_count || 0
  const pageSize = firstPage.data?.length || 0

  // Coleta todos os registros
  let allRecords = firstPage.data || []

  // Se há mais páginas, busca usando offsetRecords
  if (recordCount > pageSize) {
    let offset = pageSize
    while (offset < recordCount) {
      const nextPage = await fetchReportPage(token, dataIniISO, dataFimISO, offset)
      const newRecords = nextPage.data || []
      allRecords = allRecords.concat(newRecords)

      offset += newRecords.length

      // Segurança: se não retornou nada, para o loop
      if (newRecords.length === 0) break
    }
  }

  console.log(`🔍 Belle Report 2422: ${allRecords.length}/${recordCount} vouchers coletados (${dataIni} a ${dataFim})`)

  // Parseia os dados do relatório
  // Belle retorna arrays, não objetos:
  // [0]=ID Venda, [1]=Lançamento, [2]=Data Execução, [3]=Cliente,
  // [4]=Descrição, [5]=Origem, [6]=Valor Bruto, [7]=Desconto,
  // [8]=Valor Final, [9]=Origem Desconto, [10]=Tipo
  const vouchers: VoucherUsado[] = []

  const records = allRecords

  for (const record of records) {
    if (!Array.isArray(record)) continue

    const origemDesconto = String(record[9] || '')
    const tipo = String(record[10] || '')

    // Extrai código do voucher de "Uso de voucher: JBG56I6"
    const match = origemDesconto.match(/voucher:\s*([A-Z0-9]+)/i)
    const codigoVoucher = match ? match[1].toUpperCase().trim() : undefined

    vouchers.push({
      idVenda: String(record[0] || ''),
      lançamento: String(record[1] || ''),
      dataExecucao: String(record[2] || ''),
      cliente: String(record[3] || ''),
      descricao: String(record[4] || ''),
      origem: String(record[5] || ''),
      valorBruto: parseFloat(String(record[6] || '0').replace(',', '.')),
      desconto: parseFloat(String(record[7] || '0').replace(',', '.')),
      valorFinal: parseFloat(String(record[8] || '0').replace(',', '.')),
      origemDesconto,
      tipo: tipo === 'E-commerce' ? 'E-commerce' : 'Normal',
      codigoVoucher
    })
  }

  return vouchers
}

import { getVoucherCacheFlexivel } from '../cache-vouchers'

/**
 * Filtra vouchers válidos seguindo a EXATA lógica do Navvii
 *
 * LÓGICA DESCOBERTA via inspeção:
 * 1. NÃO filtra por tipo - aceita E-commerce E Normal
 * 2. Remove códigos 1511779... (omnichannel)
 * 3. EXCETO códigos 1511779... que ESTÃO no WordPress (foram validados manualmente)
 *
 * Resultado esperado:
 * - Belle: 65 vouchers total
 * - Sem 1511779...: 39 vouchers
 * - Mais 1511779... que estão no WP: +9 = 48 vouchers
 * - Navvii mostra: 57 (ainda faltam 9, investigar depois)
 */
export function filtrarVouchersEcommerce(
  vouchers: VoucherUsado[],
  dataIni?: string,
  dataFim?: string
): VoucherUsado[] {
  // Busca cache do WordPress para verificar códigos 1511779... que foram validados
  let wpCodes = new Set<string>()
  if (dataIni && dataFim) {
    const cacheWP = getVoucherCacheFlexivel(dataIni, dataFim)
    if (cacheWP && Array.isArray(cacheWP.vouchers)) {
      wpCodes = new Set(
        cacheWP.vouchers
          .map(v => (v as { codigo?: string }).codigo?.toUpperCase().trim())
          .filter(Boolean) as string[]
      )
    }
  }

  return vouchers.filter(v => {
    // 1. Deve ter código válido (não vazio)
    if (!v.codigoVoucher || v.codigoVoucher.trim() === '') return false

    const codigo = v.codigoVoucher.trim()

    // 2. Códigos 1511779... (omnichannel): só mantém se foram validados no WordPress
    if (codigo.startsWith('1511779')) {
      return wpCodes.has(codigo.toUpperCase())
    }

    // 3. Outros códigos: aceita todos
    return true
  })
}
