import { NextRequest, NextResponse } from 'next/server'
import { getTerapeutasFidelizacao } from '@/lib/belle/relatorio-fidelizacao'
import { getNPSPorProfissional } from '@/lib/belle/relatorio-nps'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getNaoTerapeutasRH, normalizarNome } from '@/lib/rh/terapeutas-ativos'

// Stopgap: desligadas que fazem atendimento no Belle mas nunca foram cadastradas no
// RH (o RH é recente). Escondidas manualmente até o vínculo Belle↔RH (nomeBelle) ficar
// pronto — aí o filtro allowlist esconde qualquer desligada automaticamente.
const OCULTAR_MANUAL = new Set([
  'Isabela Annunciação Campos de Mendonça',
  'Bruna Bonifácio Silva',
  'Cristiane Vieira dos Santos',
].map(normalizarNome))

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

    // Busca fidelização, NPS e a DENYLIST de não-terapeutas do RH em paralelo
    const [terapeutasFidelizacao, npsData, naoTerapeutas] = await Promise.all([
      getTerapeutasFidelizacao(email, senha, dataIni, dataFim, estab),
      getNPSPorProfissional(email, senha, dataIni, dataFim, estab),
      getNaoTerapeutasRH(),
    ])

    // Mescla o NPS por nome NORMALIZADO (corrige mismatch de espaço/acento entre
    // Report 192 e Report 21, que zerava o NPS de alguns profissionais).
    const npsPorNome = new Map(npsData.map(n => [normalizarNome(n.profissional), n.nps]))
    const terapeutas = terapeutasFidelizacao
      .map(t => ({
        ...t,
        nps: npsPorNome.get(normalizarNome(t.profissional)) ?? 0,
      }))
      // DENYLIST à prova de falha: mostra todos os terapeutas do Belle e só ESCONDE
      // banho de imersão e quem o RH confirma NÃO ser terapeuta (coordenador/recepção).
      // Assim nenhum terapeuta real some por divergência de grafia de nome.
      .filter(t => {
        const n = normalizarNome(t.profissional)
        if (n.includes('banho')) return false
        if (OCULTAR_MANUAL.has(n)) return false
        if (naoTerapeutas && naoTerapeutas.has(n)) return false
        return true
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
