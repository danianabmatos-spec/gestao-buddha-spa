import { NextRequest, NextResponse } from 'next/server'
import { getTerapeutasFidelizacao } from '@/lib/belle/relatorio-fidelizacao'
import { getNPSPorProfissional } from '@/lib/belle/relatorio-nps'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getTerapeutasAtivosRH, normalizarNome } from '@/lib/rh/terapeutas-ativos'

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

    // Busca fidelização, NPS e a lista de terapeutas ativos do RH em paralelo
    const [terapeutasFidelizacao, npsData, ativosRH] = await Promise.all([
      getTerapeutasFidelizacao(email, senha, dataIni, dataFim, estab),
      getNPSPorProfissional(email, senha, dataIni, dataFim, estab),
      getTerapeutasAtivosRH(),
    ])

    // Mescla o NPS por nome NORMALIZADO (corrige mismatch de espaço/acento entre
    // Report 192 e Report 21, que zerava o NPS de alguns profissionais).
    const npsPorNome = new Map(npsData.map(n => [normalizarNome(n.profissional), n.nps]))
    let terapeutas = terapeutasFidelizacao.map(t => ({
      ...t,
      nps: npsPorNome.get(normalizarNome(t.profissional)) ?? 0,
    }))

    // Mantém APENAS terapeutas ativos conforme o RH (exclui coordenadoras, recepção,
    // banho de imersão e inativos). Fail-open: se o RH estiver indisponível (null),
    // não filtra — melhor mostrar tudo do que a tela vazia.
    if (ativosRH) {
      terapeutas = terapeutas.filter(t => ativosRH.has(normalizarNome(t.profissional)))
    }

    return NextResponse.json(terapeutas)
  } catch (error) {
    console.error('Erro ao buscar terapeutas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados dos terapeutas' },
      { status: 500 }
    )
  }
}
