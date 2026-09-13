import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const rows = await prisma.clienteScore.groupBy({
    by: ['unidadeSlug'],
    where: (session.perfil === 'DONA' || session.perfil === 'FINANCEIRO') ? {} : { unidadeSlug: session.unidadeSlug ?? '__none__' },
    _max: { ultimoCalculo: true },
  })

  const porUnidade = Object.fromEntries(
    rows.map(r => [r.unidadeSlug, r._max.ultimoCalculo])
  )

  // Data global = a mais antiga entre as unidades (a que está mais desatualizada)
  const datas = rows.map(r => r._max.ultimoCalculo).filter(Boolean) as Date[]
  const maisAntiga = datas.length > 0
    ? new Date(Math.min(...datas.map(d => d.getTime())))
    : null

  return NextResponse.json({ ultimoSync: maisAntiga, porUnidade })
}
