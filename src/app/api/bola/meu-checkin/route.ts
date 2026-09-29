import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

// GET /api/bola/meu-checkin
//   Status do check-in de HOJE da terapeuta logada (para a tela dela mostrar
//   se já está na bola e em que posição).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ terapeuta: false })

  const data = hojeBrasilia()
  const fila = await prisma.bolaCheckin.findMany({
    where: { unidadeSlug: terapeuta.unidadeSlug, data, status: 'ATIVO' },
    orderBy: { chegadaEm: 'asc' },
    select: { terapeutaId: true, chegadaEm: true },
  })
  const idx = fila.findIndex((f) => f.terapeutaId === terapeuta.id)

  return NextResponse.json({
    terapeuta: true,
    checkedIn: idx >= 0,
    posicao: idx >= 0 ? idx + 1 : null,
    totalNaFila: fila.length,
    chegadaEm: idx >= 0 ? fila[idx].chegadaEm : null,
  })
}
