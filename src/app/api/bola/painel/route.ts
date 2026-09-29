import { NextRequest, NextResponse } from 'next/server'
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

  return NextResponse.json({
    unidade: base.unidade,
    data: base.data,
    agora: minToHHMM(base.agoraMin),
    fila: base.estado.map((e) => ({
      terapeutaId: e.terapeuta.id,
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
