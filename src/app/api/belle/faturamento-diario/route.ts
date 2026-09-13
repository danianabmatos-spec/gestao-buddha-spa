import { NextRequest, NextResponse } from 'next/server'
import { getCaixaDiario } from '@/lib/belle/caixa-diario'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const unidade = searchParams.get('unidade')
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')

    if (!unidade || !dataIni || !dataFim) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: unidade, dataIni, dataFim' }, { status: 400 })
    }
    if (!getUnidadeCredenciais(unidade)) {
      return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    }

    const dados = await getCaixaDiario(unidade, dataIni, dataFim)
    return NextResponse.json({ success: true, dados })
  } catch (error: any) {
    console.error('[Faturamento Diário] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao buscar faturamento diário' }, { status: 500 })
  }
}
