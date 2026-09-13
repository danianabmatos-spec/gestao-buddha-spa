import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/guard'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ usuario: null }, { status: 401 })
  return NextResponse.json({
    usuario: {
      nome: session.nome,
      email: session.email,
      perfil: session.perfil,
      unidadeSlug: session.unidadeSlug,
      unidadeSlugs: session.unidadeSlugs,
    },
  })
}
