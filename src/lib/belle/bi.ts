import { getToken, HEADERS, BASE_URL } from './client-auth'

interface BIFilter {
  id: number
  field: { type_id: string; description: string }
  operator: { allow_multiple_values: boolean; description: string; id: null }
  value: string
  value2: string
}

interface BITotalizacao {
  label: string
  value: number
  format: string
  totais?: BITotalizacao[] // Belle passou a aninhar os valores dentro de grupos (ex: "Total Geral")
}

interface BIReportResponse {
  data: unknown[][] | null
  record_count: number
  totalization_data: BITotalizacao[]
  columns: { title: string }[]
}

function filtroPeriodo(dataIni: string, dataFim: string): BIFilter {
  return {
    id: 1,
    field: { type_id: 'data', description: 'Período' },
    operator: { allow_multiple_values: true, description: 'Entre', id: null },
    value: dataIni,
    value2: dataFim,
  }
}

async function buildReport(
  token: string,
  reportId: number,
  estab: string,
  dataIni: string,
  dataFim: string,
  ignoreRecords = true
): Promise<BIReportResponse> {
  const payload = {
    reportId,
    sortColumn: null,
    sortOrder: 1,
    estab,
    ignoreRecords,
    filters: [filtroPeriodo(dataIni, dataFim)],
  }

  const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000), // 90s — relatórios BI podem ser lentos
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`BI report ${reportId} falhou: HTTP ${resp.status} — ${txt.slice(0, 200)}`)
  }
  return resp.json()
}

// Achata a árvore de totalizações: o Belle agrupa os valores dentro de itens-grupo
// (ex: { label: "Total Geral", totais: [...] }), então varremos todos os níveis.
function flattenTotalizacoes(data: BITotalizacao[]): BITotalizacao[] {
  const out: BITotalizacao[] = []
  for (const item of data) {
    out.push(item)
    if (Array.isArray(item.totais)) out.push(...flattenTotalizacoes(item.totais))
  }
  return out
}

function totalizacaoPorLabel(data: BITotalizacao[], labelParcial: string): number {
  const lower = labelParcial.toLowerCase()
  // Só considera itens-folha (com valor numérico), ignorando cabeçalhos de grupo
  const item = flattenTotalizacoes(data).find(
    t => typeof t.value === 'number' && t.label?.toLowerCase().includes(lower)
  )
  return item?.value ?? 0
}

// Busca uma métrica (ex: "Valor Líquido") DENTRO de um grupo específico
// (ex: "Plano - Aprovado"). O Belle passou a agrupar as vendas por tipo,
// com as métricas genéricas repetidas dentro de cada grupo.
function valorNoGrupo(data: BITotalizacao[], grupoLabel: string, metrica: string): number {
  const g = grupoLabel.toLowerCase().trim()
  const m = metrica.toLowerCase()
  const grupo = data.find(t => t.label?.toLowerCase().trim() === g && Array.isArray(t.totais))
  if (!grupo?.totais) return 0
  const item = grupo.totais.find(t => typeof t.value === 'number' && t.label?.toLowerCase().includes(m))
  return item?.value ?? 0
}

export interface FaturamentoMensal {
  periodo: { ini: string; fim: string }
  caixa: number
  totalPass: number
  gympass: number
  parcelasComerciais: number
  horasAtendimento: number
  vendasRecepcao: number
  totalBruto: number
  totalDesconto: number
  totalAReceber: number
}

export interface VendasRecepcao {
  vouchers: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  planos: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  produtos: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  total: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
}

// Mapeamento de Report IDs por unidade (baseado no email)
// Cada unidade pode ter IDs diferentes para o relatório de Receitas
const REPORT_IDS_RECEITAS: Record<string, number> = {
  // Shopping Metrópole usa Report 241153509
  'adm.shoppingmetropole@buddhaspa.com.br': 241153509,
  // Outras unidades usam Report 184 - "[Buddha] Resumo - Receitas do Período"
  // (será o padrão se não estiver no mapeamento)
}

// Unidades que usam o Report 241130697 "[Buddha] Consolidado de Receitas"
// Neste relatório, os dados vêm na última coluna como um objeto JSON
const UNIDADES_CONSOLIDADO = [
  'administracao.shoppinganaliafranco@buddhaspa.com.br', // Shopping Anália Franco
  'administracao.perdizes@buddhaspa.com.br',             // Perdizes
  'adm.tatuapegomescardim@buddhaspa.com.br',             // Tatuapé Gomes Cardim
]

export async function getVendasRecepcao(
  email: string,
  senha: string,
  estab: string,
  dataIni: string,
  dataFim: string
): Promise<VendasRecepcao> {
  const token = await getToken(email, senha)

  // Report 183 - Demonstrativo de Vendas
  const demonstrativo = await buildReport(token, 183, estab, dataIni, dataFim, false)

  const tot = demonstrativo.totalization_data
  const data = demonstrativo.data || []

  // Extrair valores por tipo das totalizações
  // VOUCHERS: Somar TODOS os tipos (Em Aberto + Usado + Ambos)
  const voucherEmAbertoBruto = valorNoGrupo(tot, 'Voucher - Em Aberto', 'valor bruto')
  const voucherEmAbertoLiq = valorNoGrupo(tot, 'Voucher - Em Aberto', 'valor líquido')

  const voucherUsadoBruto = valorNoGrupo(tot, 'Voucher - Usado', 'valor bruto')
  const voucherUsadoLiq = valorNoGrupo(tot, 'Voucher - Usado', 'valor líquido')

  const voucherAmbosBruto = valorNoGrupo(tot, 'Voucher - Em Aberto, Voucher - Usado', 'valor bruto')
  const voucherAmbosLiq = valorNoGrupo(tot, 'Voucher - Em Aberto, Voucher - Usado', 'valor líquido')

  const voucherBruto = voucherEmAbertoBruto + voucherUsadoBruto + voucherAmbosBruto
  const voucherLiquido = voucherEmAbertoLiq + voucherUsadoLiq + voucherAmbosLiq

  const planosBruto = valorNoGrupo(tot, 'Plano - Aprovado', 'valor bruto')
  const planosLiquido = valorNoGrupo(tot, 'Plano - Aprovado', 'valor líquido')

  const produtosBruto = valorNoGrupo(tot, 'Produto - Fechado', 'valor bruto')
  const produtosLiquido = valorNoGrupo(tot, 'Produto - Fechado', 'valor líquido')

  // Contar quantidades por tipo a partir dos dados.
  // ATENÇÃO: a coluna de origem é a [8] ("Origem": "Plano - Aprovado",
  // "Voucher - Usado", "Produto - Fechado", "Serviço - Atendido"...). A [7] é
  // "Itens da Venda" (nomes de serviço) — usá-la contava só voucher por acaso
  // (nomes de item contêm "Voucher") e zerava planos/produtos.
  let qtdVouchers = 0
  let qtdPlanos = 0
  let qtdProdutos = 0

  data.forEach((row: any) => {
    const origem = String(row[8] ?? '').toLowerCase()
    // Voucher (exceto cancelado, coerente com a soma dos valores)
    if (origem.includes('voucher') && !origem.includes('cancelado')) {
      qtdVouchers++
    } else if (origem.includes('plano') && origem.includes('aprovado')) {
      qtdPlanos++
    } else if (origem.includes('produto') && origem.includes('fechado')) {
      qtdProdutos++
    }
  })

  return {
    vouchers: {
      quantidade: qtdVouchers,
      valorBruto: voucherBruto,
      valorLiquido: voucherLiquido,
    },
    planos: {
      quantidade: qtdPlanos,
      valorBruto: planosBruto,
      valorLiquido: planosLiquido,
    },
    produtos: {
      quantidade: qtdProdutos,
      valorBruto: produtosBruto,
      valorLiquido: produtosLiquido,
    },
    total: {
      quantidade: qtdVouchers + qtdPlanos + qtdProdutos,
      valorBruto: voucherBruto + planosBruto + produtosBruto,
      valorLiquido: voucherLiquido + planosLiquido + produtosLiquido,
    },
  }
}

export async function getFaturamentoMensal(
  email: string,
  senha: string,
  estab: string,
  dataIni: string,
  dataFim: string
): Promise<FaturamentoMensal> {
  const token = await getToken(email, senha)

  // Verificar se esta unidade usa o Consolidado de Receitas (Report 241130697)
  const usaConsolidado = UNIDADES_CONSOLIDADO.includes(email)
  const reportIdReceitas = usaConsolidado ? 241130697 : (REPORT_IDS_RECEITAS[email] || 184)

  // Os 3 relatórios são independentes → busca em PARALELO (antes eram sequenciais,
  // ~3s cada = ~10s; em paralelo cai para ~1 relatório).
  const [receitasReport, demonstrativo, consolidado] = await Promise.all([
    buildReport(token, reportIdReceitas, estab, dataIni, dataFim, false),
    buildReport(token, 183, estab, dataIni, dataFim, false),
    buildReport(token, 241130694, estab, dataIni, dataFim, false),
  ])

  let caixa = 0
  let parcelasComerciais = 0
  let totalBruto = 0
  let totalDesconto = 0
  let totalAReceber = 0

  if (usaConsolidado) {
    // Os dados vêm na última coluna da primeira linha como um objeto
    if (receitasReport.data && receitasReport.data.length > 0) {
      const row = receitasReport.data[0] as any[]
      const dadosReceitas = row[row.length - 1] // última coluna
      if (typeof dadosReceitas === 'object' && dadosReceitas !== null) {
        caixa = parseFloat(dadosReceitas.total_recebido || '0')
        parcelasComerciais = parseFloat(dadosReceitas.parcer_comerc || '0')
        totalBruto = parseFloat(dadosReceitas.total_pag_bruto || '0')
      }
    }
  } else {
    // Unidades que usam Report 184 ou 241153509 (formato com totalizações)
    const tot = receitasReport.totalization_data
    caixa = totalizacaoPorLabel(tot, 'total recebido em caixa')
    parcelasComerciais = totalizacaoPorLabel(tot, 'total forma pag. parcerias comerciais') ||
                         totalizacaoPorLabel(tot, 'parcerias comerciais')
    totalBruto = totalizacaoPorLabel(tot, 'total bruto')
    totalDesconto = totalizacaoPorLabel(tot, 'total desconto')
    totalAReceber = totalizacaoPorLabel(tot, 'total a receber')
  }

  // — Demonstrativo de Vendas (183) — TotalPass e Gympass (comum para todas)
  const dem = demonstrativo.totalization_data
  const totalPass = valorNoGrupo(dem, 'Parcerias Comerciais - TotalPass', 'valor líquido')
  const gympass = valorNoGrupo(dem, 'Parcerias Comerciais - Gympass', 'valor líquido')

  // — Vendas Recepção = Vouchers Em Aberto + Planos + Produtos —
  const vouchers = valorNoGrupo(dem, 'Voucher - Em Aberto', 'valor líquido')
  const planosLiq = valorNoGrupo(dem, 'Plano - Aprovado', 'valor líquido')
  const produtosLiq = valorNoGrupo(dem, 'Produto - Fechado', 'valor líquido')
  const vendasRecepcao = vouchers + planosLiq + produtosLiq

  // — Horas de Atendimento — col[3] do Consolidado 241130694 —
  let horasAtendimento = 0
  if (consolidado.data && consolidado.data.length > 0) {
    const row = consolidado.data[0] as (number | string)[]
    const val = row[3]
    horasAtendimento = typeof val === 'number' ? val : parseFloat(String(val)) || 0
  }

  return {
    periodo: { ini: dataIni, fim: dataFim },
    caixa,
    totalPass,
    gympass,
    parcelasComerciais,
    horasAtendimento,
    vendasRecepcao,
    totalBruto,
    totalDesconto,
    totalAReceber,
  }
}
