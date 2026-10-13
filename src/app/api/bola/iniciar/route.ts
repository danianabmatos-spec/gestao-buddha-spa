import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const PERFIS_RECEP = ['DONA', 'RECEPCAO', 'COORDENACAO']

function horaSP(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)
}

// POST /api/bola/iniciar   { atendimentoId }
//   A TERAPEUTA marca o início real do atendimento (entrou na sala com o cliente).
//   A partir daqui o término previsto = agora + duração do serviço → define quando
//   ela volta a ficar livre pra bola. Idempotente: se já iniciou, devolve o início.
//   Recepção/coordenação também podem iniciar (correção), restritas à unidade.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { atendimentoId } = await req.json().catch(() => ({}))
  const id = Number(atendimentoId)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Atendimento inválido.' }, { status: 400 })

  const at = await prisma.bolaAtendimento.findUnique({ where: { id } })
  if (!at) return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })

  // Autorização: a própria terapeuta dona do atendimento, OU recepção/coordenação
  // da unidade (correção pontual).
  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  const ehDona = !!terapeuta && terapeuta.id === at.terapeutaId
  let ehRecep = false
  if (!ehDona && PERFIS_RECEP.includes(session.perfil)) {
    const permitidas = unidadesPermitidas(session)
    ehRecep = permitidas === null || permitidas.includes(at.unidadeSlug)
  }
  if (!ehDona && !ehRecep) {
    return NextResponse.json({ error: 'Sem permissão para iniciar este atendimento.' }, { status: 403 })
  }

  // Já iniciado → idempotente (não re-zera o cronômetro).
  if (at.iniciadoEm) {
    return NextResponse.json({ ok: true, jaIniciado: true, inicio: horaSP(at.iniciadoEm), termino: horaSP(at.fimPrevistoEm) })
  }

  const agora = new Date()
  const fim = new Date(agora.getTime() + (at.duracaoMin || 0) * 60_000)
  const upd = await prisma.bolaAtendimento.update({
    where: { id },
    data: { iniciadoEm: agora, fimPrevistoEm: fim },
  })

  return NextResponse.json({ ok: true, inicio: horaSP(upd.iniciadoEm!), termino: horaSP(upd.fimPrevistoEm) })
}
