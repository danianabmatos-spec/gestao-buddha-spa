import { getToken, invalidarToken, HEADERS, BASE_URL } from './client-auth'

// POST /report/build com re-autenticação no 401 (Belle às vezes invalida o token no
// meio — ex.: conta compartilhada da Higienópolis). Tenta 1x com token novo.
async function postReport(email: string, senha: string, estab: number, body: unknown, timeoutMs: number): Promise<Response> {
  const chamar = (tk: string) => fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
    method: 'POST', headers: { ...HEADERS, Authorization: tk }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  })
  let token = await getToken(email, senha)
  let resp = await chamar(token)
  if (resp.status === 401) {
    invalidarToken(email)
    token = await getToken(email, senha, true)
    resp = await chamar(token)
  }
  return resp
}

export interface NPSData {
  promotores: number
  neutros: number
  detratores: number
  total: number
  nps: number
}

export interface NPSResult {
  profissionais: NPSData
  atendimento: NPSData
  unidade: NPSData
}

/**
 * Busca relatório de Análise de NPS do Belle (Report ID: 21)
 * Calcula NPS para Profissionais, Atendimento e Unidade Total
 */
export interface NPSPorProfissional {
  profissional: string
  promotores: number
  neutros: number
  detratores: number
  total: number
  nps: number
}

// O ID do filtro de data do Report 21 VARIA por unidade (ex.: Metrópole 338306625,
// Higienópolis 338340992). Descobrimos dinamicamente lendo a definição do relatório
// (report/build com ignoreRecords) e achando o filtro de field_id satisfacao_cliente.data.
// Cacheado por email para não repetir a chamada a cada consulta.
const filtroDataCache = new Map<string, number>()

// IDs de filtro de data do Report 21 CONHECIDOS por conta Belle. Para contas onde o
// meta call (report/build ignoreRecords) é lento/instável — ex.: Higienópolis, cuja
// conta compartilhada faz o meta demorar ~60s (batia o timeout a cada consulta) —
// usamos o id direto, sem meta call.
const FILTRO_DATA_CONHECIDO: Record<string, number> = {
  'adm.shoppingmetropole@buddhaspa.com.br': 338306625,
  'administracao@buddhaspa.com.br': 338340992, // Higienópolis
}

async function getFiltroDataId(email: string, senha: string, estab: number): Promise<number | null> {
  const cached = filtroDataCache.get(email)
  if (cached !== undefined) return cached

  const conhecido = FILTRO_DATA_CONHECIDO[email]
  if (conhecido) { filtroDataCache.set(email, conhecido); return conhecido }

  try {
    // Timeout curto: se o meta demorar, é melhor cair no fallback do que travar a tela.
    const resp = await postReport(email, senha, estab,
      { reportId: 21, sortColumn: null, sortOrder: 1, estab: String(estab), ignoreRecords: true, filters: [] }, 20_000)
    const j = await resp.json()
    const filtros: any[] = j?.filters || []
    const f = filtros.find((x) => x?.field_id === 'satisfacao_cliente.data'
      || (x?.field?.column_name === 'data' && x?.field?.type_id === 'data'))
    const id = f ? Number(f.id) : null
    if (id) filtroDataCache.set(email, id)
    return id
  } catch {
    return null
  }
}

async function buscarPaginaNPS(
  email: string, senha: string, estab: number, filtroDataId: number,
  dataIni: string, dataFim: string, offsetRecords: number,
): Promise<{ data: any[]; record_count: number }> {
  const payload: any = {
    reportId: 21, // Relatório de Análise de NPS
    sortColumn: null,
    sortOrder: 1,
    estab: String(estab),
    filters: [{ id: filtroDataId, value: dataIni, value2: dataFim, range: true }],
    ignoreRecords: false,
  }
  if (offsetRecords > 0) payload.offsetRecords = offsetRecords

  const resp = await postReport(email, senha, estab, payload, 90_000)
  if (!resp.ok) throw new Error(`Belle relatório NPS failed: ${resp.status}`)
  const j = await resp.json()
  return { data: j.data || [], record_count: j.record_count || 0 }
}

export async function buscarRelatorioNPS(
  email: string,
  senha: string,
  dataIni: string,
  dataFim: string,
  estab: number
): Promise<any[]> {
  // ID do filtro de data descoberto por unidade (varia por unidade no Belle).
  const filtroDataId = (await getFiltroDataId(email, senha, estab)) ?? 338306625

  // 1ª página para saber o total e o tamanho de página; depois pagina em PARALELO
  // (lotes de 5) — unidades grandes como a Higienópolis têm muitas respostas de NPS e
  // a paginação sequencial levava ~60s.
  const primeira = await buscarPaginaNPS(email, senha, estab, filtroDataId, dataIni, dataFim, 0)
  let todos: any[] = primeira.data
  const total = primeira.record_count
  const pageSize = primeira.data.length
  if (pageSize > 0 && total > pageSize) {
    const offsets: number[] = []
    for (let o = pageSize; o < total; o += pageSize) offsets.push(o)
    const BATCH = 3 // gentil com o rate limit do Belle (429)
    for (let i = 0; i < offsets.length; i += BATCH) {
      const results = await Promise.all(
        offsets.slice(i, i + BATCH).map(o => buscarPaginaNPS(email, senha, estab, filtroDataId, dataIni, dataFim, o)),
      )
      for (const r of results) todos = todos.concat(r.data)
    }
  }
  return todos
}

export async function getNPSRelatorio(
  email: string,
  senha: string,
  dataIni: string, // "2026-01-01"
  dataFim: string, // "2026-06-30"
  estab: number
): Promise<NPSResult> {
  // Estrutura: [Data, Cliente, Classificação, Tipo NPS, Nota, Descrição, ID Atend., Profissional, Serviços]
  // Índices:    [0]   [1]      [2]            [3]       [4]   [5]         [6]         [7]           [8]
  const records = await buscarRelatorioNPS(email, senha, dataIni, dataFim, estab)

  console.log(`📊 NPS ${email.split('@')[0]}: ${records.length} registros (${dataIni} a ${dataFim})`)

  // Separar por tipo (valores: "Profissional", "Atendimento", "Venda", etc.)
  const profissionais = records.filter((r: any[]) =>
    String(r[3] || '').toLowerCase().includes('profissional')
  )
  const atendimento = records.filter((r: any[]) =>
    String(r[3] || '').toLowerCase().includes('atendimento')
  )

  // Unidade Total = soma apenas de Profissionais + Atendimento (exclui outros tipos como Venda)
  const unidadeRecords = [...profissionais, ...atendimento]

  // Calcular NPS para cada tipo
  const calcularNPS = (registros: any[]): NPSData => {
    const total = registros.length

    if (total === 0) {
      return { promotores: 0, neutros: 0, detratores: 0, total: 0, nps: 0 }
    }

    const promotores = registros.filter(r => {
      const classificacao = String(r[2] || '').toLowerCase()
      return classificacao.includes('promotor')
    }).length

    const neutros = registros.filter(r => {
      const classificacao = String(r[2] || '').toLowerCase()
      return classificacao.includes('neutro') || classificacao.includes('passivo')
    }).length

    const detratores = registros.filter(r => {
      const classificacao = String(r[2] || '').toLowerCase()
      return classificacao.includes('detrator')
    }).length

    // Fórmula NPS: % Promotores - % Detratores
    const nps = ((promotores / total) * 100) - ((detratores / total) * 100)

    return {
      promotores,
      neutros,
      detratores,
      total,
      nps: Math.round(nps) // Arredonda para número inteiro
    }
  }

  return {
    profissionais: calcularNPS(profissionais),
    atendimento: calcularNPS(atendimento),
    unidade: calcularNPS(unidadeRecords) // Total = Profissionais + Atendimento
  }
}

/**
 * Busca NPS detalhado por profissional usando Report 21
 * Calcula NPS individual de cada profissional
 *
 * Tipos considerados:
 * - "Profissional" = avaliação do terapeuta
 * - "Atendimento" = avaliação do terapeuta (em algumas unidades)
 * - "Venda" = avaliação da recepção (não incluído aqui)
 */
// ─── Detratores & Neutros individuais (para a coordenadora entrar em contato) ────
export interface AvaliacaoNPS {
  idAtendimento: string // ID do atendimento no Belle (identifica o caso)
  data: string          // data da avaliação (como vem do Belle)
  cliente: string
  classificacao: string // "Detrator" | "Neutro"
  nota: number | null   // 0..10
  comentario: string
  profissional: string
  servicos: string
  tipo: string          // Profissional | Atendimento | Venda...
}

/**
 * Lista as avaliações de NPS que são DETRATORAS ou NEUTRAS no período — cada uma
 * com nome do cliente e o comentário, para a coordenadora tratar (ligar/contatar).
 * Detratores primeiro; depois por data (mais recentes no topo).
 */
export interface ResumoDetratoresNeutros {
  total: number // total de respostas de NPS no período (todas as classificações)
  avaliacoes: AvaliacaoNPS[] // só detratores + neutros
}

export async function getDetratoresNeutros(
  email: string,
  senha: string,
  dataIni: string,
  dataFim: string,
  estab: number,
): Promise<ResumoDetratoresNeutros> {
  // Estrutura: [Data, Cliente, Classificação, Tipo NPS, Nota, Descrição, ID Atend., Profissional, Serviços]
  const records = await buscarRelatorioNPS(email, senha, dataIni, dataFim, estab)

  const alvo = records.filter((r: any[]) => {
    const c = String(r[2] || '').toLowerCase()
    return c.includes('detrator') || c.includes('neutro') || c.includes('passivo')
  })

  const lista: AvaliacaoNPS[] = alvo.map((r: any[]) => {
    const notaRaw = String(r[4] ?? '').replace(',', '.')
    const nota = notaRaw.trim() === '' ? null : Number(notaRaw)
    return {
      idAtendimento: String(r[6] ?? '').trim(),
      data: String(r[0] || ''),
      cliente: String(r[1] || '').trim().replace(/^\d+\s*-\s*/, ''), // remove prefixo de ID
      classificacao: String(r[2] || '').trim(),
      nota: Number.isFinite(nota as number) ? (nota as number) : null,
      comentario: String(r[5] || '').trim(),
      profissional: String(r[7] || '').trim(),
      servicos: String(r[8] || '').trim(),
      tipo: String(r[3] || '').trim(),
    }
  })

  // Detrator antes de neutro; dentro do grupo, mais recente primeiro.
  const peso = (c: string) => (c.toLowerCase().includes('detrator') ? 0 : 1)
  lista.sort((a, b) => {
    const p = peso(a.classificacao) - peso(b.classificacao)
    if (p !== 0) return p
    return b.data.localeCompare(a.data)
  })
  return { total: records.length, avaliacoes: lista }
}

export async function getNPSPorProfissional(
  email: string,
  senha: string,
  dataIni: string,
  dataFim: string,
  estab: number
): Promise<NPSPorProfissional[]> {
  // Estrutura: [Data, Cliente, Classificação, Tipo NPS, Nota, Descrição, ID Atend., Profissional, Serviços]
  // Índices:    [0]   [1]      [2]            [3]       [4]   [5]         [6]         [7]           [8]
  const records = await buscarRelatorioNPS(email, senha, dataIni, dataFim, estab)

  // Filtrar avaliações de terapeutas (tipo "Profissional" OU "Atendimento")
  const avaliacoesProfissionais = records.filter((r: any[]) => {
    const tipo = String(r[3] || '').toLowerCase()
    return tipo.includes('profissional') || tipo.includes('atendimento')
  })

  // Agrupar por profissional
  const profissionaisMap = new Map<string, any[]>()

  for (const record of avaliacoesProfissionais) {
    const nomeProfissional = String(record[7] || '').trim()
    if (!nomeProfissional) continue

    if (!profissionaisMap.has(nomeProfissional)) {
      profissionaisMap.set(nomeProfissional, [])
    }
    profissionaisMap.get(nomeProfissional)!.push(record)
  }

  // Calcular NPS para cada profissional
  const resultado: NPSPorProfissional[] = []

  for (const [nomeProfissional, avaliacoes] of profissionaisMap.entries()) {
    const total = avaliacoes.length

    const promotores = avaliacoes.filter(r => {
      const classificacao = String(r[2] || '').toLowerCase()
      return classificacao.includes('promotor')
    }).length

    const neutros = avaliacoes.filter(r => {
      const classificacao = String(r[2] || '').toLowerCase()
      return classificacao.includes('neutro') || classificacao.includes('passivo')
    }).length

    const detratores = avaliacoes.filter(r => {
      const classificacao = String(r[2] || '').toLowerCase()
      return classificacao.includes('detrator')
    }).length

    // Fórmula NPS: (Promotores - Detratores) / Total * 100
    const nps = total > 0 ? ((promotores - detratores) / total) * 100 : 0

    resultado.push({
      profissional: nomeProfissional,
      promotores,
      neutros,
      detratores,
      total,
      nps: Math.round(nps)
    })
  }

  return resultado
}
