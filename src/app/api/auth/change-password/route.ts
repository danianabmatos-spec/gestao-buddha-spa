import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { verificarSenha, hashSenha } from '@/lib/auth/password'

const MIN_SENHA = 8

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { senhaAtual, novaSenha } = await req.json().catch(() => ({}))
  if (!senhaAtual || !novaSenha) {
    return NextResponse.json({ error: 'Informe a senha atual e a nova senha' }, { status: 400 })
  }
  if (String(novaSenha).length < MIN_SENHA) {
    return NextResponse.json({ error: `A nova senha deve ter ao menos ${MIN_SENHA} caracteres` }, { status: 400 })
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: session.sub } })
  if (!usuario || !usuario.ativo) return unauthorized()

  const ok = await verificarSenha(String(senhaAtual), usuario.senha)
  if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senha: await hashSenha(String(novaSenha)) },
  })

  return NextResponse.json({ ok: true })
}
