import { NextRequest, NextResponse } from 'next/server'
import { autorizadoErp } from '@/lib/erp/auth'
import { liberar } from '@/lib/inteligencia/reservas'

// POST /api/erp/tarefas/devolver — a atendente desistiu; a tarefa volta pra fila.
// Header: x-erp-key. Body: { clienteScoreId }

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!autorizadoErp(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const clienteScoreId = Number(body.clienteScoreId)
  if (!Number.isInteger(clienteScoreId)) {
    return NextResponse.json({ error: 'clienteScoreId inválido' }, { status: 400 })
  }
  liberar(clienteScoreId)
  return NextResponse.json({ ok: true })
}
