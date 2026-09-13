import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/rotinas/editar
// { id, titulo?, descricao?, prazo?, data?, area? }
// Edita uma tarefa (instância). Dona edita qualquer uma; Coordenação as das suas
// unidades; Recepção não edita (só conclui). "data" move a tarefa para outro dia.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil === 'RECEPCAO') {
    return NextResponse.json({ error: 'Recepção não edita tarefas.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = Number(body.id)
  if (!id) return NextResponse.json({ error: 'Informe o id da tarefa.' }, { status: 400 })

  const tarefa = await prisma.tarefaRotina.findUnique({
    where: { id },
    include: { unidade: { select: { slug: true } } },
  })
  if (!tarefa) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })

  // Escopo de unidade (Coordenação limitada às suas).
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(tarefa.unidade.slug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.titulo === 'string' && body.titulo.trim()) data.titulo = body.titulo.trim()
  if (typeof body.descricao === 'string') data.descricao = body.descricao || null
  if (typeof body.prazo === 'string') data.prazo = body.prazo || null
  if (body.area === 'COORDENACAO' || body.area === 'RECEPCAO') data.area = body.area
  if (typeof body.data === 'string' && body.data) {
    // Move a tarefa para outro dia (recalcula atraso a partir dele).
    data.dataRef = body.data
    data.dataOriginal = body.data
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  try {
    const atualizada = await prisma.tarefaRotina.update({ where: { id }, data })
    return NextResponse.json({ ok: true, tarefa: atualizada })
  } catch {
    // Colisão de (unidade, template, dia) ao mover para um dia que já tem a rotina.
    return NextResponse.json({ error: 'Já existe uma tarefa desta rotina nesse dia.' }, { status: 409 })
  }
}
