import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { criarPerfil, editarPerfil, desativarPerfil } from '@/lib/permissoes/store'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function exigirDona() {
  const session = await getSession()
  if (!session) return { erro: unauthorized() as NextResponse, session: null }
  if (session.perfil !== 'DONA') return { erro: NextResponse.json({ error: 'sem permissão' }, { status: 403 }), session }
  return { erro: null, session }
}
const log = (usuarioId: string, acao: string, dados: unknown) =>
  prisma.logAuditoria.create({ data: { usuarioId, acao, entidade: 'Perfil', dados: JSON.stringify(dados).slice(0, 2000) } }).catch(() => {})

// Cria perfil customizado. Body: { nome, descricao?, copiarDe? }
export async function POST(req: NextRequest) {
  const { erro, session } = await exigirDona()
  if (erro) return erro
  const b = await req.json().catch(() => ({}))
  const nome = String(b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  try {
    const chave = await criarPerfil(nome, String(b.descricao || ''), b.copiarDe ? String(b.copiarDe) : undefined)
    await log(session!.sub, 'PERFIL_CRIAR', { chave, nome, copiarDe: b.copiarDe })
    return NextResponse.json({ ok: true, chave })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha' }, { status: 400 })
  }
}

// Renomeia/descreve. Body: { chave, nome, descricao? }
export async function PATCH(req: NextRequest) {
  const { erro, session } = await exigirDona()
  if (erro) return erro
  const b = await req.json().catch(() => ({}))
  const chave = String(b.chave || '').trim(), nome = String(b.nome || '').trim()
  if (!chave || !nome) return NextResponse.json({ error: 'chave e nome obrigatórios' }, { status: 400 })
  try {
    await editarPerfil(chave, nome, String(b.descricao || ''))
    await log(session!.sub, 'PERFIL_EDITAR', { chave, nome })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha' }, { status: 400 })
  }
}

// Desativa perfil custom. Body: { chave }
export async function DELETE(req: NextRequest) {
  const { erro, session } = await exigirDona()
  if (erro) return erro
  const b = await req.json().catch(() => ({}))
  const chave = String(b.chave || '').trim()
  if (!chave) return NextResponse.json({ error: 'chave obrigatória' }, { status: 400 })
  try {
    await desativarPerfil(chave)
    await log(session!.sub, 'PERFIL_REMOVER', { chave })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha' }, { status: 400 })
  }
}
