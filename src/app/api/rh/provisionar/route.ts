import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { sincronizarProvisionamento, type ResultadoProvisionamento } from '@/lib/rh/provisionamento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Autoriza DONA (sessão) OU o cron (x-cron-secret). Como a senha inicial é o CPF
// (nada de senha gerada a exibir), o provisionamento PODE rodar no cron.
async function autorizar(req: NextRequest): Promise<{ erro: NextResponse | null; atorId: string | null }> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('x-cron-secret') === secret) return { erro: null, atorId: null }
  const session = await getSession()
  if (!session) return { erro: unauthorized(), atorId: null }
  if (session.perfil !== 'DONA') return { erro: NextResponse.json({ error: 'Acesso restrito' }, { status: 403 }), atorId: null }
  return { erro: null, atorId: session.sub }
}

// Remove o CPF (senha inicial) antes de devolver ao cliente.
function semCpf(r: ResultadoProvisionamento) {
  return { ...r, criar: r.criar.map(({ cpf, ...resto }) => resto) }
}

// GET — prévia (dry-run): quem SERIA criado + ignorados.
export async function GET(req: NextRequest) {
  const { erro } = await autorizar(req)
  if (erro) return erro
  try {
    const previa = await sincronizarProvisionamento({ dryRun: true })
    return NextResponse.json({ previa: semCpf(previa) })
  } catch (e) {
    console.error('Erro na prévia de provisionamento RH:', e)
    return NextResponse.json({ error: 'Falha ao consultar RH' }, { status: 500 })
  }
}

// POST — cria os acessos (senha inicial = CPF, troca no 1º acesso). ?dry=1 simula.
export async function POST(req: NextRequest) {
  const { erro, atorId } = await autorizar(req)
  if (erro) return erro
  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  try {
    const resultado = await sincronizarProvisionamento({ dryRun, atorId: atorId ?? undefined })
    return NextResponse.json({ ok: true, resultado: semCpf(resultado) })
  } catch (e) {
    console.error('Erro no provisionamento RH:', e)
    return NextResponse.json({ error: 'Falha ao criar acessos' }, { status: 500 })
  }
}
