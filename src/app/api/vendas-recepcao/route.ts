import { NextRequest, NextResponse } from 'next/server'
import { getVendasRecepcao } from '@/lib/belle/bi'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export const maxDuration = 60 // Timeout de 60 segundos

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

    console.log(`[Vendas Recepção] Buscando dados para ${credenciais.nome} (${dataIni} a ${dataFim})`)

    const vendas = await getVendasRecepcao(
      credenciais.email,
      credenciais.password,
      String(credenciais.estab),
      dataIni,
      dataFim
    )

    console.log(`[Vendas Recepção] ✓ Dados obtidos: ${vendas.total.quantidade} vendas, R$ ${vendas.total.valorLiquido}`)

    return NextResponse.json({
      success: true,
      unidade: credenciais.nome,
      periodo: { dataIni, dataFim },
      vendas,
    })
  } catch (error: any) {
    console.error('[Vendas Recepção] ✗ Erro:', error.message)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar vendas' },
      { status: 500 }
    )
  }
}
