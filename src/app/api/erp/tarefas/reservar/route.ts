import { NextRequest, NextResponse } from 'next/server'
import { autorizadoErp } from '@/lib/erp/auth'
import { reservar } from '@/lib/inteligencia/reservas'

// POST /api/erp/tarefas/reservar — a atendente "pega" uma tarefa da fila.
// Evita que duas atendentes trabalhem o mesmo cliente. Header: x-erp-key.
// Body: { clienteScoreId, atendente? }

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!autorizadoErp(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const clienteScoreId = Number(body.clienteScoreId)
  const atendente = String(body.atendente || 'central')
  if (!Number.isInteger(clienteScoreId)) {
    return NextResponse.json({ error: 'clienteScoreId inválido' }, { status: 400 })
  }

  const r = reservar(clienteScoreId, atendente)
  if (!r.ok) {
    return NextResponse.json({ error: 'já reservado por outra atendente', reservadoPor: r.por }, { status: 409 })
  }
  return NextResponse.json({ ok: true, reservadoAte: new Date(r.ate!).toISOString() })
}
