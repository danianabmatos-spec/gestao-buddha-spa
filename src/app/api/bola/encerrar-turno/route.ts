import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { hojeBrasilia } from '@/lib/bola/dados'

export const dynamic = 'force-dynamic'

// POST /api/bola/encerrar-turno?unidade=slug   { turno: 1 | 2 }
//   Tira da fila TODAS as terapeutas de um turno de uma vez (check-ins ATIVO → ENCERRADO).
//   É o que faz a bola AVANÇAR pro próximo turno: enquanto houver gente no turno 1, a
//   bola roda o turno 1 (fila "de manhã"); ao encerrar o turno 1, o turno 2 entra.
//   (Finalizar o ATENDIMENTO encerra só a massagem; quem controla o turno é o check-in.)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const unidade = resolveUnidade(session, new URL(req.url).searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const turno = Number(body.turno)
  if (![1, 2].includes(turno)) {
    return NextResponse.json({ error: 'Informe o turno (1 ou 2).' }, { status: 400 })
  }

  const data = hojeBrasilia()
  const r = await prisma.bolaCheckin.updateMany({
    where: { unidadeSlug: unidade, data, turno, status: 'ATIVO' },
    data: { status: 'ENCERRADO' },
  })

  return NextResponse.json({ ok: true, encerradas: r.count })
}
