import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifySession } from '@/lib/auth/session'

// Protege as áreas de Inteligência (páginas e APIs). Roda no edge runtime,
// então só usa `jose` (via verifySession) — nada de Prisma/Node aqui.
// (Next 16 renomeou a convenção "middleware" para "proxy".)

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = token ? await verifySession(token) : null

  if (session) {
    // FINANCEIRO: consulta tudo, mas SÓ edita o Controle de Caixa.
    // Bloqueia qualquer escrita (POST/PUT/PATCH/DELETE) fora de /api/rotinas/caixa.
    const ehEscrita = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    const ehCaixa = pathname.startsWith('/api/rotinas/caixa')
    if (session.perfil === 'FINANCEIRO' && ehEscrita && pathname.startsWith('/api/') && !ehCaixa) {
      return NextResponse.json({ error: 'Financeiro edita apenas o Controle de Caixa.' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // API → 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Página → redireciona para login preservando o destino
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/inteligencia',
    '/inteligencia/:path*',
    '/rotina-do-dia',
    '/rotina-do-dia/:path*',
    '/reembolso',
    '/reembolso/:path*',
    '/usuarios',
    '/usuarios/:path*',
    '/empresas',
    '/empresas/:path*',
    '/caixa',
    '/trocar-senha',
    '/api/inteligencia/:path*',
    '/api/rotinas/:path*',
    '/api/reembolso/:path*',
    '/api/usuarios/:path*',
    '/api/empresas/:path*',
  ],
}
