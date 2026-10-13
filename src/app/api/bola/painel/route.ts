import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { montarEstadoBola, escolherDoEstado } from '@/lib/bola/dados'
import { hhmmToMin, minToHHMM } from '@/lib/bola/motor'

export const dynamic = 'force-dynamic'

function parseAgora(v: string | null): number | undefined {
  if (!v || !/^\d{1,2}:\d{2}$/.test(v)) return undefined
  return hhmmToMin(v)
}

// GET /api/bola/painel?unidade=slug&agora=HH:MM
//   Estado da bola ao vivo (fila do banco + Belle: turno, preferencial, sala).
//   `agora` é opcional (simulação de horário para demonstração).
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const url = new URL(req.url)
  const unidade = resolveUnidade(session, url.searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const base = await montarEstadoBola(unidade, { agoraMin: parseAgora(url.searchParams.get('agora')) })

  // Bolas já passadas hoje → quadro "Cliente atendido" + tira o cliente da lista "Chegou cliente".
  const atendRaw = await prisma.bolaAtendimento.findMany({
    where: { unidadeSlug: unidade, data: base.data },
    include: { terapeuta: { select: { nome: true } } },
    orderBy: { inicioEm: 'desc' },
  })
  const fmtHora = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)
  const atendidos = atendRaw.map((a) => ({
    id: a.id,
    cliente: a.clienteNome,
    terapeuta: a.terapeuta?.nome ?? '',
    servicoNome: a.servicoNome,
    salaNome: a.salaNome,
    duracaoMin: a.duracaoMin,
    // HORA DO ENVIO DA BOLA (quando a terapeuta foi avisada) — NÃO o início da massagem.
    horaEnvio: fmtHora(a.inicioEm),
    // INÍCIO REAL (terapeuta clicou "Iniciar") e término previsto — o que a recepção quer saber.
    iniciado: !!a.iniciadoEm,
    inicioReal: a.iniciadoEm ? fmtHora(a.iniciadoEm) : null,
    terminaPrev: a.iniciadoEm ? fmtHora(a.fimPrevistoEm) : null,
  }))
  const passados = new Set(atendRaw.map((a) => String(a.belleAgendaId)).filter((x) => x && x !== 'null'))
  const clientes = base.clientes.filter((c) => !passados.has(String(c.codConsulta)))

  return NextResponse.json({
    unidade: base.unidade,
    data: base.data,
    agora: minToHHMM(base.agoraMin),
    turnoAtivo: base.turnoAtivo,
    aguardando: base.aguardando, // terapeutas do próximo turno (entram quando o ativo sair)
    fila: base.estado.map((e) => ({
      terapeutaId: e.terapeuta.id, // cod do Belle
      terapeutaIdDb: base._codParaId[e.terapeuta.id] ?? null, // id do nosso Terapeuta (p/ remover)
      nome: e.terapeuta.nome,
      chegada: minToHHMM(e.chegadaMin),
      rodadas: e.rodadas,
      status: e.status.tipo,
      detalhe:
        e.status.tipo === 'EM_ATENDIMENTO'
          ? { ate: minToHHMM(e.status.ateMin), cliente: e.status.cliente ?? null }
          : e.status.tipo === 'RESERVADA'
            ? { inicio: minToHHMM(e.status.preferencialInicioMin), cliente: e.status.cliente }
            : null,
    })),
    disponiveis: base.disponiveis, // terapeutas do dia que a recepção pode marcar chegada
    clientes, // clientes da agenda do Belle (recepção toca ao chegar) — sem os já passados
    atendidos, // bolas já passadas hoje (quadro "Cliente atendido", com hora do envio)
  })
}

// POST /api/bola/painel?unidade=slug
//   body: { agora?: "HH:MM", servicoCod, servicoNome, duracaoMin, generoPref?: "F"|"M", salaNome? }
//   Decide a próxima terapeuta para um cliente que chegou.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const url = new URL(req.url)
  const unidade = resolveUnidade(session, url.searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { agora, servicoCod, servicoNome, duracaoMin, generoPref, salaNome } = body
  if (!servicoNome || !duracaoMin) {
    return NextResponse.json({ error: 'Informe servicoNome e duracaoMin.' }, { status: 400 })
  }

  const base = await montarEstadoBola(unidade, { agoraMin: parseAgora(agora ?? null) })
  const r = escolherDoEstado(base, {
    servicoCod: Number(servicoCod) || 0,
    servicoNome,
    duracaoMin: Number(duracaoMin),
    generoPref: generoPref === 'M' || generoPref === 'F' ? generoPref : null,
    salaNome: salaNome || undefined,
  })

  return NextResponse.json({
    escolhida: r.escolhida ? { id: r.escolhida.id, nome: r.escolhida.nome } : null,
    salaBelle: r.salaBelle,
    motivo: r.motivo,
    ordem: r.ordem.map((c) => ({
      nome: c.terapeuta.nome,
      rodadas: c.rodadas,
      elegivel: c.elegivel,
      motivo: c.motivo,
    })),
  })
}
