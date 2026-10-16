import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { hojeBrasilia } from '@/lib/bola/dados'

export const dynamic = 'force-dynamic'

// A recepção gerencia a fila da bola (marca chegada / remove quem saiu), na ordem
// de chegada. Alternativa ao "Cheguei" do terapeuta — aqui quem insere é a recepção.

async function unidadeEterapeuta(req: NextRequest) {
  const session = await getSession()
  if (!session) return { erro: unauthorized() }
  const unidade = resolveUnidade(session, new URL(req.url).searchParams.get('unidade'))
  if (!unidade) return { erro: NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 }) }
  const body = await req.json().catch(() => ({}))
  const terapeutaId = Number(body.terapeutaId)
  if (!terapeutaId) return { erro: NextResponse.json({ error: 'Informe terapeutaId.' }, { status: 400 }) }
  const terapeuta = await prisma.terapeuta.findFirst({
    where: { id: terapeutaId, unidadeSlug: unidade, ativo: true },
    select: { id: true, nome: true },
  })
  if (!terapeuta) return { erro: NextResponse.json({ error: 'Terapeuta não encontrada nesta unidade.' }, { status: 404 }) }
  return { unidade, terapeuta, body }
}

// POST /api/bola/fila?unidade=slug  { terapeutaId }
//   A recepção marca a chegada de uma terapeuta — entra no fim da fila.
export async function POST(req: NextRequest) {
  const r = await unidadeEterapeuta(req)
  if (r.erro) return r.erro
  const { unidade, terapeuta, body } = r
  const turno = body?.turno === 2 || body?.turno === '2' ? 2 : 1
  const data = hojeBrasilia()

  const existente = await prisma.bolaCheckin.findUnique({
    where: { unidadeSlug_terapeutaId_data: { unidadeSlug: unidade, terapeutaId: terapeuta.id, data } },
  })
  // Regra de CONTINUIDADE: terapeuta que fez um turno ANTERIOR e agora entra num turno
  // MAIOR (ex.: pegou o 2º turno depois da manhã) vai como PRIMEIRA da bola — mantém a
  // chegada original (mais cedo que quem chegou só à tarde). Re-entrada no MESMO turno
  // volta pro fim da fila (chegada = agora).
  const continuacao = !!existente && existente.turno < turno
  const chegadaEm = continuacao ? existente!.chegadaEm : new Date()

  await prisma.bolaCheckin.upsert({
    where: { unidadeSlug_terapeutaId_data: { unidadeSlug: unidade, terapeutaId: terapeuta.id, data } },
    update: { status: 'ATIVO', chegadaEm, turno },
    create: { unidadeSlug: unidade, terapeutaId: terapeuta.id, data, turno },
  })
  return NextResponse.json({ ok: true, nome: terapeuta.nome, continuacao })
}

// DELETE /api/bola/fila?unidade=slug  { terapeutaId }
//   A recepção tira a terapeuta da fila (saiu / fim do turno).
export async function DELETE(req: NextRequest) {
  const r = await unidadeEterapeuta(req)
  if (r.erro) return r.erro
  const { unidade, terapeuta } = r
  const data = hojeBrasilia()
  await prisma.bolaCheckin.updateMany({
    where: { unidadeSlug: unidade, terapeutaId: terapeuta.id, data },
    data: { status: 'ENCERRADO' },
  })
  return NextResponse.json({ ok: true, nome: terapeuta.nome })
}
