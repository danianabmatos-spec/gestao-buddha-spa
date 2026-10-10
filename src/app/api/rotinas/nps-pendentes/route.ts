import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { mesRefAtual } from '@/lib/rotinas/nps-pendentes'

export const dynamic = 'force-dynamic'

// GET /api/rotinas/nps-pendentes → { mesRef, pendentes: { [slug]: nº } }
// Lê do cache (NpsPendentesCache) do mês corrente — barato, p/ o badge do menu lateral.
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const permitidas = unidadesPermitidas(session)
  const unidades = await prisma.unidade.findMany({
    where: permitidas === null ? { ativa: true } : { slug: { in: permitidas } },
    select: { id: true, slug: true },
  })
  const mesRef = mesRefAtual()
  const rows = await prisma.npsPendentesCache.findMany({
    where: { mesRef, unidadeId: { in: unidades.map((u) => u.id) } },
    select: { unidadeId: true, pendentes: true },
  })
  const porId = new Map(rows.map((r) => [r.unidadeId, r.pendentes]))
  const pendentes: Record<string, number> = {}
  for (const u of unidades) pendentes[u.slug] = porId.get(u.id) ?? 0
  return NextResponse.json({ mesRef, pendentes })
}
