import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { sincronizarProvisionamento } from '@/lib/rh/provisionamento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Só DONA — a criação gera SENHAS TEMPORÁRIAS que precisam ser vistas/repassadas
// por uma pessoa; por isso NÃO entra no cron (diferente do desligamento).
async function exigirDona(): Promise<{ erro: NextResponse | null; atorId: string | null }> {
  const session = await getSession()
  if (!session) return { erro: unauthorized(), atorId: null }
  if (session.perfil !== 'DONA') return { erro: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }), atorId: null }
  return { erro: null, atorId: session.sub }
}

// GET — prévia (dry-run): quem SERIA criado + ignorados (sem senha).
export async function GET() {
  const { erro } = await exigirDona()
  if (erro) return erro
  try {
    const previa = await sincronizarProvisionamento({ dryRun: true })
    return NextResponse.json({ previa })
  } catch (e) {
    console.error('Erro na prévia de provisionamento RH:', e)
    return NextResponse.json({ error: 'Falha ao consultar RH' }, { status: 500 })
  }
}

// POST — cria os acessos e devolve as senhas temporárias (ou dry-run com ?dry=1).
export async function POST(req: NextRequest) {
  const { erro, atorId } = await exigirDona()
  if (erro) return erro
  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  try {
    const resultado = await sincronizarProvisionamento({ dryRun, atorId: atorId ?? undefined })
    return NextResponse.json({ ok: true, resultado })
  } catch (e) {
    console.error('Erro no provisionamento RH:', e)
    return NextResponse.json({ error: 'Falha ao criar acessos' }, { status: 500 })
  }
}
