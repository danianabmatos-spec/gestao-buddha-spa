import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
function horaSP(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)
}

// GET /api/bola/meus-atendimentos
//   Atendimentos de HOJE da terapeuta logada, vindos da BOLA (rodízio) — em tempo
//   real, sem depender do sync do Belle. Serve pra ela registrar a recomendação
//   logo após a sessão. A chave sintética "bola:<id>" é reconciliada com o belleId
//   real quando o Belle sincroniza (ver lib/atendimentos/sync.ts).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ terapeuta: false, atendimentos: [] })

  const data = hojeBrasilia()
  const lista = await prisma.bolaAtendimento.findMany({
    where: { terapeutaId: terapeuta.id, data },
    orderBy: { inicioEm: 'asc' },
  })

  // Pré-preenche a recomendação já registrada (se houver) por bola:<id>.
  const belleIds = lista.map((b) => `bola:${b.id}`)
  const recs = belleIds.length
    ? await prisma.recomendacao.findMany({ where: { belleId: { in: belleIds } }, include: { itens: true } })
    : []
  const recPorBelle = new Map(recs.map((r) => [r.belleId, r]))

  const atendimentos = lista.map((b) => {
    const r = recPorBelle.get(`bola:${b.id}`)
    return {
      belleId: `bola:${b.id}`,
      bolaId: b.id,
      clienteNome: b.clienteNome || 'Cliente',
      servico: b.servicoNome,
      hora: horaSP(b.inicioEm),
      data: b.data,
      statusValidacao: 'CONFIRMADO',
      observacaoContestacao: null,
      iniciado: !!b.iniciadoEm,
      inicioReal: b.iniciadoEm ? horaSP(b.iniciadoEm) : null,
      terminaPrev: b.iniciadoEm ? horaSP(b.fimPrevistoEm) : null,
      recomendacao: r
        ? {
            notaSono: r.notaSono, notaEnergia: r.notaEnergia, notaEstresse: r.notaEstresse,
            pontosTensao: r.pontosTensao, retorno: r.retorno, observacao: r.observacao,
            temFoto: !!r.fotoPath, itens: r.itens.map((i) => i.tipo),
          }
        : null,
    }
  })

  return NextResponse.json({ terapeuta: true, atendimentos })
}
