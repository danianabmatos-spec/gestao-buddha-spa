import { NextRequest } from 'next/server'
import { getMetaMes } from '@/config/metas'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mesParam = searchParams.get('mes')

  let mes = new Date().getMonth() + 1
  let ano = new Date().getFullYear()

  if (mesParam) {
    const [a, m] = mesParam.split('-').map(Number)
    ano = a
    mes = m
  }

  const meta = getMetaMes(mes)

  return Response.json({
    ano,
    mes,
    metaFaturamento: meta.faturamento,
    metaHoras: meta.horas,
    metaVendas: meta.vendas,
  })
}
