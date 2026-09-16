import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifySession } from '@/lib/auth/session'

// Protege as áreas de Inteligência (páginas e APIs). Roda no edge runtime,
// então só usa `jose` (via verifySession) — nada de Prisma/Node aqui.
// (Next 16 renomeou a convenção "middleware" para "proxy".)

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Exceção: a rota de TESTE da ponte pode ser chamada headless com a chave de
  // integração (sem cookie). A própria rota revalida a chave.
  if (pathname === '/api/validacao/testar-folha') {
    const k = req.headers.get('x-integracao-key')
    if (k && process.env.INTEGRACAO_KEY && k === process.env.INTEGRACAO_KEY) {
      return NextResponse.next()
    }
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = token ? await verifySession(token) : null

  if (session) {
    // 1º acesso: obrigada a trocar a senha antes de qualquer coisa.
    if (session.primeirAcesso && !pathname.startsWith('/trocar-senha') && !pathname.startsWith('/api/auth')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Troque sua senha no primeiro acesso.' }, { status: 403 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/trocar-senha'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // FINANCEIRO: consulta tudo, mas SÓ edita o Controle de Caixa.
    // Bloqueia qualquer escrita (POST/PUT/PATCH/DELETE) fora de /api/rotinas/caixa.
    const ehEscrita = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    const ehCaixa = pathname.startsWith('/api/rotinas/caixa')
    if (session.perfil === 'FINANCEIRO' && ehEscrita && pathname.startsWith('/api/') && !ehCaixa) {
      return NextResponse.json({ error: 'Financeiro edita apenas o Controle de Caixa.' }, { status: 403 })
    }

    // TERAPEUTA: acesso restrito à própria área (Meus Atendimentos) + trocar senha.
    // Bloqueia todas as áreas operacionais/sensíveis (inteligência, reembolso, etc.).
    if (session.perfil === 'TERAPEUTA') {
      const permitido =
        pathname.startsWith('/meus-atendimentos') ||
        pathname.startsWith('/api/meus-atendimentos') ||
        pathname === '/trocar-senha'
      if (!permitido) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
        }
        const url = req.nextUrl.clone()
        url.pathname = '/meus-atendimentos'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }

    // Validação do fechamento e Pontuação (coordenadora): só DONA e COORDENACAO.
    if ((pathname.startsWith('/validacao') || pathname.startsWith('/api/validacao') ||
         pathname.startsWith('/pontuacao') || pathname.startsWith('/api/pontuacao')) &&
        session.perfil !== 'DONA' && session.perfil !== 'COORDENACAO') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acesso restrito à coordenação.' }, { status: 403 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Pós-venda (recepção): DONA, RECEPCAO e COORDENACAO.
    if ((pathname.startsWith('/pos-venda') || pathname.startsWith('/api/pos-venda')) &&
        !['DONA', 'RECEPCAO', 'COORDENACAO'].includes(session.perfil)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acesso restrito à recepção.' }, { status: 403 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Acessos & Permissões (gestão de perfis/permissões): só DONA.
    if ((pathname.startsWith('/acessos') || pathname.startsWith('/api/permissoes')) &&
        session.perfil !== 'DONA') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
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
    '/meus-atendimentos',
    '/meus-atendimentos/:path*',
    '/api/meus-atendimentos/:path*',
    '/validacao',
    '/validacao/:path*',
    '/api/validacao/:path*',
    '/pos-venda',
    '/pos-venda/:path*',
    '/api/pos-venda/:path*',
    '/pontuacao',
    '/pontuacao/:path*',
    '/api/pontuacao/:path*',
    '/acessos',
    '/acessos/:path*',
    '/api/permissoes/:path*',
    '/api/inteligencia/:path*',
    '/api/rotinas/:path*',
    '/api/reembolso/:path*',
    '/api/usuarios/:path*',
    '/api/empresas/:path*',
  ],
}
