import { NextRequest, NextResponse } from 'next/server'
import { syncAtendimentosUnidade } from '@/lib/atendimentos/sync'
import { getUnidadesDisponiveis } from '@/lib/belle/unidades-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// POST /api/cron/sync-atendimentos[?unidade=slug&dataIni=YYYY-MM-DD&dataFim=YYYY-MM-DD]
// Puxa os atendimentos do Belle pro gestao. Protegido por CRON_SECRET quando definido.
// Sem `unidade` → todas as unidades. Sem datas → hoje.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const unidade = sp.get('unidade')
  const dataIni = sp.get('dataIni') || hojeISO()
  const dataFim = sp.get('dataFim') || dataIni
  const slugs = unidade ? [unidade] : getUnidadesDisponiveis()

  const resultados: Record<string, unknown> = {}
  for (const slug of slugs) {
    try {
      resultados[slug] = await syncAtendimentosUnidade(slug, dataIni, dataFim)
    } catch (e) {
      resultados[slug] = { erro: (e as Error).message }
    }
  }

  return NextResponse.json({ ok: true, dataIni, dataFim, resultados })
}
