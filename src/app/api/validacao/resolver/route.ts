import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { syncAtendimentosUnidade } from '@/lib/atendimentos/sync'

export const dynamic = 'force-dynamic'

// POST /api/validacao/resolver  { belleId, resolucao: 'AJUSTADO' | 'REJEITADO', respostaCoord? }
// A coordenadora resolve uma contestação: AJUSTADO (conta na comissão) ou
// REJEITADO (não conta). Guarda a resposta da coordenação.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!['DONA', 'COORDENACAO', 'RECEPCAO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  const { belleId, resolucao, respostaCoord } = await req.json().catch(() => ({}))
  if (!belleId || !['AJUSTADO', 'REJEITADO'].includes(resolucao)) {
    return NextResponse.json({ error: 'Informe belleId e a resolução (AJUSTADO ou REJEITADO).' }, { status: 400 })
  }

  const at = await prisma.atendimento.findUnique({ where: { belleId: String(belleId) } })
  if (!at) return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })

  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(at.unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  const atualizado = await prisma.atendimento.update({
    where: { belleId: at.belleId },
    data: {
      statusValidacao: resolucao,
      respostaCoord: respostaCoord ? String(respostaCoord).trim() : null,
    },
  })

  // AJUSTADO = corrigido no Belle → re-sincroniza o dia pra PUXAR o dado corrigido
  // (serviço/valor), senão a terapeuta continua vendo a terapia errada. O sync
  // preserva o statusValidacao. Isolado: falha no Belle não derruba a resolução.
  let resync: { gravados: number } | null = null
  if (resolucao === 'AJUSTADO') {
    try {
      const r = await syncAtendimentosUnidade(at.unidadeSlug, at.data, at.data)
      resync = { gravados: r.gravados }
    } catch (e) {
      console.error('[validacao/resolver] re-sync Belle:', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ ok: true, statusValidacao: atualizado.statusValidacao, resync })
}
