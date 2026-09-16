import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ACOES = ['PERMISSAO_EDITAR', 'PERMISSAO_REVISAR', 'PERFIL_CRIAR', 'PERFIL_EDITAR', 'PERFIL_REMOVER']

// Histórico de mudanças de acessos/permissões (só DONA). Lê o LogAuditoria.
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  try {
    const logs = await prisma.logAuditoria.findMany({
      where: { acao: { in: ACOES } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { usuario: { select: { nome: true } } },
    })
    const itens = logs.map(l => {
      let dados: Record<string, unknown> = {}
      try { dados = JSON.parse(l.dados || '{}') } catch {}
      return {
        id: l.id,
        quando: l.createdAt,
        quem: l.usuario?.nome || l.usuarioId,
        acao: l.acao,
        entidade: l.entidade,
        dados,
      }
    })
    return NextResponse.json({ itens })
  } catch (e) {
    console.error('Erro ao ler auditoria de permissões:', e)
    return NextResponse.json({ error: 'Erro ao carregar auditoria' }, { status: 500 })
  }
}
