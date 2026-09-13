import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

const PERFIS_RESTRITO = new Set(['DONA', 'RH', 'FINANCEIRO'])
const CAMPOS = ['pesoProdutividade', 'pesoFidelizacao', 'pesoNps', 'pesoRecomendacao', 'pesoTreinamento', 'pesoColegas'] as const

// Salva os 6 pesos (soma = 100) de uma unidade. Só DONA/RH/Financeiro.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_RESTRITO.has(session.perfil)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const unidade = String(body.unidade || '').trim()
  if (!unidade) return NextResponse.json({ error: 'unidade obrigatória' }, { status: 400 })

  const pesos: Record<string, number> = {}
  for (const c of CAMPOS) {
    const n = Number(body[c])
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: `peso inválido em ${c}` }, { status: 400 })
    }
    pesos[c] = n
  }
  const soma = CAMPOS.reduce((s, c) => s + pesos[c], 0)
  if (Math.abs(soma - 100) > 0.01) {
    return NextResponse.json({ error: `a soma dos pesos deve ser 100 (atual: ${soma})` }, { status: 400 })
  }

  await prisma.terapeutaPesos.upsert({
    where: { unidadeSlug: unidade },
    create: { unidadeSlug: unidade, ...pesos },
    update: { ...pesos, atualizadoEm: new Date() },
  })

  return NextResponse.json({ ok: true })
}
