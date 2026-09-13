import { getToken, HEADERS, BASE_URL } from '../belle/client-auth'

export interface ClienteBelle {
  clienteId:     number | null
  nome:          string
  telefone:      string | null
  email:         string | null
  dataCadastro:  Date | null
  primeiraSessao: Date | null
  ultimaSessao:  Date | null
  totalSessoes:  number
}

export interface PlanoBelle {
  clienteId:     number | null   // parseado de "ID-Nome"
  nomeCliente:   string          // parseado de "ID-Nome"
  nomePlano:     string
  status:        string          // "Aprovado" etc.
  dataVenda:     Date | null
  validade:      Date | null
  sessoesRestantes: number       // só de planos UTILIZÁVEIS (exclui suspensos)
  sessoesVendidas:  number
  temPlanoAtivo: boolean         // ao menos 1 plano UTILIZÁVEL com sessão sobrando E validade futura
  temPlanoSuspenso: boolean      // ao menos 1 plano SUSPENSO no Belle (não utilizável — caso delicado)
}

function parseData(val: unknown): Date | null {
  if (!val || val === '') return null
  const d = new Date(String(val))
  return isNaN(d.getTime()) ? null : d
}

function parseTelefone(tel: unknown, cel: unknown): string | null {
  const t = String(tel || '').replace(/\D/g, '')
  const c = String(cel || '').replace(/\D/g, '')
  const num = c.length >= 10 ? c : t.length >= 10 ? t : ''
  return num.length >= 10 ? num : null
}

// Extrai { id, nome } de "123456-Nome Completo"
function parseIdNome(raw: unknown): { id: number | null; nome: string } {
  const s = String(raw || '').trim()
  if (!s.includes('-')) return { id: null, nome: s }
  const idPart = s.split('-')[0].trim()
  const id = /^\d+$/.test(idPart) ? parseInt(idPart, 10) : null
  const nome = s.split('-').slice(1).join('-').trim()
  return { id, nome }
}

// ─────────────────────────────────────────────────────────────
// Report 194 — "[Buddha] Clientes"
// col[0]=ID [1]=Nome [10]=Tel [11]=Cel [13]=Email
// col[14]=DataCadastro [15]=PrimeiroAtendimento [16]=ÚltimoAtendimento [17]=QtdAtendimentos
//
// Duas consultas para cobrir todos os grupos:
//   A) Cadastro nos últimos 30 dias  → grupo NOVO
//   B) Último atendimento no último ano → EM_RISCO, PERDIDO, FREQUENTE, ATIVO
// ─────────────────────────────────────────────────────────────

export async function getClientesBelle(
  email: string,
  senha: string,
  estab: string,
  idFiltroCadastro: number,    // id do filtro data_cadastro no Report 194 desta conta
  idFiltroUltAtend: number,    // id do filtro dt_ult_atendimento_cobr no Report 194
): Promise<ClienteBelle[]> {
  const token = await getToken(email, senha)

  const hoje = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const menos = (dias: number) => { const d = new Date(hoje); d.setDate(d.getDate() - dias); return iso(d) }

  async function fetchPagina(filters: unknown[], offset: number): Promise<{ rows: unknown[][]; total: number }> {
    const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify({
        reportId: 194, sortColumn: null, sortOrder: 1, estab,
        ignoreRecords: false, offsetRecords: offset, maxRecords: 500,
        filters,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!resp.ok) return { rows: [], total: 0 }
    const data = await resp.json()
    return { rows: data.data || [], total: data.record_count ?? 0 }
  }

  // Paginação paralela: busca 1ª página para obter total, depois paraleliza o restante em lotes de 5
  async function paginar(filters: unknown[]): Promise<unknown[][]> {
    const { rows: firstPage, total } = await fetchPagina(filters, 0)
    if (firstPage.length === 0 || total <= firstPage.length) return firstPage

    const pageSize = firstPage.length  // Belle determina o tamanho real da página
    const offsets: number[] = []
    for (let o = pageSize; o < total; o += pageSize) offsets.push(o)

    const BATCH = 5  // máximo de requisições concorrentes por rodada
    const restPages: unknown[][] = []
    for (let i = 0; i < offsets.length; i += BATCH) {
      const batch = offsets.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(o => fetchPagina(filters, o)))
      for (const { rows } of results) restPages.push(...rows)
    }
    return [...firstPage, ...restPages]
  }

  // Blindagem: os filtros NATIVOS do relatório podem vir com defaults ruins salvos por
  // unidade (ex.: data_cadastro = HOJE na conta do Shopping Anália → zerava a base toda).
  // Buscamos os filtros do próprio relatório e reenviamos SÓ o campo-alvo ativo, com os
  // demais "desconsiderados" (ignore_range:true + value limpo) — exatamente como a tela
  // do Belle faz ao marcar "Desconsiderar". Isso anula qualquer default salvo e é
  // account-agnostic (não depende mais dos ids de filtro por conta).
  async function filtrosBase(): Promise<Record<string, unknown>[]> {
    try {
      const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
        method: 'POST',
        headers: { ...HEADERS, Authorization: token },
        body: JSON.stringify({ reportId: 194, sortColumn: null, sortOrder: 1, estab, ignoreRecords: false, offsetRecords: 0, maxRecords: 1, filters: [] }),
        signal: AbortSignal.timeout(90_000),
      })
      if (!resp.ok) return []
      const data = await resp.json()
      return Array.isArray(data.filters) ? (data.filters as Record<string, unknown>[]) : []
    } catch { return [] }
  }

  const OP_BETWEEN = { id: 'BETWEEN_OPT', alias: 'BETWEEN', description: 'Entre (Opcional)', allow_multiple_values: '1' }
  // Monta o array: o campo-alvo ATIVO com o range; todos os outros desconsiderados.
  // Fallback (se os filtros nativos não vierem): filtro simples com o id da conta (antigo).
  function montar(base: Record<string, unknown>[], alvo: string, value: string, value2: string, idFallback: number): unknown[] {
    if (base.length === 0) {
      return [{ id: idFallback, field_id: alvo, operator: OP_BETWEEN, value, value2 }]
    }
    return base.map((f) =>
      f.field_id === alvo
        ? { ...f, ignore_range: false, value, value2, value_origin: 'fixed', value2_origin: 'fixed' }
        : { ...f, ignore_range: true, value: '', value2: '', value_origin: 'fixed', value2_origin: 'fixed' },
    )
  }

  const base = await filtrosBase()

  // Consulta A: Novos cadastros (últimos 30 dias)
  const rowsNovos = await paginar(montar(base, 'paciente.data_cadastro', menos(30), iso(hoje), idFiltroCadastro))

  // Consulta B: Clientes com atendimento nos últimos 180 dias (EM_RISCO, PERDIDO, FREQUENTE)
  // 180 dias cobre ATIVO (<60d), EM_RISCO (60-90d), PERDIDO acionável (90-180d)
  const rowsAtivos = await paginar(montar(base, 'paciente.dt_ult_atendimento_cobr', menos(180), iso(hoje), idFiltroUltAtend))

  // Merge e deduplicação pelo ID do cliente
  const mapa = new Map<string, unknown[]>()
  const chave = (row: unknown[]) => {
    const id = row[0]
    return id ? String(id) : String(row[1] || '').trim().toLowerCase()
  }
  for (const row of [...rowsNovos, ...rowsAtivos]) mapa.set(chave(row), row)

  return Array.from(mapa.values())
    .filter((row) => {
      const nome = String(row[1] || '').trim()
      return nome.length > 2 && nome.toLowerCase() !== 'cliente teste'
    })
    .map((row) => ({
      clienteId:      typeof row[0] === 'number' ? row[0] : null,
      nome:           String(row[1] || '').trim(),
      telefone:       parseTelefone(row[10], row[11]),
      email:          row[13] ? String(row[13]).trim() || null : null,
      dataCadastro:   parseData(row[14]),
      primeiraSessao: parseData(row[15]),
      ultimaSessao:   parseData(row[16]),
      totalSessoes:   typeof row[17] === 'number' ? row[17] : parseInt(String(row[17] || '0')) || 0,
    }))
}

// ─────────────────────────────────────────────────────────────
// Saldo REAL de um plano — mesma fonte da tela "Saldo do Plano" do Belle
// (endpoint Plano/v1.0/saldovendaplano, parâmetros em HEADERS).
// Por quê: a coluna "Sessões Restantes" (col[12]) do Report 196 SUBESTIMA o saldo —
// ela não devolve sessões de agendamentos cancelados/remarcados, contando-as como
// usadas. Este endpoint devolve o saldo utilizável por serviço; somamos `saldo_atual`.
// Retorna null em qualquer falha (o chamador cai no fallback = col[12]).
async function getSaldoRealVendaPlano(
  token: string,
  estab: string,
  codorc: string | number,
): Promise<number | null> {
  try {
    const resp = await fetch(`${BASE_URL}/Plano/v1.0/saldovendaplano?estabGeral=${estab}`, {
      headers: { ...HEADERS, Authorization: token, codorc: String(codorc), total: '1' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!resp.ok) return null
    const rows: unknown = await resp.json()
    if (!Array.isArray(rows)) return null
    return rows.reduce((soma: number, r) => {
      const v = parseInt(String((r as Record<string, unknown>)?.saldo_atual ?? '0')) || 0
      return soma + v
    }, 0)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Report 196 — "[Buddha] Relatório de Sessões de Planos" (todas as unidades)
// col[0]=IDPlano [1]=NomePlano [2]=Cliente("ID-Nome") [3]=Status
// col[4]=DataVenda [5]=Validade [11]=SessoesVendidas [12]=SessoesRestantes [14]=Estabelecimento
// Cada plano pode ter N linhas (uma por tipo de serviço)
// Filtros: id=1 (Período: 5 anos vendas) + id=2 (Validade: -5 a +5 anos)
// Obs.: col[12] é subestimada (ver getSaldoRealVendaPlano) — para planos utilizáveis
// buscamos o saldo real por plano e usamos ele no lugar da coluna.
// ─────────────────────────────────────────────────────────────
export async function getPlanosClientes(
  email: string,
  senha: string,
  estab: string,
  reportIdPlanos: number,
): Promise<PlanoBelle[]> {
  const token = await getToken(email, senha)

  const hoje = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const cincoAnosAtras = new Date(hoje); cincoAnosAtras.setFullYear(hoje.getFullYear() - 5)
  const cincoAnosFuturo = new Date(hoje); cincoAnosFuturo.setFullYear(hoje.getFullYear() + 5)

  const filters = [
    {
      id: 1,
      operator: { id: 'BETWEEN', alias: 'BETWEEN', description: 'Entre', allow_multiple_values: '1' },
      value: iso(cincoAnosAtras), value2: iso(hoje),
    },
    {
      id: 2,
      operator: { id: 'BETWEEN', alias: 'BETWEEN', description: 'Entre', allow_multiple_values: '1' },
      value: iso(cincoAnosAtras), value2: iso(cincoAnosFuturo),
    },
  ]

  async function fetchPaginaPlanos(offset: number): Promise<{ rows: unknown[][]; total: number }> {
    const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify({
        reportId: reportIdPlanos, sortColumn: null, sortOrder: 1, estab,
        ignoreRecords: false, offsetRecords: offset, maxRecords: 500,
        filters,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!resp.ok) return { rows: [], total: 0 }
    const data = await resp.json()
    return { rows: data.data || [], total: data.record_count ?? 0 }
  }

  const { rows: firstPage, total } = await fetchPaginaPlanos(0)
  const allRows: unknown[][] = [...firstPage]

  if (firstPage.length > 0 && total > firstPage.length) {
    const pageSize = firstPage.length
    const offsets: number[] = []
    for (let o = pageSize; o < total; o += pageSize) offsets.push(o)
    const BATCH = 5
    for (let i = 0; i < offsets.length; i += BATCH) {
      const results = await Promise.all(offsets.slice(i, i + BATCH).map(o => fetchPaginaPlanos(o)))
      for (const { rows } of results) allRows.push(...rows)
    }
  }

  // Agrupa por cliente (chave = ID quando existe, senão nome): soma sessões,
  // mantém a validade mais recente e marca se há QUALQUER plano ativo de fato.
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0)
  const mapa = new Map<string, PlanoBelle>()

  // Saldo real por plano (só para planos UTILIZÁVEIS: não cancelado, não suspenso,
  // validade futura). Substitui col[12] do Report 196, que subestima. Fallback = col[12].
  const saldoRealPorPlano = new Map<string, number>()
  const planosUtilizaveis = allRows.filter((row) => {
    const st = String(row[3] || '').toLowerCase()
    if (st.includes('cancelado') || st.includes('suspens')) return false
    if (row[0] == null) return false
    const val = parseData(row[5])
    return !!val && val >= hoje0
  })
  // Dedup por codorc: um plano multi-serviço tem N linhas com o MESMO codorc —
  // basta 1 chamada de saldo por plano (evita N-1 requisições redundantes ao Belle).
  const codorcsUtilizaveis = [...new Set(planosUtilizaveis.map((row) => String(row[0])))]
  const BATCH_SALDO = 5
  for (let i = 0; i < codorcsUtilizaveis.length; i += BATCH_SALDO) {
    const slice = codorcsUtilizaveis.slice(i, i + BATCH_SALDO)
    const saldos = await Promise.all(slice.map((codorc) => getSaldoRealVendaPlano(token, estab, codorc)))
    slice.forEach((codorc, k) => { if (saldos[k] != null) saldoRealPorPlano.set(codorc, saldos[k] as number) })
  }
  // O saldo real é por PLANO inteiro; garante que ele conte 1× por codorc mesmo
  // quando o Report 196 traz N linhas por plano (uma por serviço).
  const saldoRealAplicado = new Set<string>()

  for (const row of allRows) {
    const status = String(row[3] || '').toLowerCase()
    // Exclui apenas cancelados — inclui aprovados, vencidos e qualquer outro status
    if (status.includes('cancelado')) continue

    const { id: clienteId, nome: nomeCliente } = parseIdNome(row[2])
    if (!nomeCliente) continue

    const sessoesVendidas  = parseInt(String(row[11] || '0')) || 0
    const sessoesRaw       = parseInt(String(row[12] || '0')) || 0
    // Saldo real (saldovendaplano) quando disponível; senão fallback = col[12].
    const codorc           = row[0] != null ? String(row[0]) : ''
    const saldoReal        = codorc !== '' ? saldoRealPorPlano.get(codorc) : undefined
    const validadeRaw      = parseData(row[5])
    const nomePlano        = String(row[1] || '').trim()
    // Suspenso no Belle = NÃO utilizável: não conta sessão, não conta como ativo,
    // não influencia a validade — mas marca a flag para sinalizar (caso delicado).
    const suspenso         = status.includes('suspens')
    // Restantes desta linha: suspenso → 0; com saldo real → conta o saldo do PLANO
    // 1× por codorc (Report 196 pode ter N linhas/plano); senão → fallback col[12].
    let sessoesRestantes: number
    if (suspenso) {
      sessoesRestantes = 0
    } else if (saldoReal != null) {
      sessoesRestantes = saldoRealAplicado.has(codorc) ? 0 : saldoReal
      saldoRealAplicado.add(codorc)
    } else {
      sessoesRestantes = sessoesRaw
    }
    const validade         = suspenso ? null : validadeRaw
    const planoAtivo       = !suspenso && sessoesRestantes > 0 && !!validadeRaw && validadeRaw >= hoje0
    const chave            = clienteId != null ? `id:${clienteId}` : `nome:${nomeCliente.toLowerCase()}`

    const existente = mapa.get(chave)
    if (existente) {
      existente.sessoesRestantes += sessoesRestantes
      existente.sessoesVendidas  += sessoesVendidas
      // mantém a validade mais recente (só de planos utilizáveis)
      if (validade && (!existente.validade || validade > existente.validade)) {
        existente.validade = validade
      }
      if (planoAtivo) existente.temPlanoAtivo = true
      if (suspenso) existente.temPlanoSuspenso = true
    } else {
      mapa.set(chave, {
        clienteId,
        nomeCliente,
        nomePlano,
        status: String(row[3] || ''),
        dataVenda: parseData(row[4]),
        validade,
        sessoesRestantes,
        sessoesVendidas,
        temPlanoAtivo: planoAtivo,
        temPlanoSuspenso: suspenso,
      })
    }
  }

  return Array.from(mapa.values())
}
