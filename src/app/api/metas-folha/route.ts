import { NextRequest, NextResponse } from 'next/server'
import { getMetasFolha } from '@/lib/folha/metas'

export const dynamic = 'force-dynamic'

// Metas e premiações OFICIAIS (fonte = app Folha). Lê ao vivo do Folha (com cache
// de fallback). Usada pelo menu Meta de cada unidade.
export async function GET(req: NextRequest) {
  const ano = Number(req.nextUrl.searchParams.get('ano') || '2026')
  const dados = await getMetasFolha(ano)
  if (!dados) {
    return NextResponse.json({ error: 'Não foi possível obter as metas do Folha' }, { status: 502 })
  }
  return NextResponse.json(dados)
}
