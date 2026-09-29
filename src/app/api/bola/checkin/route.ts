import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// Data de hoje no fuso de São Paulo (nunca usar a data do servidor, que roda em UTC).
function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

// POST /api/bola/checkin
//   A terapeuta logada marca "Cheguei" — entra na fila da bola do dia.
//   Idempotente: 1 check-in por terapeuta/dia (reativa se estava encerrado).
export async function POST() {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ error: 'Usuário não é uma terapeuta.' }, { status: 403 })

  const data = hojeBrasilia()
  const checkin = await prisma.bolaCheckin.upsert({
    where: {
      unidadeSlug_terapeutaId_data: {
        unidadeSlug: terapeuta.unidadeSlug,
        terapeutaId: terapeuta.id,
        data,
      },
    },
    update: { status: 'ATIVO' }, // reativa quem já tinha encerrado; mantém a chegadaEm original
    create: { unidadeSlug: terapeuta.unidadeSlug, terapeutaId: terapeuta.id, data },
  })

  // posição na fila (ordem de chegada entre os ATIVOs de hoje)
  const fila = await prisma.bolaCheckin.findMany({
    where: { unidadeSlug: terapeuta.unidadeSlug, data, status: 'ATIVO' },
    orderBy: { chegadaEm: 'asc' },
    select: { terapeutaId: true },
  })
  const posicao = fila.findIndex((f) => f.terapeutaId === terapeuta.id) + 1

  return NextResponse.json({
    ok: true,
    chegadaEm: checkin.chegadaEm,
    posicao,
    totalNaFila: fila.length,
  })
}

// GET /api/bola/checkin?unidade=slug
//   Fila de chegada de hoje (para o painel da recepção). Escopo multi-tenant.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const requested = new URL(req.url).searchParams.get('unidade')
  const unidade = resolveUnidade(session, requested)
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const data = hojeBrasilia()
  const fila = await prisma.bolaCheckin.findMany({
    where: { unidadeSlug: unidade, data, status: 'ATIVO' },
    orderBy: { chegadaEm: 'asc' },
    include: { terapeuta: { select: { id: true, nome: true, nomeBelle: true } } },
  })

  return NextResponse.json({
    unidade,
    data,
    fila: fila.map((c, i) => ({
      posicao: i + 1,
      terapeutaId: c.terapeutaId,
      nome: c.terapeuta.nome,
      chegadaEm: c.chegadaEm,
    })),
  })
}
