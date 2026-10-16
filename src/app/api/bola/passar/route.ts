import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { montarEstadoBola, escolherDoEstado, hojeBrasilia } from '@/lib/bola/dados'
import { hhmmToMin } from '@/lib/bola/motor'
import { montarAnuncioBola, enviarAnuncioGrupo } from '@/lib/bola/whatsapp'
import { getTelefonesTerapeutasRH, normalizarNome } from '@/lib/rh/terapeutas-ativos'

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
  const { servicoCod, servicoNome, duracaoMin, generoPref, salaNome, clienteNome, terapeutaCod, codConsulta } = body
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
      belleAgendaId: codConsulta != null ? String(codConsulta) : null,
      inicioEm: inicio,
      fimPrevistoEm: fim,
    },
  })

  // Outros atendimentos do MESMO cliente hoje (agenda do Belle), ainda NÃO passados
  // pela bola → avisa o grupo que esse cliente terá mais atendimentos na sequência
  // (cada um será passado pela bola, não necessariamente com a mesma terapeuta).
  let outrosAtendimentos: { servicoNome: string; duracaoMin: number }[] = []
  if (clienteNome) {
    const jaPassados = new Set(
      (await prisma.bolaAtendimento.findMany({ where: { unidadeSlug: unidade, data: hojeBrasilia() }, select: { belleAgendaId: true } }))
        .map((x) => String(x.belleAgendaId)).filter((x) => x && x !== 'null'),
    )
    const nc = normalizarNome(clienteNome)
    outrosAtendimentos = base.clientes
      .filter((c) => normalizarNome(c.cliente) === nc
        && String(c.codConsulta) !== String(codConsulta)
        && !jaPassados.has(String(c.codConsulta)))
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((c) => ({ servicoNome: c.servicoNome, duracaoMin: c.duracaoMin }))
  }

  // anúncio no grupo (dry-run enquanto a trava estiver desligada)
  const mensagem = montarAnuncioBola({
    terapeutaNome,
    clienteNome,
    servicoNome,
    duracaoMin: Number(duracaoMin),
    salaNome,
    outrosAtendimentos,
  })
  // Telefone da terapeuta (RH, por nome) → @menção no grupo + alerta privado (DM) no
  // celular dela. Best-effort: se não achar o número, cai no anúncio normal.
  let telTerapeuta: string | null = null
  try { telTerapeuta = (await getTelefonesTerapeutasRH())?.resolve(normalizarNome(terapeutaNome)) ?? null } catch { telTerapeuta = null }
  const soPrimeiro = (n?: string | null) => (n ? n.trim().split(/\s+/)[0] : '')
  const dmTexto = telTerapeuta
    ? `🔔 ${soPrimeiro(terapeutaNome)}, é a sua vez na bola!\n${clienteNome ? soPrimeiro(clienteNome) + ' · ' : ''}${servicoNome} (${Number(duracaoMin)}min)${salaNome ? ' · Sala ' + salaNome : ''}\nPrepare a sala e chame o cliente 🌿`
    : null
  const envio = await enviarAnuncioGrupo(unidade, mensagem, 'agenda', { mencionarTelefone: telTerapeuta, dmTexto })

  return NextResponse.json({
    ok: true,
    atendimentoId: atendimento.id,
    terapeuta: { cod, nome: terapeutaNome },
    salaBelle: salaNome || null,
    mensagem,
    whatsapp: { enviado: envio.enviado, motivo: envio.motivo },
  })
}
