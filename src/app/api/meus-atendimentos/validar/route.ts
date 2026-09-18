import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// POST /api/meus-atendimentos/validar
//   { belleId, status: 'CONFIRMADO' | 'CONTESTADO' | 'PENDENTE', observacaoContestacao? }
// A terapeuta valida (ou contesta) UM atendimento seu. Tudo fica no gestao; no
// fechamento o lote confirmado/corrigido é enviado ao folha.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ error: 'Usuário não é uma terapeuta.' }, { status: 403 })

  const { belleId, status, observacaoContestacao } = await req.json().catch(() => ({}))
  if (!belleId || !['CONFIRMADO', 'CONTESTADO', 'PENDENTE'].includes(status)) {
    return NextResponse.json({ error: 'Informe belleId e um status válido.' }, { status: 400 })
  }
  if (status === 'CONTESTADO' && !String(observacaoContestacao || '').trim()) {
    return NextResponse.json({ error: 'Descreva o motivo da contestação.' }, { status: 400 })
  }

  const at = await prisma.atendimento.findUnique({ where: { belleId: String(belleId) } })
  if (!at || at.terapeutaId !== terapeuta.id) {
    return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })
  }

  const atualizado = await prisma.atendimento.update({
    where: { belleId: at.belleId },
    data: {
      statusValidacao: status,
      observacaoContestacao: status === 'CONTESTADO' ? String(observacaoContestacao).trim() : null,
    },
  })

  return NextResponse.json({ ok: true, statusValidacao: atualizado.statusValidacao })
}
