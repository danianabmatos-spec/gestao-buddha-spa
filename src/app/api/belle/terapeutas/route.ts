import { NextRequest, NextResponse } from 'next/server'
import { getTerapeutasFidelizacao } from '@/lib/belle/relatorio-fidelizacao'
import { getNPSPorProfissional } from '@/lib/belle/relatorio-nps'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getNaoTerapeutasRH, getCategoriasTerapeutasRH, normalizarNome } from '@/lib/rh/terapeutas-ativos'
import { getSession } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

// Stopgap: desligadas que fazem atendimento no Belle mas nunca foram cadastradas no
// RH (o RH é recente). Escondidas manualmente até o vínculo Belle↔RH (nomeBelle) ficar
// pronto — aí o filtro allowlist esconde qualquer desligada automaticamente.
const OCULTAR_MANUAL = new Set([
  'Isabela Annunciação Campos de Mendonça',
  'Bruna Bonifácio Silva',
  'Cristiane Vieira dos Santos',
].map(normalizarNome))

// Perfis que enxergam as colunas restritas (Nota Total / Gestor / Final / Categoria).
const PERFIS_RESTRITO = new Set(['DONA', 'RH', 'FINANCEIRO'])

// Semestre a partir da data fim: "2026-S1" (jan–jun) ou "2026-S2" (jul–dez).
function periodoSemestre(dataFim: string): string {
  const [ano, mes] = dataFim.split('-').map(Number)
  return `${ano}-S${mes <= 6 ? 1 : 2}`
}

const PESOS_DEFAULT = {
  pesoProdutividade: 25, pesoFidelizacao: 35, pesoNps: 20,
  pesoRecomendacao: 10, pesoTreinamento: 0, pesoColegas: 10,
}
const FAIXAS_DEFAULT = { minDiamante: 9.5, minOuro: 8.5, minPrata: 7.5 }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const unidade = searchParams.get('unidade') || 'shopping-metropole'
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')

    if (!dataIni || !dataFim) {
      return NextResponse.json({ error: 'Parâmetros dataIni e dataFim são obrigatórios' }, { status: 400 })
    }

    const credenciais = getUnidadeCredenciais(unidade)
    if (!credenciais) {
      return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    }
    const { email, password: senha, estab } = credenciais
    const periodo = periodoSemestre(dataFim)

    const session = await getSession()
    const podeVerRestrito = !!session && PERFIS_RESTRITO.has(session.perfil)

    // Belle (fidelização + NPS), denylist e categorias do RH, e dados salvos — em paralelo
    const [terapeutasFidelizacao, npsData, naoTerapeutas, categoriasRH, avaliacoes, pesosRow, faixasRow] =
      await Promise.all([
        getTerapeutasFidelizacao(email, senha, dataIni, dataFim, estab),
        getNPSPorProfissional(email, senha, dataIni, dataFim, estab),
        getNaoTerapeutasRH(),
        getCategoriasTerapeutasRH(),
        prisma.terapeutaAvaliacao.findMany({ where: { unidadeSlug: unidade, periodo } }),
        prisma.terapeutaPesos.findUnique({ where: { unidadeSlug: unidade } }),
        prisma.terapeutaCategoriaFaixa.findUnique({ where: { chave: 'global' } }),
      ])

    const npsPorNome = new Map(npsData.map(n => [normalizarNome(n.profissional), n.nps]))
    const avPorChave = new Map(avaliacoes.map(a => [a.terapeutaChave, a]))

    const terapeutas = terapeutasFidelizacao
      .map(t => ({ ...t, nps: npsPorNome.get(normalizarNome(t.profissional)) ?? 0 }))
      // DENYLIST à prova de falha (ver histórico): esconde banho, ocultos e não-terapeutas do RH.
      .filter(t => {
        const n = normalizarNome(t.profissional)
        if (n.includes('banho')) return false
        if (OCULTAR_MANUAL.has(n)) return false
        if (naoTerapeutas && naoTerapeutas.has(n)) return false
        return true
      })
      .map(t => {
        const chave = normalizarNome(t.profissional)
        const av = avPorChave.get(chave)
        return {
          ...t,
          categoria: categoriasRH?.get(chave) ?? null,          // categoria atual (RH)
          recomendacaoCliente: av?.recomendacaoCliente ?? null,
          horasTreinamento: av?.horasTreinamento ?? null,
          avaliacaoColegas: av?.avaliacaoColegas ?? null,
          avaliacaoGestor: av?.avaliacaoGestor ?? null,
        }
      })

    return NextResponse.json({
      periodo,
      podeVerRestrito,
      pesos: pesosRow ?? PESOS_DEFAULT,
      faixas: faixasRow ?? FAIXAS_DEFAULT,
      terapeutas,
    })
  } catch (error) {
    console.error('Erro ao buscar terapeutas:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados dos terapeutas' }, { status: 500 })
  }
}
