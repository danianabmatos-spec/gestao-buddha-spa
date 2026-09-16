import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getMatriz, salvarNiveis, marcarRevisadas } from '@/lib/permissoes/store'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Só DONA gerencia acessos.
async function exigirDona() {
  const session = await getSession()
  if (!session) return { erro: unauthorized() as NextResponse, session: null }
  if (session.perfil !== 'DONA') return { erro: NextResponse.json({ error: 'sem permissão' }, { status: 403 }), session }
  return { erro: null, session }
}

// Matriz de permissões (perfis × funcionalidades × nível). A leitura garante o seed.
export async function GET() {
  const { erro } = await exigirDona()
  if (erro) return erro
  try {
    return NextResponse.json(await getMatriz())
  } catch (e) {
    console.error('Erro ao ler matriz de permissões:', e)
    return NextResponse.json({ error: 'Erro ao carregar permissões' }, { status: 500 })
  }
}

// Salva os níveis de UM perfil. Body: { perfilChave, niveis: { funcionalidade: nivel } }
export async function PUT(req: NextRequest) {
  const { erro, session } = await exigirDona()
  if (erro) return erro
  const body = await req.json().catch(() => ({}))
  const perfilChave = String(body.perfilChave || '').trim()
  const niveis = (body.niveis && typeof body.niveis === 'object') ? body.niveis as Record<string, string> : null
  if (!perfilChave || !niveis) {
    return NextResponse.json({ error: 'perfilChave e niveis são obrigatórios' }, { status: 400 })
  }
  try {
    await salvarNiveis(perfilChave, niveis)
    await prisma.logAuditoria.create({
      data: { usuarioId: session!.sub, acao: 'PERMISSAO_EDITAR', entidade: 'Perfil', dados: JSON.stringify({ perfilChave, niveis }).slice(0, 2000) },
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao salvar' }, { status: 400 })
  }
}

// Marca funcionalidades novas como revisadas (tira do banner de pendências).
// Body: { chaves: string[] }
export async function POST(req: NextRequest) {
  const { erro, session } = await exigirDona()
  if (erro) return erro
  const body = await req.json().catch(() => ({}))
  const chaves = Array.isArray(body.chaves) ? body.chaves.map((c: unknown) => String(c)) : null
  if (!chaves || !chaves.length) {
    return NextResponse.json({ error: 'chaves é obrigatório' }, { status: 400 })
  }
  try {
    await marcarRevisadas(chaves)
    await prisma.logAuditoria.create({
      data: { usuarioId: session!.sub, acao: 'PERMISSAO_REVISAR', entidade: 'Funcionalidade', dados: JSON.stringify({ chaves }).slice(0, 2000) },
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha' }, { status: 400 })
  }
}
