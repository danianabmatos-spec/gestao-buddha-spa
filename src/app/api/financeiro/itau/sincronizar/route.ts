import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { ingerirExtratoItau } from '@/lib/conciliacao/itau'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/financeiro/itau/sincronizar
 * Body: { unidade: string, dataIni: "YYYY-MM-DD", dataFim: "YYYY-MM-DD" }
 * Puxa o extrato do Itaú (mTLS + OAuth) e concilia os Pix (mesmo motor do OFX).
 * Enquanto a unidade não tiver credencial/certificado no .env, retorna configurado:false.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO') {
      return NextResponse.json({ error: 'Só o financeiro ou a dona/dono pode sincronizar o banco' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    const unidadeSlug = resolveUnidade(session, body?.unidade)
    if (!unidadeSlug) return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })

    const hoje = new Date().toLocaleDateString('en-CA')
    const dataIni = typeof body?.dataIni === 'string' && body.dataIni ? body.dataIni : hoje
    const dataFim = typeof body?.dataFim === 'string' && body.dataFim ? body.dataFim : hoje

    const r = await ingerirExtratoItau(unidadeSlug, dataIni, dataFim)
    if (!r.configurado) {
      return NextResponse.json({ success: false, configurado: false, motivo: r.motivo }, { status: 200 })
    }
    return NextResponse.json({ success: true, ...r })
  } catch (error) {
    console.error('[Itaú/Sincronizar] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao sincronizar o Itaú'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
