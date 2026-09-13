import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { statusOutbox, processarOutbox } from '@/lib/integracoes/leadflow'

export const dynamic = 'force-dynamic'

// GET — status da fila de espelhamento no LeadFlow (apenas DONA).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') {
    return NextResponse.json({ error: 'Apenas a administradora' }, { status: 403 })
  }
  return NextResponse.json(await statusOutbox())
}

// POST — força o processamento da fila agora (apenas DONA). No-op se desligado.
export async function POST() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') {
    return NextResponse.json({ error: 'Apenas a administradora' }, { status: 403 })
  }
  const r = await processarOutbox()
  return NextResponse.json({ ok: true, resultado: r, ...(await statusOutbox()) })
}
