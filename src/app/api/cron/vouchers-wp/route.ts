import { NextRequest, NextResponse } from 'next/server'
import { getUnidadesDisponiveis } from '@/lib/belle/unidades-config'
import { sincronizarVouchersWP } from '@/lib/conciliacao/sync-vouchers-wp'

// ─── CRON · Sync autônomo dos vouchers validados do WordPress (via FlareSolverr) ──
// Roda 1x/dia: raspa o painel WP das unidades (login + Cloudflare vencidos pelo
// FlareSolverr), grava os validados em FonteExterna e reconcilia. Autentica por
// CRON_SECRET. SEQUENCIAL (o FlareSolverr processa um por vez). Mês corrente.
//
// Instalar na VPS (ex.: 04h, depois do cron de conciliação):
//   0 4 * * * curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/vouchers-wp

export const dynamic = 'force-dynamic'
export const maxDuration = 800

let emExecucao = false

function fmtSP(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('token')
  return token === secret
}

async function run(dataIni: string, dataFim: string) {
  emExecucao = true
  try {
    for (const slug of getUnidadesDisponiveis()) {
      try {
        const r = await sincronizarVouchersWP(slug, dataIni, dataFim)
        console.log(`[cron-vouchers-wp] ${slug}: ${r.validados} validados (${dataIni}→${dataFim})`)
      } catch (err) {
        console.error(`[cron-vouchers-wp] ${slug}: erro —`, err instanceof Error ? err.message : String(err))
      }
    }
    console.log('[cron-vouchers-wp] concluído')
  } finally {
    emExecucao = false
  }
}

async function handle(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (emExecucao) return NextResponse.json({ ok: true, status: 'ja_em_execucao' })
  const sp = new URL(req.url).searchParams
  const hoje = fmtSP(new Date())
  const dataFim = sp.get('dataFim') || hoje
  const dataIni = sp.get('dataIni') || `${hoje.slice(0, 7)}-01`
  setImmediate(() => run(dataIni, dataFim))
  return NextResponse.json({ ok: true, status: 'iniciado', periodo: { de: dataIni, ate: dataFim } })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
