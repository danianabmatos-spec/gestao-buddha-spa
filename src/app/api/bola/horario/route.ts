import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const PERFIS_RECEP = ['DONA', 'RECEPCAO', 'COORDENACAO']
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

function horaSP(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)
}
function pad(hhmm: string): string {
  const [h, m] = hhmm.split(':')
  return `${h.padStart(2, '0')}:${m}`
}

// POST /api/bola/horario
//   { atendimentoId, inicio: "HH:MM", fim?: "HH:MM" }  → inclui/edita o horário real
//   { atendimentoId, finalizarAgora: true }            → atalho: finaliza AGORA
//   A recepção (ou a terapeuta) ajusta o horário do atendimento da bola, inclusive
//   retroativo. Serve pra quando a terapeuta esquece de marcar o início: sem isso ela
//   fica "aguardando iniciar" pra sempre → OCUPADA → não recebe novas bolas. Com o
//   horário (ou o "finalizar agora"), a ocupação reflete o real e ela volta pra bola.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { atendimentoId, inicio, fim, finalizarAgora } = await req.json().catch(() => ({}))
  const id = Number(atendimentoId)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Atendimento inválido.' }, { status: 400 })

  const at = await prisma.bolaAtendimento.findUnique({ where: { id } })
  if (!at) return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })

  // Autorização: a terapeuta dona OU recepção/coordenação da unidade.
  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  const ehDona = !!terapeuta && terapeuta.id === at.terapeutaId
  let ehRecep = false
  if (!ehDona && PERFIS_RECEP.includes(session.perfil)) {
    const permitidas = unidadesPermitidas(session)
    ehRecep = permitidas === null || permitidas.includes(at.unidadeSlug)
  }
  if (!ehDona && !ehRecep) {
    return NextResponse.json({ error: 'Sem permissão para ajustar este atendimento.' }, { status: 403 })
  }

  let iniciadoEm: Date
  let fimPrevistoEm: Date

  // Atalho "finalizar agora": término = agora; se nunca iniciou, assume uma sessão de
  // duração normal terminando agora (início = agora − duração). Libera a terapeuta já.
  if (finalizarAgora) {
    const agora = new Date()
    iniciadoEm = at.iniciadoEm ?? new Date(agora.getTime() - (at.duracaoMin || 0) * 60_000)
    fimPrevistoEm = agora
  } else {
    if (typeof inicio !== 'string' || !HHMM.test(inicio)) {
      return NextResponse.json({ error: 'Informe o horário de início (HH:MM).' }, { status: 400 })
    }
    const temFim = fim != null && String(fim) !== ''
    if (temFim && !HHMM.test(String(fim))) {
      return NextResponse.json({ error: 'Horário de fim inválido (HH:MM).' }, { status: 400 })
    }
    // Datetimes no dia do atendimento. O servidor roda em America/Sao_Paulo, então
    // "YYYY-MM-DDTHH:MM:00" (sem Z) é interpretado como horário local de São Paulo.
    iniciadoEm = new Date(`${at.data}T${pad(inicio)}:00`)
    if (temFim) {
      fimPrevistoEm = new Date(`${at.data}T${pad(String(fim))}:00`)
      if (fimPrevistoEm.getTime() <= iniciadoEm.getTime()) {
        return NextResponse.json({ error: 'O fim deve ser depois do início.' }, { status: 400 })
      }
    } else {
      fimPrevistoEm = new Date(iniciadoEm.getTime() + (at.duracaoMin || 0) * 60_000)
    }
  }

  const upd = await prisma.bolaAtendimento.update({
    where: { id },
    data: { iniciadoEm, fimPrevistoEm },
  })
  return NextResponse.json({ ok: true, inicio: horaSP(upd.iniciadoEm!), termino: horaSP(upd.fimPrevistoEm) })
}
