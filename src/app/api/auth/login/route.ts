import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verificarSenha } from '@/lib/auth/password'
import { signSession, COOKIE_NAME, COOKIE_MAX_AGE, type Perfil } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json().catch(() => ({}))
  if (!email || !senha) {
    return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    include: { unidade: true },
  })

  // Mensagem genérica — não revela se o e-mail existe
  const invalido = () =>
    NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 })

  if (!usuario || !usuario.ativo) return invalido()

  const ok = await verificarSenha(String(senha), usuario.senha)
  if (!ok) return invalido()

  const perfil: Perfil =
    usuario.perfil === 'DONA' ? 'DONA'
    : usuario.perfil === 'COORDENACAO' ? 'COORDENACAO'
    : usuario.perfil === 'FINANCEIRO' ? 'FINANCEIRO'
    : 'RECEPCAO'

  // FINANCEIRO enxerga todas as unidades (como a DONA), mas só edita o Caixa.
  const escopoTotal = perfil === 'DONA' || perfil === 'FINANCEIRO'

  // Escopo de unidades:
  // - DONA: null (todas)
  // - COORDENACAO: unidades vinculadas via UsuarioUnidade (1, 2 ou mais)
  // - RECEPCAO: a própria unidade (Usuario.unidadeId)
  let unidadeSlugs: string[] | null = null
  if (perfil === 'COORDENACAO') {
    const vinculos = await prisma.usuarioUnidade.findMany({
      where: { usuarioId: usuario.id },
      include: { unidade: true },
    })
    unidadeSlugs = vinculos.map((v) => v.unidade.slug).filter(Boolean)
  } else if (perfil === 'RECEPCAO') {
    unidadeSlugs = usuario.unidade?.slug ? [usuario.unidade.slug] : []
  }

  // 1ª unidade (compat com código que usa unidadeSlug singular)
  const unidadeSlug =
    escopoTotal ? null : (unidadeSlugs && unidadeSlugs[0]) || usuario.unidade?.slug || null

  // Perfis travados sem nenhuma unidade não podem entrar (evita ver tudo por acidente)
  if (!escopoTotal && (!unidadeSlugs || unidadeSlugs.length === 0)) {
    return NextResponse.json(
      { error: 'Usuário sem unidade vinculada. Contate o administrador.' },
      { status: 403 },
    )
  }

  const token = await signSession({
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil,
    unidadeSlug,
    unidadeSlugs,
  })

  const res = NextResponse.json({
    ok: true,
    usuario: { nome: usuario.nome, perfil, unidadeSlug, unidadeSlugs },
  })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return res
}
