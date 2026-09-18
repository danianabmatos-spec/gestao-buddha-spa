import { getToken, HEADERS, BASE_URL } from './client-auth'

// Busca os atendimentos realizados (report de comissão dos técnicos) direto do Belle.
// Réplica do que o app Folha faz — pra o gestao ser autossuficiente. O belleId é o
// MESMO ID do Belle (col do ID do atendimento), então casa com o lote enviado ao Folha.

export interface AtendimentoBelle {
  belleId: string
  profissionalNome: string
  data: string // YYYY-MM-DD
  servico: string
  valorServico: number
  comissaoR: number
  clienteNome?: string
  sintetico?: boolean
}

// Remove o código na frente do nome do serviço (ex.: "1818-Relaxante Buddha Spa 50").
function limparServico(v: unknown): string {
  return String(v ?? '').replace(/^\s*\d+\s*-\s*/, '').trim()
}

function normData(v: unknown): string {
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s.slice(0, 10)
}

async function descobrirReportIds(token: string, estab: number): Promise<{ detalhado: number | null; resumido: number | null }> {
  try {
    const resp = await fetch(`${BASE_URL}/BI/v1.0/report?estabGeral=${estab}`, {
      headers: { ...HEADERS, Authorization: token },
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) return { detalhado: null, resumido: null }
    const lista: { id: number; title: string }[] = await resp.json()
    const detalhado = lista.find((r) => /comiss[aã]o.*t[eé]cnicos.*detalhado/i.test(r.title))
    const resumido = lista.find((r) => /comiss[aã]o.*t[eé]cnicos/i.test(r.title) && !/detalhado/i.test(r.title))
    return { detalhado: detalhado?.id ?? null, resumido: resumido?.id ?? null }
  } catch {
    return { detalhado: null, resumido: null }
  }
}

export async function buscarAtendimentosBelle(
  email: string,
  senha: string,
  estab: number,
  dataIni: string,
  dataFim: string,
): Promise<AtendimentoBelle[]> {
  const token = await getToken(email, senha)
  const { detalhado: idDetalhado, resumido: idResumido } = await descobrirReportIds(token, estab)

  async function buildReport(reportId: number, offset = 0) {
    const payload: Record<string, unknown> = {
      reportId,
      sortColumn: null,
      sortOrder: 1,
      estab: String(estab),
      ignoreRecords: false,
      filters: [{
        id: 1,
        field: { type_id: 'data', description: 'Período' },
        operator: { allow_multiple_values: true, description: 'Entre', id: null },
        value: dataIni,
        value2: dataFim,
      }],
    }
    if (offset > 0) payload.offsetRecords = offset

    const resp = await fetch(`${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    })
    if (!resp.ok) throw new Error(`Belle comissões falhou: ${resp.status}`)
    return resp.json() as Promise<{ data: unknown[][]; record_count: number }>
  }

  async function fetchTodas(reportId: number): Promise<unknown[][]> {
    const primeira = await buildReport(reportId, 0)
    const total = primeira.record_count ?? 0
    let todas: unknown[][] = primeira.data ?? []
    while (todas.length < total) {
      const pag = await buildReport(reportId, todas.length)
      const novos = pag.data ?? []
      if (!novos.length) break
      todas = todas.concat(novos)
    }
    return todas
  }

  // Report detalhado: [0]=Profissional, [3]=ID Atendimento, [4]=Data, [5]=Cliente "ID-Nome",
  // [6]=Serviço, [7]=Valor, [9]=ValorBase, [11]=Comissão R$.
  if (idDetalhado) {
    const linhas = await fetchTodas(idDetalhado)
    if (linhas.length > 0) {
      const mapped = linhas
        .filter((row) => String(row[6] ?? '').trim().toUpperCase() !== 'TOTAL')
        .map((row) => {
          const clienteRaw = String(row[5] ?? '')
          const clientePrimeiro = clienteRaw.includes('-')
            ? clienteRaw.split('-').slice(1).join('-').trim().split(' ')[0]
            : clienteRaw.split(' ')[0]
          return {
            belleId: String(row[3]),
            profissionalNome: String(row[0] ?? ''),
            data: normData(row[4]),
            servico: limparServico(row[6]),
            valorServico: parseFloat(String(row[7] ?? '0')) || 0,
            comissaoR: Number(row[11] ?? 0),
            clienteNome: clientePrimeiro || undefined,
          } as AtendimentoBelle
        })

      // Agrega belleIds repetidos (Day Spa = mesmo booking, vários serviços).
      const byBelleId = new Map<string, AtendimentoBelle>()
      for (const at of mapped) {
        const ex = byBelleId.get(at.belleId)
        if (ex) { ex.comissaoR += at.comissaoR; ex.valorServico += at.valorServico }
        else byBelleId.set(at.belleId, { ...at })
      }
      return Array.from(byBelleId.values())
    }
  }

  // Fallback: report resumido (sem cliente e sem ID real → belleId sintético estável).
  if (!idResumido) return []
  const resumidas = await fetchTodas(idResumido)

  function belleIdSintetico(profissional: string, servico: string): string {
    const base = `${profissional}|${servico}|${dataIni.slice(0, 7)}`
    let h = 0
    for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0
    return `r_${Math.abs(h).toString(36)}_${base.length}`
  }

  return resumidas
    .filter((row) => String(row[2] ?? '').trim().toUpperCase() !== 'TOTAL')
    .map((row) => {
      const profissionalNome = String(row[0] ?? '')
      const servico = limparServico(row[2])
      const qtd = Number(row[3] ?? 1) || 1
      return {
        belleId: belleIdSintetico(profissionalNome, servico),
        profissionalNome,
        data: dataIni,
        servico,
        valorServico: (parseFloat(String(row[4] ?? '0')) || 0) * qtd,
        comissaoR: Number(row[9] ?? 0),
        sintetico: true,
      } as AtendimentoBelle
    })
}
