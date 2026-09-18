import { getWpCredenciais } from './unidade-wp-config'
import { criarSessao, destruirSessao, flareGet, flarePost } from './flaresolverr'

// Raspa a página de vouchers do WordPress (protegida por Cloudflare + login),
// via FlareSolverr. Resolve o captcha matemático do Jetpack Protect automaticamente.

const WP_URL = 'https://buddhaspa.com.br'

function resolverConta(a: string, op: string, b: string): number {
  const x = Number(a), y = Number(b)
  if (op === '+') return x + y
  if (op === '-') return x - y
  return x * y // × ou x ou *
}

/** Retorna o HTML da página de vouchers da unidade no período — com retry
 * (o FlareSolverr às vezes falha o desafio do Cloudflare na 1ª tentativa). */
export async function scrapeVouchersWP(
  unidadeSlug: string, dataIni: string, dataFim: string,
): Promise<string> {
  const cred = getWpCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Sem credenciais WordPress para ${unidadeSlug}`)

  let ultimoErro: unknown = null
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await scrapeUmaVez(unidadeSlug, cred, dataIni, dataFim)
    } catch (e) {
      ultimoErro = e
      console.warn(`[wp-scraper] ${unidadeSlug} tentativa ${tentativa} falhou:`, e instanceof Error ? e.message : e)
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(`scrapeVouchersWP falhou (${unidadeSlug})`)
}

async function scrapeUmaVez(
  unidadeSlug: string, cred: { user: string; pass: string; affiliation: string },
  dataIni: string, dataFim: string,
): Promise<string> {
  const session = await criarSessao()
  try {
    // 1) abre o login (FlareSolverr vence o Cloudflare)
    const login = await flareGet(session, `${WP_URL}/wp-login.php`)
    const html = (login.html || '').replace(/&nbsp;/g, ' ')

    // 2) resolve o captcha do Jetpack Protect (pergunta "N op N =" + hash oculto)
    const hash = html.match(/name=["']jetpack_protect_answer["'][^>]*value=["']([^"']+)["']/i)?.[1]
    const q = html.match(/(\d+)\s*([+\-x*×])\s*(\d+)\s*=/)

    // 3) POST de login (dentro do navegador da sessão — passa Cloudflare e autentica)
    const params = new URLSearchParams({
      log: cred.user, pwd: cred.pass, 'wp-submit': 'Acessar',
      testcookie: '1', redirect_to: `${WP_URL}/wp-admin/`,
    })
    if (q && hash) {
      const op = q[2] === '×' || q[2] === 'x' ? '*' : q[2]
      params.set('jetpack_protect_num', String(resolverConta(q[1], op, q[3])))
      params.set('jetpack_protect_answer', hash)
    }
    const post = await flarePost(session, `${WP_URL}/wp-login.php`, params.toString())
    const autenticado = (post.cookies || []).some((c) => c.name.startsWith('wordpress_logged_in'))
    if (!autenticado) throw new Error(`Login WordPress falhou para ${unidadeSlug} (captcha/credenciais)`)

    // 4) raspa a página de vouchers (filtro por data de UTILIZAÇÃO + afiliação)
    const vurl = `${WP_URL}/wp-admin/admin.php?` + new URLSearchParams({
      page: 'vouchers', status: '', product_id: '0', category_id: '0',
      date_sell_start: '', date_sell_end: '',
      date_used_start: dataIni, date_used_end: dataFim,
      affilliation_id: cred.affiliation,
    }).toString()
    const v = await flareGet(session, vurl)
    if (/id=["']user_login["']/.test(v.html)) {
      throw new Error(`Sessão não autenticada ao abrir vouchers (${unidadeSlug})`)
    }
    return v.html
  } finally {
    await destruirSessao(session)
  }
}
