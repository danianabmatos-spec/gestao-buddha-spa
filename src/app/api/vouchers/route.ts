import { NextRequest } from 'next/server'
import { format, startOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const hoje = new Date()
  const dataIni = searchParams.get('dataIni') ?? format(startOfMonth(hoje), 'yyyy-MM-dd')
  const dataFim = searchParams.get('dataFim') ?? format(hoje, 'yyyy-MM-dd')

  // Tenta o cache primeiro
  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
  try {
    const cacheResp = await fetch(`${baseUrl}/api/vouchers/sync?dataIni=${dataIni}&dataFim=${dataFim}`)
    if (cacheResp.ok) {
      return Response.json(await cacheResp.json())
    }
  } catch {
    // sem cache — retorna estrutura vazia com instrução de sync
  }

  // Sem cache — retorna estrutura vazia com link para sincronizar
  return Response.json({
    periodo: { ini: dataIni, fim: dataFim },
    totalReembolso: 0,
    totalValidados: 0,
    pendentesValidacao: 0,
    validacaoManual: 0,
    validacaoAutomatica: 0,
    vouchers: [],
    syncRequired: true,
    message: 'Clique em "Sincronizar" para carregar os vouchers do site.',
  })
}
