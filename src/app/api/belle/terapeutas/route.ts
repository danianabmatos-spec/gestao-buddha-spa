import { NextRequest, NextResponse } from 'next/server'
import { getTerapeutasFidelizacao } from '@/lib/belle/relatorio-fidelizacao'
import { getNPSPorProfissional } from '@/lib/belle/relatorio-nps'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const unidade = searchParams.get('unidade') || 'shopping-metropole'
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')

    if (!dataIni || !dataFim) {
      return NextResponse.json(
        { error: 'Parâmetros dataIni e dataFim são obrigatórios' },
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

    const email = credenciais.email
    const senha = credenciais.password
    const estab = credenciais.estab

    // Busca dados de fidelização e NPS em paralelo
    const [terapeutasFidelizacao, npsData] = await Promise.all([
      getTerapeutasFidelizacao(email, senha, dataIni, dataFim, estab),
      getNPSPorProfissional(email, senha, dataIni, dataFim, estab)
    ])

    // Mescla os dados de NPS com fidelização
    const terapeutas = terapeutasFidelizacao.map(t => {
      const npsProf = npsData.find(n => n.profissional === t.profissional)
      return {
        ...t,
        nps: npsProf?.nps || 0
      }
    })

    return NextResponse.json(terapeutas)
  } catch (error) {
    console.error('Erro ao buscar terapeutas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados dos terapeutas' },
      { status: 500 }
    )
  }
}
