import { NextRequest, NextResponse } from 'next/server'
import { getVendasRecepcao } from '@/lib/belle/bi'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const unidade = searchParams.get('unidade')
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')

    if (!unidade || !dataIni || !dataFim) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: unidade, dataIni, dataFim' },
        { status: 400 }
      )
    }

    const credenciais = getUnidadeCredenciais(unidade)
    if (!credenciais) {
      return NextResponse.json(
        { error: 'Unidade não encontrada' },
        { status: 404 }
      )
    }

    const vendas = await getVendasRecepcao(
      credenciais.email,
      credenciais.password,
      String(credenciais.estab),
      dataIni,
      dataFim
    )

    return NextResponse.json(vendas)
  } catch (error: any) {
    console.error('[Vendas Recepção] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar vendas da recepção' },
      { status: 500 }
    )
  }
}
