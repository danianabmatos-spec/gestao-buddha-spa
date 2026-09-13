import { NextRequest, NextResponse } from 'next/server'
import { calcularScoresUnidade } from '@/lib/inteligencia/motor'
import { getUnidadesDisponiveis } from '@/lib/belle/unidades-config'
import { getSession, unauthorized } from '@/lib/auth/guard'

// Evita execuções paralelas para a mesma unidade
const emExecucao = new Set<string>()

async function runSync(slugs: string[]) {
  for (const slug of slugs) {
    if (emExecucao.has(slug)) continue
    emExecucao.add(slug)
    try {
      const n = await calcularScoresUnidade(slug)
      console.log(`[sync] ${slug}: ${n} clientes salvos`)
    } catch (err) {
      console.error(`[sync] ${slug}: erro —`, err instanceof Error ? err.message : String(err))
    } finally {
      emExecucao.delete(slug)
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { unidade } = await req.json().catch(() => ({}))

  // DONA pode sincronizar uma unidade específica ou todas; RECEPÇÃO só a sua
  const slugs = (session.perfil === 'DONA' || session.perfil === 'FINANCEIRO')
    ? (unidade ? [unidade] : getUnidadesDisponiveis())
    : [session.unidadeSlug!]

  // Filtra unidades já em execução
  const pendentes = slugs.filter(s => !emExecucao.has(s))
  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, status: 'ja_em_execucao', slugs })
  }

  // Fire-and-forget: roda em background, retorna imediatamente
  setImmediate(() => runSync(pendentes))

  return NextResponse.json({
    ok: true,
    status: 'iniciado',
    unidades: pendentes,
    aviso: 'Sync em andamento. Pode levar alguns minutos para contas grandes.',
  })
}
