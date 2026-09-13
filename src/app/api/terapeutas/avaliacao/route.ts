import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { normalizarNome } from '@/lib/rh/terapeutas-ativos'

const PERFIS_RESTRITO = new Set(['DONA', 'RH', 'FINANCEIRO'])

// Salva a Avaliação do Gestor (−1 a +1) de um terapeuta no semestre.
// Só DONA/RH/Financeiro podem lançar.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_RESTRITO.has(session.perfil)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const unidade = String(body.unidade || '').trim()
  const periodo = String(body.periodo || '').trim()
  const terapeutaNome = String(body.terapeutaNome || '').trim()
  const bruto = body.avaliacaoGestor

  if (!unidade || !periodo || !terapeutaNome) {
    return NextResponse.json({ error: 'unidade, periodo e terapeutaNome são obrigatórios' }, { status: 400 })
  }

  // null limpa a nota; senão precisa ser número entre −1 e +1.
  let avaliacaoGestor: number | null
  if (bruto === null || bruto === '' || bruto === undefined) {
    avaliacaoGestor = null
  } else {
    const n = Number(bruto)
    if (!Number.isFinite(n) || n < -1 || n > 1) {
      return NextResponse.json({ error: 'avaliacaoGestor deve estar entre -1 e 1' }, { status: 400 })
    }
    avaliacaoGestor = n
  }

  const terapeutaChave = normalizarNome(terapeutaNome)

  await prisma.terapeutaAvaliacao.upsert({
    where: { unidadeSlug_terapeutaChave_periodo: { unidadeSlug: unidade, terapeutaChave, periodo } },
    create: { unidadeSlug: unidade, terapeutaChave, terapeutaNome, periodo, avaliacaoGestor },
    update: { avaliacaoGestor, atualizadoEm: new Date() },
  })

  return NextResponse.json({ ok: true, avaliacaoGestor })
}
