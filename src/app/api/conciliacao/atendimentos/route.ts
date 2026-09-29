import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ─── Parte 2 · F4 · Painel de Conciliação de Atendimentos ───────────────────────
// Resumo do mês por classificação + lista dos atendimentos que exigem ação
// (sem justificativa / cortesia / desconto / cortesia de colaborador acima do limite).

const ABERTAS = ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA']

// Classificações que NÃO precisam de ação (justificadas).
const OK = ['FINANCEIRO', 'PLANO', 'VOUCHER', 'PARCERIA']
// Classificações que exigem ação quando não justificadas.
const ACAO = ['SEM_JUSTIFICATIVA', 'CORTESIA', 'DESCONTO', 'CORTESIA_COLABORADOR']

/**
 * GET /api/conciliacao/atendimentos?unidade=slug&ano=2026&mes=9
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const sp = request.nextUrl.searchParams
    const unidadeSlug = resolveUnidade(session, sp.get('unidade'))
    if (!unidadeSlug) return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })

    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    const ano = Number(sp.get('ano')) || Number(hoje.slice(0, 4))
    const mes = Number(sp.get('mes')) || Number(hoje.slice(5, 7))
    if (mes < 1 || mes > 12) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`

    const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
    if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    const unidadeId = unidade.id

    const atendimentos = await prisma.atendimentoConc.findMany({
      where: { unidadeId, data: { startsWith: prefixo } },
      orderBy: [{ data: 'asc' }, { horario: 'asc' }],
    })

    // Resumo por classificação.
    const porClassificacao: Record<string, number> = {}
    let valorAberto = 0
    for (const a of atendimentos) {
      porClassificacao[a.classificacao] = (porClassificacao[a.classificacao] ?? 0) + 1
      if (a.classificacao === 'SEM_JUSTIFICATIVA') valorAberto += a.covAberto || a.valorBruto || 0
    }

    // TODOS os descontos e cortesias do mês (justificados OU não) — a tela mostra tudo
    // com a coluna de justificativa. (Sem-justificativa também entra, é o alarme.)
    const CLASSES_REVISAR = ['SEM_JUSTIFICATIVA', 'CORTESIA', 'CORTESIA_COLABORADOR', 'CORTESIA_PROPRIETARIO', 'DESCONTO']
    const itens = atendimentos.filter((a) => CLASSES_REVISAR.includes(a.classificacao))

    // Divergências vinculadas (traz justificativa da equipe + sugestão automática).
    const divIds = itens.map((a) => a.divergenciaId).filter((x): x is number => !!x)
    const divs = divIds.length
      ? await prisma.divergencia.findMany({ where: { id: { in: divIds } }, select: { id: true, status: true, justificativa: true, tratadaPorNome: true, sugestaoAjuste: true, aprovadaEm: true, aprovadaPorNome: true } })
      : []
    const divPorId = new Map(divs.map((d) => [d.id, d]))

    // Justificativa "automática" da regra (o que dispensa ação da equipe).
    function motivoAuto(a: (typeof itens)[number]): string | null {
      if (a.classificacao === 'CORTESIA_PROPRIETARIO' && a.justificado) return 'Cortesia de proprietário(a)'
      if (a.classificacao === 'CORTESIA_COLABORADOR' && a.justificado) return 'Cortesia de colaboradora (1 sessão/mês)'
      return null
    }

    const SEVERIDADE: Record<string, number> = { SEM_JUSTIFICATIVA: 0, CORTESIA: 1, CORTESIA_COLABORADOR: 1, DESCONTO: 2 }
    const problemas = itens
      .map((a) => {
        const dv = a.divergenciaId ? divPorId.get(a.divergenciaId) : null
        return {
          id: a.id,
          belleAtendId: a.belleAtendId,
          data: a.data,
          horario: a.horario,
          clienteNome: a.clienteNome.trim(),
          servico: a.servico,
          tempo: a.tempo,
          profissional: a.profissional,
          classificacao: a.classificacao,
          justificado: a.justificado,
          valor: a.classificacao === 'SEM_JUSTIFICATIVA' ? (a.covAberto || a.valorBruto || 0)
            : a.classificacao === 'DESCONTO' ? a.covDesconto
            : (a.covCortesia || a.valorBruto || 0),
          origemDesconto: a.origemDesconto,
          divergenciaId: a.divergenciaId,
          divergenciaStatus: dv?.status ?? null,
          justificativa: dv?.justificativa ?? null,
          sugestao: dv?.sugestaoAjuste ?? null,
          motivoAuto: motivoAuto(a),
          tratadaPorNome: dv?.tratadaPorNome ?? null,
          aprovada: !!dv?.aprovadaEm,
          aprovadaPorNome: dv?.aprovadaPorNome ?? null,
        }
      })
      .sort((a, b) => (SEVERIDADE[a.classificacao] ?? 3) - (SEVERIDADE[b.classificacao] ?? 3) || a.data.localeCompare(b.data))

    // Divergências ainda abertas (para o contador do topo).
    const abertas = await prisma.divergencia.count({
      where: { unidadeId, data: { startsWith: prefixo }, tipo: { in: ['ATENDIMENTO_SEM_JUSTIFICATIVA', 'CORTESIA', 'DESCONTO'] }, status: { in: ABERTAS } },
    })

    const total = atendimentos.length
    const justificados = atendimentos.filter((a) => a.justificado || OK.includes(a.classificacao)).length

    return NextResponse.json({
      unidade: unidadeSlug, ano, mes,
      podeAprovar: session.perfil === 'DONA',
      resumo: { total, justificados, sinalizados: total - justificados, valorAberto, porClassificacao, divergenciasAbertas: abertas },
      problemas,
    })
  } catch (error) {
    console.error('[Conciliação/Atendimentos] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao carregar atendimentos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
