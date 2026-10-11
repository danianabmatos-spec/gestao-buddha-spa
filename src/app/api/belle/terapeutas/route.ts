import { NextRequest, NextResponse } from 'next/server'
import { getCategoriasTerapeutasRH, normalizarNome } from '@/lib/rh/terapeutas-ativos'
import { getSession } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import type { TerapeutaBelle } from '@/lib/terapeutas/belle-fetch'

// Perfis que enxergam as colunas restritas (Nota Total / Gestor / Final / Categoria).
const PERFIS_RESTRITO = new Set(['DONA', 'RH', 'FINANCEIRO'])

function periodoSemestre(dataFim: string): string {
  const [ano, mes] = dataFim.split('-').map(Number)
  return `${ano}-S${mes <= 6 ? 1 : 2}`
}

const PESOS_DEFAULT = {
  pesoProdutividade: 25, pesoFidelizacao: 35, pesoNps: 20,
  pesoRecomendacao: 10, pesoTreinamento: 0, pesoColegas: 10,
}
const FAIXAS_DEFAULT = { minDiamante: 9.5, minOuro: 8.5, minPrata: 7.5 }

// Serve a tela A PARTIR DO CACHE (não consulta o Belle). O Belle só é lido no
// "Atualizar agora" (POST /api/terapeutas/atualizar). Mescla ao vivo os dados locais
// (categoria do RH, notas do gestor, pesos) que são baratos.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const unidade = searchParams.get('unidade') || 'shopping-metropole'
    const dataFim = searchParams.get('dataFim')
    if (!dataFim) {
      return NextResponse.json({ error: 'Parâmetro dataFim é obrigatório' }, { status: 400 })
    }
    const periodo = periodoSemestre(dataFim)

    const session = await getSession()
    const podeVerRestrito = !!session && PERFIS_RESTRITO.has(session.perfil)
    const podeGerenciarPesos = !!session && session.perfil === 'DONA' // pesos: só a Dona vê/edita

    // Cache do Belle (JSON) — leitura local, instantânea.
    const rows = await prisma.$queryRawUnsafe<{ dados: string; atualizadoEm: string; atualizadoPor: string | null }[]>(
      `SELECT "dados", "atualizadoEm", "atualizadoPor" FROM "TerapeutaBelleCache" WHERE "unidadeSlug" = ? AND "periodo" = ? LIMIT 1`,
      unidade, periodo,
    )
    const cache = rows?.[0]
    let belleTerapeutas: TerapeutaBelle[] = []
    if (cache?.dados) { try { belleTerapeutas = JSON.parse(cache.dados) } catch { belleTerapeutas = [] } }

    const [categoriasRH, avaliacoes, pesosRow, faixasRow, vinculosRows] = await Promise.all([
      getCategoriasTerapeutasRH(),
      prisma.terapeutaAvaliacao.findMany({ where: { unidadeSlug: unidade, periodo } }),
      prisma.terapeutaPesos.findUnique({ where: { unidadeSlug: unidade } }),
      prisma.terapeutaCategoriaFaixa.findUnique({ where: { chave: 'global' } }),
      prisma.$queryRawUnsafe<{ belleNomeNorm: string; rhNome: string }[]>(
        `SELECT "belleNomeNorm", "rhNome" FROM "TerapeutaVinculoRH"`,
      ).catch(() => [] as { belleNomeNorm: string; rhNome: string }[]),
    ])
    const avPorChave = new Map(avaliacoes.map(a => [a.terapeutaChave, a]))
    // Vínculos manuais (nome do Belle → nome do R&S), p/ quando o automático não casa.
    const vinculos = new Map((vinculosRows ?? []).map(v => [v.belleNomeNorm, v.rhNome]))

    const terapeutas = belleTerapeutas.map(t => {
      const chave = normalizarNome(t.profissional)
      const av = avPorChave.get(chave)
      let categoria = categoriasRH?.resolve(chave) ?? null
      const rhVinculado = vinculos.get(chave) ?? null
      let categoriaVinculo = false
      if (!categoria && rhVinculado) {
        categoria = categoriasRH?.porRhNome(normalizarNome(rhVinculado)) ?? null
        categoriaVinculo = !!categoria
      }
      return {
        ...t,
        categoria,
        categoriaVinculo,   // true = veio de vínculo manual
        rhVinculado,        // nome do R&S escolhido (ou null)
        recomendacaoCliente: av?.recomendacaoCliente ?? null,
        horasTreinamento: av?.horasTreinamento ?? null,
        avaliacaoColegas: av?.avaliacaoColegas ?? null,
        avaliacaoGestor: av?.avaliacaoGestor ?? null,
      }
    })

    const pesos = pesosRow ? {
      pesoProdutividade: pesosRow.pesoProdutividade, pesoFidelizacao: pesosRow.pesoFidelizacao,
      pesoNps: pesosRow.pesoNps, pesoRecomendacao: pesosRow.pesoRecomendacao,
      pesoTreinamento: pesosRow.pesoTreinamento, pesoColegas: pesosRow.pesoColegas,
    } : PESOS_DEFAULT
    const faixas = faixasRow ? {
      minDiamante: faixasRow.minDiamante, minOuro: faixasRow.minOuro, minPrata: faixasRow.minPrata,
    } : FAIXAS_DEFAULT

    return NextResponse.json({
      periodo, podeVerRestrito, podeGerenciarPesos, pesos, faixas, terapeutas,
      // Lista de terapeutas do R&S (nome + categoria) p/ o seletor de vínculo manual
      // (só p/ quem pode ver o restrito — DONA/RH/FINANCEIRO).
      rhTerapeutas: podeVerRestrito ? (categoriasRH?.rhLista ?? []) : [],
      atualizadoEm: cache?.atualizadoEm ?? null,
      atualizadoPor: cache?.atualizadoPor ?? null,
    })
  } catch (error) {
    console.error('Erro ao servir terapeutas (cache):', error)
    return NextResponse.json({ error: 'Erro ao carregar dados dos terapeutas' }, { status: 500 })
  }
}
