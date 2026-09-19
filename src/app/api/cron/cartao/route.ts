import { NextRequest, NextResponse } from 'next/server'
import { sincronizarCartao, unidadesCartaoProntas } from '@/lib/conciliacao/sync-cartao'

// ─── CRON · Sincronização de cartão (operadoras) ────────────────────────────────
// Puxa as vendas de cartão das operadoras (hoje só Rede) e reconcilia. A Rede
// atualiza D-1, então a janela padrão é ontem+anteontem (cobre o D-1). Aceita
// ?dataIni&dataFim para reprocessar um intervalo. Autentica por CRON_SECRET.
//
// Instalar na VPS (ex.: todo dia às 05h, depois do conciliacao das 03h):
//   0 5 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://gestao.solcentral.com.br/api/cron/cartao

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const emExecucao = new Set<string>()

function fmtSP(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('x-cron-secret')
  const token = header || new URL(req.url).searchParams.get('token')
  return token === secret
}

async function runCartao(slugs: string[], dataIni: string, dataFim: string) {
  for (const slug of slugs) {
    if (emExecucao.has(slug)) continue
    emExecucao.add(slug)
    try {
      const r = await sincronizarCartao(slug, dataIni, dataFim)
      console.log(`[cron-cartao] ${slug} (${r.adquirente}): ${r.gravadas} transações (${dataIni}→${dataFim})`)
    } catch (err) {
      console.error(`[cron-cartao] ${slug}: erro —`, err instanceof Error ? err.message : String(err))
    } finally {
      emExecucao.delete(slug)
    }
  }
  console.log('[cron-cartao] concluído')
}

async function handle(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const hoje = fmtSP(new Date())
  const ontem = fmtSP(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const anteontem = fmtSP(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
  const sp = req.nextUrl.searchParams
  // Rede é D-1: por padrão cobre anteontem→ontem; aceita período p/ reprocessar.
  const dataIni = (sp.get('dataIni') || anteontem).slice(0, 10)
  const dataFim = (sp.get('dataFim') || ontem).slice(0, 10)
  void hoje

  const filtro = sp.get('unidade')
  const disponiveis = unidadesCartaoProntas()
  const slugs = (filtro ? disponiveis.filter((s) => s === filtro) : disponiveis)
    .filter((s) => !emExecucao.has(s))
  if (slugs.length === 0) {
    return NextResponse.json({ ok: true, status: 'nada_a_fazer' })
  }
  setImmediate(() => runCartao(slugs, dataIni, dataFim))
  return NextResponse.json({ ok: true, status: 'iniciado', periodo: { de: dataIni, ate: dataFim }, unidades: slugs })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
