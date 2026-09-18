import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas, resolveUnidade } from '@/lib/auth/guard'
import { getUnidadesDisponiveis, getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { ingerirMovimentacoes } from '@/lib/conciliacao/ingestao-belle'
import { ingerirVouchers } from '@/lib/conciliacao/ingestao-vouchers'

export const maxDuration = 300

// Data de hoje no fuso de Brasília (YYYY-MM-DD).
function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/conciliacao/sincronizar
 * Body JSON: { unidade?: string, dataIni?: string, dataFim?: string }
 * - Sem unidade: DONA/FINANCEIRO/RH sincronizam TODAS; demais, as suas.
 * - Sem datas: usa o dia de hoje (Brasília).
 * Dispara a ingestão do Belle (Report 103) para o período e recalcula o resumo.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const unidadeReq: string | null = body?.unidade ?? null
    const hoje = hojeBrasilia()
    const dataIni: string = body?.dataIni || hoje
    const dataFim: string = body?.dataFim || dataIni

    if (!ISO.test(dataIni) || !ISO.test(dataFim)) {
      return NextResponse.json({ error: 'Datas devem estar no formato YYYY-MM-DD' }, { status: 400 })
    }
    if (dataIni > dataFim) {
      return NextResponse.json({ error: 'dataIni não pode ser maior que dataFim' }, { status: 400 })
    }

    // Resolve as unidades-alvo respeitando o escopo do perfil.
    const permitidas = unidadesPermitidas(session)
    let alvos: string[]
    if (unidadeReq) {
      const r = resolveUnidade(session, unidadeReq)
      if (!r || (permitidas && !permitidas.includes(unidadeReq))) {
        return NextResponse.json({ error: 'Sem permissão para esta unidade' }, { status: 403 })
      }
      alvos = [r]
    } else {
      alvos = permitidas === null ? getUnidadesDisponiveis() : permitidas
    }
    if (alvos.length === 0) {
      return NextResponse.json({ error: 'Nenhuma unidade no escopo da sessão' }, { status: 400 })
    }

    // Ingere cada unidade; um erro numa unidade não derruba as outras.
    const resultados = await Promise.all(
      alvos.map(async (slug) => {
        if (!getUnidadeCredenciais(slug)) {
          return { unidade: slug, ok: false, erro: 'Sem credenciais Belle' }
        }
        try {
          const r = await ingerirMovimentacoes(slug, dataIni, dataFim)
          // Vouchers do site (isolado: falha aqui não derruba a conciliação principal).
          let vouchers: { usados: number; validados: number } | null = null
          try {
            const v = await ingerirVouchers(slug, dataIni, dataFim)
            vouchers = { usados: v.usados, validados: v.validados }
          } catch (ev) {
            console.error(`[Conciliação] vouchers ${slug}:`, ev instanceof Error ? ev.message : ev)
          }
          return { unidade: slug, ok: true, ...r, vouchers }
        } catch (e) {
          return { unidade: slug, ok: false, erro: e instanceof Error ? e.message : 'Erro na ingestão' }
        }
      }),
    )

    const okCount = resultados.filter((r) => r.ok).length
    return NextResponse.json({
      success: okCount > 0,
      periodo: { de: dataIni, ate: dataFim },
      unidades: resultados.length,
      sincronizadas: okCount,
      resultados,
    })
  } catch (error) {
    console.error('[Conciliação/Sincronizar] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao sincronizar conciliação'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
