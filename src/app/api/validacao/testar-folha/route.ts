import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'
import { enviarLoteFolha } from '@/lib/folha/enviar-lote'

export const dynamic = 'force-dynamic'

// POST /api/validacao/testar-folha  { unidade, ref, incluirTodos? }
// TESTE (dry-run): monta o lote da unidade/mês e envia à FOLHA em modo simulação —
// a folha casa tudo e devolve o relatório, mas NÃO grava nada. Nunca escreve.
// Auth: DONA (sessão) OU header x-integracao-key (para rodar headless no servidor).
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-integracao-key')
  const keyOk = !!process.env.INTEGRACAO_KEY && key === process.env.INTEGRACAO_KEY
  if (!keyOk) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.perfil !== 'DONA') return NextResponse.json({ error: 'Restrito à dona.' }, { status: 403 })
  }

  const { unidade, ref, incluirTodos, real } = await req.json().catch(() => ({}))
  if (!unidade || !ref) {
    return NextResponse.json({ error: 'Informe unidade (slug) e ref (YYYY-MM).' }, { status: 400 })
  }

  // real=true → envio REAL (grava na folha), 1 unidade, deliberado e autorizado.
  // Sem real → dry-run (simulação, zero escrita). Padrão seguro.
  const ehReal = real === true

  const r = await enviarLoteFolha({
    unidadeSlug: String(unidade),
    ref: String(ref),
    forcado: false,
    forcadoInfo: [],
    liberadoPorNome: ehReal ? 'ENVIO REAL (teste da ponte)' : 'TESTE (dry-run)',
    dryRun: !ehReal,
    explicito: ehReal, // dispensa a trava global só neste envio explícito
    incluirTodos: incluirTodos !== false, // por padrão inclui todos os status
  })

  return NextResponse.json({ modo: ehReal ? 'REAL' : 'dry-run', enviado: r })
}
