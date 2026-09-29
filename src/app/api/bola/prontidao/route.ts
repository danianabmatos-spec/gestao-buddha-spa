import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { diagnosticoProntidao } from '@/lib/bola/prontidao'

export const dynamic = 'force-dynamic'

// GET /api/bola/prontidao?unidade=slug
//   Diagnóstico read-only do que falta pra unidade operar a bola. Usado no
//   rollout (unidade-modelo → replicar). Escopo por unidade (DONA vê qualquer uma).
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const unidade = resolveUnidade(session, new URL(req.url).searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const diag = await diagnosticoProntidao(unidade)
  return NextResponse.json(diag)
}
