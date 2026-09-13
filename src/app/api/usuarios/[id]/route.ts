import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { hashSenha } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

type Perfil = 'DONA' | 'COORDENACAO' | 'RECEPCAO'
const PERFIS: Perfil[] = ['DONA', 'COORDENACAO', 'RECEPCAO']

// PATCH /api/usuarios/:id — edita perfil/unidades/ativo/nome e opcionalmente reseta senha
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { id } = await ctx.params
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { id: true, perfil: true } })
  if (!alvo) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const b = await req.json()
  const data: Record<string, unknown> = {}
  if (b.nome !== undefined) data.nome = String(b.nome).trim()
  if (b.email !== undefined) {
    const email = String(b.email).toLowerCase().trim()
    if (!email.includes('@')) return Response.json({ error: 'E-mail inválido.' }, { status: 400 })
    const outro = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (outro && outro.id !== id) return Response.json({ error: 'E-mail já usado por outro usuário.' }, { status: 409 })
    data.email = email
  }
  if (b.ativo !== undefined) {
    if (id === session.sub && b.ativo === false) return Response.json({ error: 'Você não pode desativar a si mesma.' }, { status: 400 })
    data.ativo = !!b.ativo
  }
  if (b.senha) {
    if (String(b.senha).length < 4) return Response.json({ error: 'Senha mín. 4 caracteres.' }, { status: 400 })
    data.senha = await hashSenha(String(b.senha))
  }

  const perfil = b.perfil !== undefined && PERFIS.includes(b.perfil) ? (b.perfil as Perfil) : null
  const unidadeIds: number[] | null = Array.isArray(b.unidadeIds) ? b.unidadeIds.map(Number).filter(Boolean) : null

  // Reconciliação de perfil/unidades
  if (perfil || unidadeIds) {
    const perfilFinal = (perfil ?? alvo.perfil) as Perfil
    const ids = unidadeIds ?? []
    if ((perfilFinal === 'RECEPCAO' || perfilFinal === 'COORDENACAO') && ids.length === 0 && unidadeIds) {
      return Response.json({ error: 'Coordenação/Recepção precisam de ao menos uma unidade.' }, { status: 400 })
    }
    if (perfil) data.perfil = perfilFinal
    data.unidadeId = perfilFinal === 'RECEPCAO' ? (ids[0] ?? null) : null
    // Vínculos N:N só para COORDENACAO
    await prisma.usuarioUnidade.deleteMany({ where: { usuarioId: id } })
    if (perfilFinal === 'COORDENACAO' && ids.length) {
      await prisma.usuarioUnidade.createMany({ data: ids.map((uid) => ({ usuarioId: id, unidadeId: uid })) })
    }
  }

  if (Object.keys(data).length) await prisma.usuario.update({ where: { id }, data })
  return Response.json({ ok: true })
}

// DELETE /api/usuarios/:id — remove o usuário
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { id } = await ctx.params
  if (id === session.sub) return Response.json({ error: 'Você não pode remover a si mesma.' }, { status: 400 })

  await prisma.usuarioUnidade.deleteMany({ where: { usuarioId: id } })
  await prisma.logAuditoria.deleteMany({ where: { usuarioId: id } })
  await prisma.usuario.delete({ where: { id } })
  return Response.json({ ok: true })
}
