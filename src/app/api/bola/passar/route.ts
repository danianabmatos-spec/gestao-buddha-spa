import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { montarEstadoBola, escolherDoEstado, hojeBrasilia } from '@/lib/bola/dados'
import { hhmmToMin } from '@/lib/bola/motor'
import { montarAnuncioBola, enviarAnuncioGrupo } from '@/lib/bola/whatsapp'

export const dynamic = 'force-dynamic'

function parseAgora(v: unknown): number | undefined {
  if (typeof v !== 'string' || !/^\d{1,2}:\d{2}$/.test(v)) return undefined
  return hhmmToMin(v)
}

// POST /api/bola/passar?unidade=slug
//   body: { servicoCod, servicoNome, duracaoMin, generoPref?, salaNome?, clienteNome?, terapeutaCod?, agora? }
//   "Passa a bola": grava o atendimento (fonte de ocupado/rodadas) e dispara o
//   anúncio no grupo (robô — hoje em dry-run pela trava BOLA_WHATSAPP_ATIVO).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const unidade = resolveUnidade(session, new URL(req.url).searchParams.get('unidade'))
  if (!unidade) return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { servicoCod, servicoNome, duracaoMin, generoPref, salaNome, clienteNome, terapeutaCod } = body
  if (!servicoNome || !duracaoMin) {
    return NextResponse.json({ error: 'Informe servicoNome e duracaoMin.' }, { status: 400 })
  }

  const base = await montarEstadoBola(unidade, { agoraMin: parseAgora(body.agora) })

  // quem recebe a bola: cod escolhido pela recepção OU a decisão do motor
  let cod: string | null = null
  if (terapeutaCod && base._porCod[String(terapeutaCod)]) {
    cod = String(terapeutaCod)
  } else {
    const r = escolherDoEstado(base, {
      servicoCod: Number(servicoCod) || 0,
      servicoNome,
      duracaoMin: Number(duracaoMin),
      generoPref: generoPref === 'M' || generoPref === 'F' ? generoPref : null,
      salaNome: salaNome || undefined,
    })
    cod = r.escolhida?.id ?? null
  }
  if (!cod) {
    return NextResponse.json({ error: 'Nenhuma terapeuta disponível para este pedido.' }, { status: 409 })
  }

  const terapeutaNome = base._porCod[cod]?.nome ?? cod
  const terapeutaId = base._codParaId[cod]
  if (!terapeutaId) {
    return NextResponse.json(
      { error: `Terapeuta "${terapeutaNome}" não está no cadastro do sistema. Sincronize as terapeutas antes de passar a bola.` },
      { status: 409 }
    )
  }

  // grava o atendimento (início = agora real; fim = agora + duração)
  const inicio = new Date()
  const fim = new Date(inicio.getTime() + Number(duracaoMin) * 60_000)
  const atendimento = await prisma.bolaAtendimento.create({
    data: {
      unidadeSlug: unidade,
      terapeutaId,
      data: hojeBrasilia(),
      clienteNome: clienteNome || null,
      servicoNome,
      servicoCod: Number(servicoCod) || null,
      duracaoMin: Number(duracaoMin),
      salaNome: salaNome || null,
      preferencial: false,
      inicioEm: inicio,
      fimPrevistoEm: fim,
    },
  })

  // anúncio no grupo (dry-run enquanto a trava estiver desligada)
  const mensagem = montarAnuncioBola({
    terapeutaNome,
    clienteNome,
    servicoNome,
    duracaoMin: Number(duracaoMin),
    salaNome,
  })
  const envio = await enviarAnuncioGrupo(unidade, mensagem)

  return NextResponse.json({
    ok: true,
    atendimentoId: atendimento.id,
    terapeuta: { cod, nome: terapeutaNome },
    salaBelle: salaNome || null,
    mensagem,
    whatsapp: { enviado: envio.enviado, motivo: envio.motivo },
  })
}
