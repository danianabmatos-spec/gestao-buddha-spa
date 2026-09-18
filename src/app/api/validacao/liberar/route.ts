import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas, resolveUnidade } from '@/lib/auth/guard'
import { enviarLoteFolha } from '@/lib/folha/enviar-lote'

export const dynamic = 'force-dynamic'

// POST /api/validacao/liberar  { unidade, ref, forcar? }
// "Libera" o fechamento do mês da unidade (a partir daqui o lote confirmado vai ao
// Folha — F2/task 6). Só libera se não houver PENDENTE nem CONTESTADO em aberto.
// `forcar` (coordenação/dona): confirma os PENDENTE restantes automaticamente.
// Contestações SEMPRE precisam ser resolvidas antes (nunca são forçadas).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA' && session.perfil !== 'COORDENACAO') {
    return NextResponse.json({ error: 'Acesso restrito à coordenação.' }, { status: 403 })
  }

  const { unidade, ref, forcar } = await req.json().catch(() => ({}))
  const unidadeSlug = resolveUnidade(session, unidade ?? null)
  if (!unidadeSlug || !ref) {
    return NextResponse.json({ error: 'Informe unidade e mês (ref).' }, { status: 400 })
  }
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  const where = { unidadeSlug, fechamentoRef: String(ref) }
  const contestados = await prisma.atendimento.count({ where: { ...where, statusValidacao: 'CONTESTADO' } })
  if (contestados > 0) {
    return NextResponse.json({ error: `Há ${contestados} contestação(ões) em aberto. Resolva antes de liberar.` }, { status: 400 })
  }

  const pendentes = await prisma.atendimento.count({ where: { ...where, statusValidacao: 'PENDENTE' } })
  let forcadoInfo: { terapeuta: string; pendentes: number }[] = []
  if (pendentes > 0) {
    if (!forcar) {
      return NextResponse.json({ error: `Há ${pendentes} atendimento(s) ainda não validado(s).`, pendentes }, { status: 400 })
    }
    // Captura QUEM não validou (por terapeuta) ANTES de confirmar — o RH vê na folha.
    const grp = await prisma.atendimento.groupBy({
      by: ['terapeutaNome'],
      where: { ...where, statusValidacao: 'PENDENTE' },
      _count: { _all: true },
    })
    forcadoInfo = grp.map((g) => ({ terapeuta: g.terapeutaNome, pendentes: g._count._all }))
    // Força: confirma os pendentes em nome da coordenação.
    await prisma.atendimento.updateMany({ where: { ...where, statusValidacao: 'PENDENTE' }, data: { statusValidacao: 'CONFIRMADO' } })
  }

  const foiForcado = pendentes > 0 && !!forcar
  const fech = await prisma.fechamentoValidacao.upsert({
    where: { unidadeSlug_ref: { unidadeSlug, ref: String(ref) } },
    create: { unidadeSlug, ref: String(ref), liberado: true, liberadoEm: new Date(), liberadoPorNome: session.nome, forcado: foiForcado, forcadoInfo: foiForcado ? JSON.stringify(forcadoInfo) : null },
    update: { liberado: true, liberadoEm: new Date(), liberadoPorNome: session.nome, forcado: foiForcado, forcadoInfo: foiForcado ? JSON.stringify(forcadoInfo) : null },
  })

  // Envia o LOTE confirmado ao Folha (com forcado/forcadoInfo p/ o RH). Best-effort:
  // se o Folha estiver fora, a liberação no gestao permanece e o reenvio fica pendente.
  const folha = await enviarLoteFolha({
    unidadeSlug,
    ref: String(ref),
    forcado: foiForcado,
    forcadoInfo,
    liberadoPorNome: session.nome,
  })

  return NextResponse.json({ ok: true, liberado: fech.liberado, forcado: foiForcado, forcadoInfo, folha })
}
