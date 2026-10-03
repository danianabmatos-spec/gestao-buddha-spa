import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/plano-contas — catálogo global de contas contábeis (para classificar entradas).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  const contas = await prisma.planoConta.findMany({
    where: { ativa: true },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    select: { id: true, nome: true, tipo: true, tipoDespesa: true },
  })
  return NextResponse.json({ contas })
}
