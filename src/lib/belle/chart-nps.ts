import { getToken, HEADERS, BASE_URL } from './client-auth'

export interface NPSProfissional {
  profissional: string
  percTotal: number // % Total de NPS
}

/**
 * Busca gráfico Detalhamento NPS Profissional do Belle (Chart ID: 241234431)
 * Retorna % Total de NPS por profissional
 */
export async function getNPSProfissionais(
  email: string,
  senha: string,
  dataIni: string, // "2026-06-01"
  dataFim: string, // "2026-06-30"
  estab: number
): Promise<NPSProfissional[]> {
  const token = await getToken(email, senha)

  // Converte datas para formato YYYY-MM-DD (já está nesse formato)
  const payload = {
    id: 241234431,
    title: 'Detalhamento NPS Profissional',
    type: 13,
    name: 'detalhamento_nps_profissional',
    built_in: '1',
    profile: 'main',
    export: 1,
    favorite: null,
    ignoreRecords: false,
    estab: String(estab),
    filters: [
      {
        id: 1,
        field: { type_id: 'data', description: 'Período' },
        operator: { allow_multiple_values: true, description: 'Entre', id: null },
        value: dataIni,
        value2: dataFim
      },
      {
        id: 3,
        field: { type_id: 'inteiro', description: 'Nota' },
        operator: { allow_multiple_values: true, description: 'Entre', id: null },
        value: 0,
        value2: 10
      }
    ]
  }

  const resp = await fetch(
    `${BASE_URL}/BI/v1.0/chart/build?estabGeral=${estab}`,
    {
      method: 'POST',
      headers: { ...HEADERS, Authorization: token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000)
    }
  )

  if (!resp.ok) {
    throw new Error(`Belle chart NPS failed: ${resp.status}`)
  }

  const data = await resp.json()

  // Extrai dados do chart
  // A resposta tem: data.chart.struct.data.rows[]
  // Cada row é um objeto com: prof, pctTotal, etc.
  const npsProfissionais: NPSProfissional[] = []

  const rows = data?.data?.chart?.struct?.data?.rows || []

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue

    const profissional = String(row.prof || '')
    const percTotal = parseFloat(String(row.pctTotal || '0').replace(',', '.'))

    npsProfissionais.push({
      profissional,
      percTotal
    })
  }

  return npsProfissionais
}
