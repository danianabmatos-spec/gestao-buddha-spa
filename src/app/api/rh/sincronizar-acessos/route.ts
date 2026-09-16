import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { sincronizarDesligamentosRH, ultimaSyncRH } from '@/lib/rh/sync-acessos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Autoriza DONA (sessão) OU o cron (x-cron-secret). Retorna o id do ator (p/ auditoria)
// ou null se for o cron; e um NextResponse de erro se não autorizado.
async function autorizar(req: NextRequest): Promise<{ erro: NextResponse | null; atorId: string | null }> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('x-cron-secret') === secret) return { erro: null, atorId: null }
  const session = await getSession()
  if (!session) return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }), atorId: null }
  if (session.perfil !== 'DONA') return { erro: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }), atorId: null }
  return { erro: null, atorId: session.sub }
}

// GET — prévia (dry-run: quem SERIA desativado agora) + última sincronização.
export async function GET(req: NextRequest) {
  const { erro, atorId } = await autorizar(req)
  if (erro) return erro
  try {
    const previa = await sincronizarDesligamentosRH({ dryRun: true, atorId: atorId ?? undefined })
    const ultima = await ultimaSyncRH()
    return NextResponse.json({ previa, ultima })
  } catch (e) {
    console.error('Erro na prévia de sync RH:', e)
    return NextResponse.json({ error: 'Falha ao consultar RH' }, { status: 500 })
  }
}

// POST — executa o desligamento automático (ou dry-run com ?dry=1).
export async function POST(req: NextRequest) {
  const { erro, atorId } = await autorizar(req)
  if (erro) return erro
  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  try {
    const resultado = await sincronizarDesligamentosRH({ dryRun, atorId: atorId ?? undefined })
    return NextResponse.json({ ok: true, resultado })
  } catch (e) {
    console.error('Erro no sync RH:', e)
    return NextResponse.json({ error: 'Falha ao sincronizar com o RH' }, { status: 500 })
  }
}
