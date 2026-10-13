import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { apurarPontuacao } from '@/lib/pontuacao/apurar'

export const dynamic = 'force-dynamic'

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// GET /api/minha-pontuacao — pontos do mês da TERAPEUTA logada (visão dela).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ terapeuta: null })

  const ref = mesAtual()
  const ap = await apurarPontuacao(terapeuta.unidadeSlug, ref)
  const alvos = new Set([norm(terapeuta.nome), norm(terapeuta.nomeBelle || '')].filter(Boolean))
  const idx = ap.porTerapeuta.findIndex((t) => alvos.has(norm(t.terapeutaNome)))
  const meus = idx >= 0
    ? ap.porTerapeuta[idx]
    : { terapeutaNome: terapeuta.nome, voucher: 0, agendamento: 0, produto: 0, pacote: 0, total: 0 }

  return NextResponse.json({
    terapeuta: { nome: terapeuta.nome },
    ref,
    meus,
    posicao: idx >= 0 ? idx + 1 : null,
    totalTerapeutas: ap.porTerapeuta.length,
    totalUnidade: ap.totalUnidade,
    metaPremio: ap.metaPremio,
    premioAtivo: ap.premioAtivo,
  })
}
