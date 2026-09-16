import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, escopoDoPerfil } from '@/lib/auth/guard'
import { getPerfisAtribuiveis } from '@/lib/permissoes/store'
import { hashSenha } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

// GET /api/usuarios — lista usuários (+ unidades), unidades disponíveis e perfis atribuíveis
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true, nome: true, email: true, perfil: true, ativo: true,
      unidade: { select: { id: true, slug: true, nome: true } },
      unidadesCoord: { select: { unidade: { select: { id: true, slug: true, nome: true } } } },
    },
  })
  const unidades = await prisma.unidade.findMany({ where: { ativa: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true, slug: true } })
  const perfis = await getPerfisAtribuiveis()

  const lista = usuarios.map((u) => {
    let uns: { id: number; slug: string; nome: string }[] = []
    if (escopoDoPerfil(u.perfil) === 'unidade' && u.unidade) uns = [u.unidade]
    else if (u.perfil === 'COORDENACAO') uns = u.unidadesCoord.map((v) => v.unidade)
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, unidades: uns }
  })

  return Response.json({ usuarios: lista, unidades, perfis, meuId: session.sub })
}

// POST /api/usuarios — cria usuário
// Body: { nome, email, senha, perfil, unidadeIds: number[] }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const b = await req.json()
  const nome = String(b.nome ?? '').trim()
  const email = String(b.email ?? '').toLowerCase().trim()
  const senha = String(b.senha ?? '')
  const perfil = String(b.perfil ?? '').trim()
  const unidadeIds: number[] = Array.isArray(b.unidadeIds) ? b.unidadeIds.map(Number).filter(Boolean) : []

  if (!nome || !email || senha.length < 4) {
    return Response.json({ error: 'Preencha nome, e-mail e senha (mín. 4 caracteres).' }, { status: 400 })
  }
  // Perfil é OBRIGATÓRIO e precisa existir (sistema ou personalizado, ativo).
  const perfisValidos = await getPerfisAtribuiveis()
  const perfilInfo = perfisValidos.find((p) => p.chave === perfil)
  if (!perfilInfo) {
    return Response.json({ error: 'Selecione um perfil válido para o usuário.' }, { status: 400 })
  }
  if (perfilInfo.escopo !== 'total' && unidadeIds.length === 0) {
    return Response.json({ error: 'Este perfil precisa de ao menos uma unidade.' }, { status: 400 })
  }
  const existe = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
  if (existe) return Response.json({ error: 'Já existe usuário com esse e-mail.' }, { status: 409 })

  const hash = await hashSenha(senha)
  // Escopo 'unidade' (recepção/terapeuta/custom) guarda 1 unidade; 'coord' usa a tabela N:N.
  const unidadeId = perfilInfo.escopo === 'unidade' ? (unidadeIds[0] ?? null) : null

  const novo = await prisma.usuario.create({
    data: { nome, email, senha: hash, perfil, unidadeId, ativo: true },
    select: { id: true },
  })
  if (perfilInfo.escopo === 'coord') {
    await prisma.usuarioUnidade.createMany({ data: unidadeIds.map((uid) => ({ usuarioId: novo.id, unidadeId: uid })) })
  }
  return Response.json({ ok: true, id: novo.id })
}
