import { NextRequest, NextResponse } from 'next/server'
import { getUnidadesDisponiveis } from '@/lib/belle/unidades-config'
import { ingerirMovimentacoes } from '@/lib/conciliacao/ingestao-belle'
import { ingerirVouchers } from '@/lib/conciliacao/ingestao-vouchers'

// ─── CRON · Conciliação diária ──────────────────────────────────────────────────
// Acionado pelo cron da VPS (fora do login). Autentica por CRON_SECRET
// (header x-cron-secret ou ?token=). Puxa as movimentações do Belle (Report 103)
// das 7 unidades para ONTEM+HOJE (janela que cobre confirmações lançadas com
// atraso) e recalcula o resumo ConciliacaoDia.
//
// Instalar na VPS (ex.: todo dia às 03h):
//   0 3 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://gestao.solcentral.com.br/api/cron/conciliacao

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const emExecucao = new Set<string>()

function fmtSP(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sem segredo configurado → endpoint desativado
  const header = req.headers.get('x-cron-secret')
  const token = header || new URL(req.url).searchParams.get('token')
  return token === secret
}

async function runConciliacao(slugs: string[], dataIni: string, dataFim: string) {
  for (const slug of slugs) {
    if (emExecucao.has(slug)) continue
    emExecucao.add(slug)
    try {
      const r = await ingerirMovimentacoes(slug, dataIni, dataFim)
      // Vouchers USADOS do site (Report 2422, só E-commerce) — lado que casa com o WordPress.
      let vch = 0
      try { vch = (await ingerirVouchers(slug, dataIni, dataFim)).usados } catch (ev) {
        console.error(`[cron-conciliacao] vouchers ${slug}:`, ev instanceof Error ? ev.message : ev)
      }
      console.log(`[cron-conciliacao] ${slug}: ${r.gravadas} movimentações + ${vch} vouchers (${dataIni}→${dataFim})`)
    } catch (err) {
      console.error(`[cron-conciliacao] ${slug}: erro —`, err instanceof Error ? err.message : String(err))
    } finally {
      emExecucao.delete(slug)
    }
  }
  console.log('[cron-conciliacao] concluído')
}

async function handle(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const hoje = fmtSP(new Date())
  const ontem = fmtSP(new Date(Date.now() - 24 * 60 * 60 * 1000))
  // Período: por padrão ontem→hoje (rotina diária); aceita ?dataIni&dataFim p/ reprocessar um intervalo.
  const sp = req.nextUrl.searchParams
  const dataIni = (sp.get('dataIni') || ontem).slice(0, 10)
  const dataFim = (sp.get('dataFim') || hoje).slice(0, 10)
  const slugs = getUnidadesDisponiveis().filter((s) => !emExecucao.has(s))
  if (slugs.length === 0) {
    return NextResponse.json({ ok: true, status: 'ja_em_execucao' })
  }
  // Fire-and-forget: dispara em background e retorna na hora (evita timeout do cron).
  setImmediate(() => runConciliacao(slugs, dataIni, dataFim))
  return NextResponse.json({ ok: true, status: 'iniciado', periodo: { de: dataIni, ate: dataFim }, unidades: slugs })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
