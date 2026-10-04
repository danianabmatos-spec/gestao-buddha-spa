import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { recalcularResumoDia } from '@/lib/conciliacao/motor'

export const dynamic = 'force-dynamic'

// POST /api/financeiro/classificar
// Body: { fonteIds: number[], planoContaId: number }  (ou desclassificar: planoContaId=null)
// Classifica em LOTE entradas do banco numa conta do plano de contas → alimentam a DRE.
// Resolve a divergência ligada (FALTA_NO_BELLE) de cada entrada. Só FINANCEIRO/DONA.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO') {
      return NextResponse.json({ error: 'Só o financeiro ou a dona/dono pode classificar entradas' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const fonteIds: number[] = Array.isArray(body?.fonteIds) ? body.fonteIds.map(Number).filter(Boolean) : []
    const desclassificar = body?.planoContaId === null
    const planoContaId = desclassificar ? null : Number(body?.planoContaId) || null
    if (!fonteIds.length) return NextResponse.json({ error: 'Nenhuma entrada selecionada' }, { status: 400 })
    if (!desclassificar && !planoContaId) return NextResponse.json({ error: 'Escolha uma conta do plano de contas' }, { status: 400 })

    let conta: { id: number; nome: string } | null = null
    if (planoContaId) {
      conta = await prisma.planoConta.findUnique({ where: { id: planoContaId }, select: { id: true, nome: true } })
      if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    }

    const permitidas = unidadesPermitidas(session)
    const fontes = await prisma.fonteExterna.findMany({ where: { id: { in: fonteIds }, origem: 'BANCO_PIX' } })
    const diasAfetados = new Map<number, Set<string>>() // unidadeId → datas

    let ok = 0
    for (const f of fontes) {
      // Escopo: a unidade da fonte precisa estar entre as permitidas.
      if (permitidas !== null) {
        const u = await prisma.unidade.findUnique({ where: { id: f.unidadeId }, select: { slug: true } })
        if (!u || !permitidas.includes(u.slug)) continue
      }

      if (desclassificar) {
        await prisma.fonteExterna.update({ where: { id: f.id }, data: { planoContaId: null, statusMatch: 'SEM_PAR', classificadoEm: null, classificadoPor: null } })
        // Reabre a divergência da entrada (volta a ser "falta no Belle" a tratar).
        await prisma.divergencia.updateMany({
          where: { fonteExternaId: f.id, status: 'CONCILIADA' },
          data: { status: 'ABERTA', justificativa: null, reprocessadaEm: new Date() },
        })
      } else {
        await prisma.fonteExterna.update({
          where: { id: f.id },
          data: { planoContaId: conta!.id, statusMatch: 'CLASSIFICADA', classificadoEm: new Date(), classificadoPor: session.nome },
        })
        await prisma.divergencia.updateMany({
          where: { fonteExternaId: f.id, status: { in: ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA'] } },
          data: { status: 'CONCILIADA', justificativa: `Classificado em: ${conta!.nome}`, reprocessadaEm: new Date() },
        })
      }
      if (!diasAfetados.has(f.unidadeId)) diasAfetados.set(f.unidadeId, new Set())
      diasAfetados.get(f.unidadeId)!.add(f.data)
      ok++
    }

    for (const [unidadeId, datas] of diasAfetados) {
      for (const data of datas) await recalcularResumoDia(unidadeId, data)
    }

    return NextResponse.json({ success: true, classificadas: ok })
  } catch (error) {
    console.error('[Financeiro/Classificar] Erro:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao classificar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
