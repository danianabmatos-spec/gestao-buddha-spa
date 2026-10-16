import { NextRequest, NextResponse } from 'next/server'
import { CONTAS_ITAU, itauConfigurado } from '@/lib/conciliacao/itau-config'
import { ingerirExtratoItau } from '@/lib/conciliacao/itau'

// ─── CRON · Extrato Itaú diário ───────────────────────────────────────────────────
// Puxa o extrato do Itaú (Pix) das unidades CONFIGURADAS para ONTEM+HOJE e concilia.
// Autentica por CRON_SECRET (header x-cron-secret ou ?token=). Enquanto nenhuma unidade
// tiver credencial/certificado no .env, roda e não faz nada (configurado:false) — inócuo.
//
// Instalar na VPS (ex.: todo dia às 05h, depois do extrato do dia anterior fechar):
//   0 5 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://gestao.solcentral.com.br/api/cron/itau

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function fmtSP(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('token')
  return token === secret
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const hoje = new Date()
  const ontem = new Date(hoje.getTime() - 86_400_000)
  const dataIni = fmtSP(ontem)
  const dataFim = fmtSP(hoje)

  const resultados = []
  for (const slug of Object.keys(CONTAS_ITAU)) {
    if (!itauConfigurado(slug).ok) continue
    try {
      resultados.push(await ingerirExtratoItau(slug, dataIni, dataFim))
    } catch (e) {
      resultados.push({ unidadeSlug: slug, erro: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json({ periodo: { de: dataIni, ate: dataFim }, unidades: resultados.length, resultados })
}
