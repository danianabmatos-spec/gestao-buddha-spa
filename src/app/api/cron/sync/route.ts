import { NextRequest, NextResponse } from 'next/server'
import { calcularScoresUnidade } from '@/lib/inteligencia/motor'
import { getUnidadesDisponiveis } from '@/lib/belle/unidades-config'
import { processarOutbox } from '@/lib/integracoes/leadflow'

// Endpoint acionado pelo CRON DE SISTEMA da VPS (fora da proteção de login).
// Autentica por segredo próprio (CRON_SECRET) via header x-cron-secret ou ?token=.
// Roda o sync de todas as unidades em background e responde imediatamente.

export const dynamic = 'force-dynamic'

const emExecucao = new Set<string>()

async function runSync(slugs: string[]) {
  for (const slug of slugs) {
    if (emExecucao.has(slug)) continue
    emExecucao.add(slug)
    try {
      const n = await calcularScoresUnidade(slug)
      console.log(`[cron-sync] ${slug}: ${n} clientes salvos`)
    } catch (err) {
      console.error(`[cron-sync] ${slug}: erro —`, err instanceof Error ? err.message : String(err))
    } finally {
      emExecucao.delete(slug)
    }
  }
  console.log('[cron-sync] concluído')
}

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sem segredo configurado → endpoint desativado
  const header = req.headers.get('x-cron-secret')
  const token = header || new URL(req.url).searchParams.get('token')
  return token === secret
}

async function handle(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const slugs = getUnidadesDisponiveis().filter((s) => !emExecucao.has(s))
  if (slugs.length === 0) {
    return NextResponse.json({ ok: true, status: 'ja_em_execucao' })
  }
  // Fire-and-forget: dispara em background e retorna na hora (evita timeout do cron)
  setImmediate(() => runSync(slugs))
  // Também drena a fila de espelhamento no LeadFlow (no-op se desligado)
  setImmediate(() => { processarOutbox().catch(() => {}) })
  return NextResponse.json({ ok: true, status: 'iniciado', unidades: slugs })
}

export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}
