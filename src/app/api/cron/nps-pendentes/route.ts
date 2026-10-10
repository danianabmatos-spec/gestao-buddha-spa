import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais, getUnidadesDisponiveis } from '@/lib/belle/unidades-config'
import { getDetratoresNeutros } from '@/lib/belle/relatorio-nps'
import { atualizarNpsPendentes, mesRefAtual } from '@/lib/rotinas/nps-pendentes'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Cron diário: recalcula o nº de NPS pendentes de cada unidade (mês corrente) no cache,
// p/ o badge do menu lateral ficar fresco mesmo sem ninguém abrir a página.
// Auth: CRON_SECRET (header x-cron-secret ou ?token=). Ex. (crontab, BRT):
//   0 6 * * * curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/nps-pendentes >> /var/log/gestao-nps.log 2>&1
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('x-cron-secret')
  const token = header || new URL(req.url).searchParams.get('token')
  return !!secret && token === secret
}

async function run(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const mesRef = mesRefAtual()
  const ini = `${mesRef}-01`
  const [ay, am] = mesRef.split('-').map(Number)
  const fim = `${mesRef}-${String(new Date(ay, am, 0).getDate()).padStart(2, '0')}`

  const resultados: Array<{ slug: string; ok: boolean; pendentes?: number; total?: number; erro?: string }> = []
  for (const slug of getUnidadesDisponiveis()) {
    const cred = getUnidadeCredenciais(slug)
    const unidade = await prisma.unidade.findUnique({ where: { slug }, select: { id: true } })
    if (!cred || !unidade) { resultados.push({ slug, ok: false, erro: 'sem credencial/unidade' }); continue }
    try {
      const r = await getDetratoresNeutros(cred.email, cred.password, ini, fim, cred.estab)
      const chaves = r.avaliacoes.map((a) => a.idAtendimento || `${a.cliente}|${a.data}`)
      const pend = await atualizarNpsPendentes(unidade.id, mesRef, chaves)
      resultados.push({ slug, ok: true, pendentes: pend, total: chaves.length })
    } catch (e) {
      resultados.push({ slug, ok: false, erro: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json({ ok: true, mesRef, resultados })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
