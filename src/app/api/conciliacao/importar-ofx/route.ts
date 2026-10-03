import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { ingerirOFX } from '@/lib/conciliacao/ingestao-ofx'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/conciliacao/importar-ofx
 * Body JSON: { unidade: string, ofx: string }  (conteúdo do arquivo OFX)
 * Lê o extrato, concilia os Pix recebidos (mão-dupla) contra o Belle.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const unidadeSlug = resolveUnidade(session, body?.unidade)
    if (!unidadeSlug) return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })

    const ofx: string = typeof body?.ofx === 'string' ? body.ofx : ''
    if (!ofx || !/<STMTTRN>/i.test(ofx)) {
      return NextResponse.json({ error: 'Arquivo OFX inválido ou vazio (não encontrei transações).' }, { status: 400 })
    }

    const r = await ingerirOFX(unidadeSlug, ofx)
    return NextResponse.json({ success: true, ...r })
  } catch (error) {
    console.error('[Conciliação/OFX] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao importar OFX'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
