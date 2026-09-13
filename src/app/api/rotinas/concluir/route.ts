import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/rotinas/concluir  { id, concluir: boolean, observacao?: string }
// Marca (ou reabre) uma tarefa. Registra quem concluiu e quando.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id, concluir = true, observacao } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Informe o id da tarefa.' }, { status: 400 })

  const tarefa = await prisma.tarefaRotina.findUnique({
    where: { id: Number(id) },
    include: { unidade: { select: { slug: true } } },
  })
  if (!tarefa) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })

  // Escopo: usuário só age em unidades que enxerga; recepção só nas tarefas dela.
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(tarefa.unidade.slug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }
  if (session.perfil === 'RECEPCAO' && tarefa.area !== 'RECEPCAO') {
    return NextResponse.json({ error: 'Sem permissão para esta tarefa.' }, { status: 403 })
  }

  const atualizada = await prisma.tarefaRotina.update({
    where: { id: tarefa.id },
    data: concluir
      ? {
          status: 'CONCLUIDA',
          concluidaEm: new Date(),
          concluidaPorId: session.sub,
          concluidaPorNome: session.nome,
          ...(observacao !== undefined ? { observacao: String(observacao) } : {}),
        }
      : {
          status: 'PENDENTE',
          concluidaEm: null,
          concluidaPorId: null,
          concluidaPorNome: null,
        },
  })

  return NextResponse.json({ ok: true, tarefa: atualizada })
}
