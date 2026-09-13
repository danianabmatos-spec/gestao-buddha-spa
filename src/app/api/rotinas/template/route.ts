import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

function slug(s: string): string {
  // NFD separa o acento da letra; removemos tudo que não é ASCII (as marcas de acento).
  return s.normalize('NFD').replace(/[^\x00-\x7F]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'rotina'
}

// POST /api/rotinas/template
// { unidade, area, titulo, descricao?, frequencia: 'SEMANAL'|'MENSAL', diaSemana?, diaDoMes?, diaLimite? }
// Cria uma ROTINA recorrente (repete toda semana/mês). Fica vinculada à unidade
// escolhida (flexibilidade por unidade). Dona/Coordenação criam; Recepção não.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil === 'RECEPCAO') {
    return NextResponse.json({ error: 'Recepção não cria rotinas recorrentes.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { titulo, descricao, frequencia } = body
  const alvo = body.area === 'RECEPCAO' ? 'RECEPCAO' : 'COORDENACAO'

  const slugs: string[] = Array.isArray(body.unidades) && body.unidades.length
    ? body.unidades
    : body.unidade ? [body.unidade] : []

  if (!slugs.length || !titulo?.trim()) {
    return NextResponse.json({ error: 'Informe unidade(s) e título.' }, { status: 400 })
  }
  if (slugs.length > 1 && session.perfil !== 'DONA') {
    return NextResponse.json({ error: 'Só a dona aplica em várias unidades.' }, { status: 403 })
  }
  if (frequencia !== 'SEMANAL' && frequencia !== 'MENSAL') {
    return NextResponse.json({ error: 'Frequência inválida.' }, { status: 400 })
  }

  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && slugs.some((s) => !permitidas.includes(s))) {
    return NextResponse.json({ error: 'Sem acesso a alguma unidade selecionada.' }, { status: 403 })
  }

  const diaSemana = frequencia === 'SEMANAL' ? Number(body.diaSemana) : null
  const diaDoMes = frequencia === 'MENSAL' ? Number(body.diaDoMes) : null
  const diaLimite = frequencia === 'MENSAL' && body.diaLimite ? Number(body.diaLimite) : null

  if (frequencia === 'SEMANAL' && !(diaSemana! >= 0 && diaSemana! <= 6)) {
    return NextResponse.json({ error: 'Dia da semana inválido.' }, { status: 400 })
  }
  if (frequencia === 'MENSAL' && !(diaDoMes! >= 1 && diaDoMes! <= 28)) {
    return NextResponse.json({ error: 'Dia do mês inválido (1 a 28).' }, { status: 400 })
  }

  const unidades = await prisma.unidade.findMany({ where: { slug: { in: slugs } }, select: { id: true } })
  if (!unidades.length) return NextResponse.json({ error: 'Unidade(s) inexistente(s).' }, { status: 404 })

  const base = slug(String(titulo))
  let criadas = 0
  for (const u of unidades) {
    await prisma.rotinaTemplate.create({
      data: {
        chave: `custom-${u.id}-${base}-${Date.now().toString(36)}-${criadas}`,
        titulo: String(titulo).trim(), descricao: descricao ? String(descricao) : null,
        area: alvo, frente: 'Personalizada', frequencia, ordem: 90,
        diaSemana, diaDoMes, diaLimite, unidadeId: u.id, ativa: true,
      },
    })
    criadas++
  }

  return NextResponse.json({ ok: true, criadas })
}
