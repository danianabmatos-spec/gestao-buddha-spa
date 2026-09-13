import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/rotinas/tratativa
// { unidade, chaveCaso, cliente, classificacao, nota?, comentario?, acaoTomada }
// Registra (ou atualiza) a ação tomada num caso de NPS. Dona/Coordenação no escopo.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil === 'RECEPCAO') {
    return NextResponse.json({ error: 'Recepção não registra tratativas de NPS.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { unidade: slug, chaveCaso, cliente, classificacao, comentario, acaoTomada } = body
  const nota = body.nota != null ? Number(body.nota) : null
  const origem = body.origem === 'GOOGLE' ? 'GOOGLE' : 'NPS'
  const tipoProblema = body.tipoProblema ? String(body.tipoProblema) : null
  const cortesiaConcedida = typeof body.cortesiaConcedida === 'boolean' ? body.cortesiaConcedida : null
  const clienteSatisfeito = body.clienteSatisfeito ? String(body.clienteSatisfeito) : null

  if (!slug || !chaveCaso || !acaoTomada?.trim()) {
    return NextResponse.json({ error: 'Informe unidade, caso e a ação tomada.' }, { status: 400 })
  }

  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(slug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }
  const unidade = await prisma.unidade.findUnique({ where: { slug }, select: { id: true } })
  if (!unidade) return NextResponse.json({ error: 'Unidade inexistente.' }, { status: 404 })

  const dados = {
    origem,
    cliente: String(cliente || '').trim(),
    classificacao: String(classificacao || '').trim(),
    nota: Number.isFinite(nota as number) ? (nota as number) : null,
    comentario: comentario ? String(comentario) : null,
    acaoTomada: String(acaoTomada).trim(),
    tipoProblema,
    cortesiaConcedida,
    clienteSatisfeito,
    tratadoPorId: session.sub,
    tratadoPorNome: session.nome,
  }

  const tratativa = await prisma.tratativaNps.upsert({
    where: { unidadeId_chaveCaso: { unidadeId: unidade.id, chaveCaso: String(chaveCaso) } },
    update: dados,
    create: { unidadeId: unidade.id, chaveCaso: String(chaveCaso), ...dados },
  })

  return NextResponse.json({ ok: true, tratativa })
}
