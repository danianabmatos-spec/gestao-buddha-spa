import { getToken, invalidarToken, HEADERS, BASE_URL } from './client-auth'

export interface TerapeutaFidelizacao {
  profissional: string
  horasAtendimento: number
  percServicosFidelizados: number
  nps: number
}

/**
 * Busca relatório de Fidelização do Belle (Report ID: 192)
 * Retorna lista de profissionais com horas de atendimento e % de serviços de clientes fidelizados
 */
export async function getTerapeutasFidelizacao(
  email: string,
  senha: string,
  dataIni: string, // "2026-06-01"
  dataFim: string, // "2026-06-30"
  estab: number
): Promise<TerapeutaFidelizacao[]> {
  let token = await getToken(email, senha)

  // Converte datas para ISO format
  const dataIniISO = new Date(dataIni + 'T03:00:00.000Z').toISOString()
  const dataFimISO = new Date(dataFim + 'T03:00:00.000Z').toISOString()

  const payload = {
    reportId: 192, // [Buddha] Relatório de Fidelização
    sortColumn: null,
    sortOrder: 1,
    estab: String(estab),
    filters: [
      { id: '2', value: '' }, // Profissional Contém (vazio = todos)
      { id: '1', value: dataIniISO },
      { id: '1', value2: dataFimISO },
      { id: '1', range: false }
    ],
    ignoreRecords: false
  }

  const chamar = (tk: string) => fetch(
    `${BASE_URL}/BI/v1.0/report/build?estabGeral=${estab}`,
    { method: 'POST', headers: { ...HEADERS, Authorization: tk }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90_000) }
  )

  // Belle às vezes invalida o token no meio (ex.: conta compartilhada da Higienópolis) →
  // no 401, re-autentica forçado e tenta de novo uma vez.
  let resp = await chamar(token)
  if (resp.status === 401) {
    invalidarToken(email)
    token = await getToken(email, senha, true)
    resp = await chamar(token)
  }

  if (!resp.ok) {
    throw new Error(`Belle relatório fidelização failed: ${resp.status}`)
  }

  const data = await resp.json()

  // Parseia os dados do relatório
  // Estrutura do array:
  // [0]=Profissional, [1]=Qtd. Clientes Novos, [2]=% Atend. Novos Clientes,
  // [3]=Horas Atend., [4]=Qtd. Serviços, [5]=Qtd. Clientes,
  // [6]=% Fidelização Clientes, [7]=% Fidelização Novos Clientes,
  // [8]=% Serviços Clientes Fidelizados, [9-12]=Vendas, [13]=Estabelecimento
  const terapeutas: TerapeutaFidelizacao[] = []

  const records = data.data || []

  for (const record of records) {
    if (!Array.isArray(record)) continue

    const profissional = String(record[0] || '').trim()

    // Exclui "Recepção" e "Administrador" da lista de profissionais
    if (profissional.toLowerCase().includes('recepção') ||
        profissional.toLowerCase().includes('recepcao') ||
        profissional.toLowerCase().includes('administrador')) {
      continue
    }

    const horasAtendimento = parseFloat(String(record[3] || '0').replace(',', '.'))
    const percServicosFidelizados = parseFloat(String(record[8] || '0').replace(',', '.'))

    terapeutas.push({
      profissional,
      horasAtendimento,
      percServicosFidelizados,
      nps: 0
    })
  }

  return terapeutas
}
