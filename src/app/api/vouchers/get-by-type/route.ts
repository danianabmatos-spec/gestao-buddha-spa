import { NextRequest } from 'next/server'
import { getVoucherCacheByType } from '@/lib/cache-vouchers-multi'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tipo = searchParams.get('tipo') as 'site' | 'omnichannel' | 'cortesia'
  const dataIni = searchParams.get('dataIni') || '2026-05-01'
  const dataFim = searchParams.get('dataFim') || '2026-05-31'

  if (!tipo || !['site', 'omnichannel', 'cortesia'].includes(tipo)) {
    return Response.json({ error: 'Tipo inválido. Use: site, omnichannel ou cortesia' }, { status: 400 })
  }

  const cached = getVoucherCacheByType(tipo, dataIni, dataFim)

  if (!cached) {
    return Response.json({
      periodo: { ini: dataIni, fim: dataFim },
      totalReembolso: 0,
      totalValidados: 0,
      pendentesValidacao: 0,
      validacaoManual: 0,
      validacaoAutomatica: 0,
      vouchers: [],
    })
  }

  return Response.json({
    periodo: { ini: dataIni, fim: dataFim },
    ...cached,
  })
}
