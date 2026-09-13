import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade, unidadesPermitidas } from '@/lib/auth/guard'
import { ensureTarefasDoDia, listarTarefasDoDia, hojeISO } from '@/lib/rotinas/motor'

export const dynamic = 'force-dynamic'

// GET /api/rotinas?unidade=slug&data=YYYY-MM-DD
// Gera (idempotente) e lista as tarefas do dia da unidade, no escopo do usuário.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const dataParam = searchParams.get('data')
  const dataRef = dataParam || hojeISO()

  // Unidades que o usuário pode escolher no seletor
  const permitidas = unidadesPermitidas(session) // null = todas (DONA)
  const unidades = await prisma.unidade.findMany({
    where: permitidas === null ? { ativa: true } : { slug: { in: permitidas } },
    orderBy: { id: 'asc' },
    select: { id: true, nome: true, slug: true },
  })

  const slug = resolveUnidade(session, searchParams.get('unidade'))
  const unidade = unidades.find((u) => u.slug === slug) ?? unidades[0]
  if (!unidade) {
    return NextResponse.json({ error: 'Nenhuma unidade no escopo do usuário.' }, { status: 403 })
  }

  // Só materializa tarefas do DIA DE HOJE (a rotina viva). Dias passados/futuros
  // abertos pelo calendário apenas listam o que já existe — evita gerar diárias de
  // outros dias que acumulariam indevidamente na visão de hoje.
  if (dataRef === hojeISO()) {
    await ensureTarefasDoDia(unidade.id, dataRef)
  }
  // Ao abrir um dia específico pelo calendário, mostra só as tarefas daquele dia.
  const todas = await listarTarefasDoDia(unidade.id, dataRef, dataParam != null)

  // RECEPÇÃO só enxerga as tarefas da recepção; DONA e COORDENAÇÃO veem os dois níveis.
  const tarefas = session.perfil === 'RECEPCAO' ? todas.filter((t) => t.area === 'RECEPCAO') : todas

  const resumo = {
    total: tarefas.length,
    concluidas: tarefas.filter((t) => t.status === 'CONCLUIDA').length,
    pendentes: tarefas.filter((t) => t.status !== 'CONCLUIDA').length,
    atrasadas: tarefas.filter((t) => t.atrasada).length,
    emAlerta: tarefas.filter((t) => t.emAlerta).length,
  }

  return NextResponse.json({
    data: dataRef,
    perfil: session.perfil,
    unidadeAtual: { id: unidade.id, nome: unidade.nome, slug: unidade.slug },
    unidades,
    resumo,
    tarefas,
  })
}
