import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { hojeISO } from '@/lib/rotinas/motor'

export const dynamic = 'force-dynamic'

// POST /api/rotinas/delegar
// { unidade?|unidades?: slug(s), area, titulo, descricao?, prazo?, data? }
// Cria uma tarefa avulsa (não vem do catálogo) em UMA ou VÁRIAS unidades:
//   DONA        → COORDENACAO ou RECEPCAO · pode aplicar em várias unidades
//   COORDENACAO → COORDENACAO (para si) ou RECEPCAO (delega) · uma unidade por vez
//   RECEPCAO    → RECEPCAO (só para si) · uma unidade
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { area, titulo, descricao, prazo } = body
  const dataRef = body.data || hojeISO()

  const slugs: string[] = Array.isArray(body.unidades) && body.unidades.length
    ? body.unidades
    : body.unidade ? [body.unidade] : []

  if (!slugs.length || !titulo?.trim()) {
    return NextResponse.json({ error: 'Informe unidade(s) e título.' }, { status: 400 })
  }
  if (slugs.length > 1 && session.perfil !== 'DONA') {
    return NextResponse.json({ error: 'Só a dona aplica em várias unidades.' }, { status: 403 })
  }

  const alvo = area === 'COORDENACAO' ? 'COORDENACAO' : 'RECEPCAO'
  if (session.perfil === 'RECEPCAO' && alvo !== 'RECEPCAO') {
    return NextResponse.json({ error: 'Recepção só cria tarefas para si.' }, { status: 403 })
  }

  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && slugs.some((s) => !permitidas.includes(s))) {
    return NextResponse.json({ error: 'Sem acesso a alguma unidade selecionada.' }, { status: 403 })
  }

  const unidades = await prisma.unidade.findMany({ where: { slug: { in: slugs } }, select: { id: true } })
  if (!unidades.length) return NextResponse.json({ error: 'Unidade(s) inexistente(s).' }, { status: 404 })

  let criadas = 0
  for (const u of unidades) {
    await prisma.tarefaRotina.create({
      data: {
        unidadeId: u.id, templateId: null, area: alvo,
        titulo: String(titulo).trim(), descricao: descricao ? String(descricao) : null,
        frequencia: 'AVULSA', ordem: 5, dataRef, dataOriginal: dataRef,
        origem: 'DELEGADA', criadoPorId: session.sub, criadoPorNome: session.nome,
        atribuidoArea: alvo, prazo: prazo || null,
      },
    })
    criadas++
  }

  return NextResponse.json({ ok: true, criadas })
}
