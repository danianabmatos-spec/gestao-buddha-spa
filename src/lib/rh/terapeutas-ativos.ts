import { Pool } from 'pg'

// ─── Integração (somente leitura) com o app de RH (buddha-rh, Postgres) ──────────
// Estratégia DENYLIST (à prova de falha): em vez de "só mostrar quem casa" (que
// escondia terapeuta real por divergência de nome), a tela mostra TODO mundo do
// Belle e só ESCONDE quem o RH confirma que NÃO é terapeuta (coordenador, recepção
// etc.). Assim nenhum terapeuta some por diferença de grafia; o pior caso é um
// não-terapeuta com nome bem diferente escapar (leve). Fonte: colaboradores ativos
// com cargo != "Terapeuta". Conexão via RH_DATABASE_URL (user read-only gestao_ro).
// Fail-open: se o RH não estiver configurado/acessível, retorna null (não filtra).

let pool: Pool | null = null
function getPool(): Pool | null {
  const url = process.env.RH_DATABASE_URL
  if (!url) return null
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    })
  }
  return pool
}

// Normaliza nome para casar entre sistemas (Belle x RH): sem acento, minúsculo,
// espaços colapsados e sem espaços nas pontas. Também usado na mescla do NPS.
export function normalizarNome(nome: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove marcas de acento (combining)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Distância de edição (Levenshtein) — p/ tolerar grafia (ex.: Nakandakari↔Nakandakare).
function distEdicao(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

// Dois tokens de nome são "equivalentes" se iguais, prefixo um do outro, ou a 1 letra
// de diferença (só em tokens longos, p/ não casar nomes curtos diferentes).
function tokenEquiv(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  return Math.min(a.length, b.length) >= 5 && distEdicao(a, b) <= 1
}

// Cache em memória (o quadro de terapeutas muda raramente).
let cache: { at: number; nomes: Set<string> } | null = null
const TTL_MS = 10 * 60 * 1000

/**
 * DENYLIST: nomes NORMALIZADOS de colaboradores ATIVOS que NÃO são terapeutas
 * (cargo != "Terapeuta") — ex.: coordenadores, recepção. A tela de Terapeutas
 * esconde quem está neste conjunto. Retorna null se o RH estiver indisponível
 * (fail-open: não esconde ninguém por conta do RH).
 */
export async function getNaoTerapeutasRH(): Promise<Set<string> | null> {
  const agora = Date.now()
  if (cache && agora - cache.at < TTL_MS) return cache.nomes

  const p = getPool()
  if (!p) return null

  try {
    // INNER JOIN: quem não tem cargo definido fica FORA da denylist (fail-safe → aparece).
    // "Terapeuta" casa por PREFIXO (Terapeuta, Terapeuta Bronze/Prata/Ouro/Diamante),
    // alinhado à definição de terapeuta no RH (cargo que começa com "Terapeuta").
    const { rows } = await p.query<{ nome: string }>(
      `SELECT c.nome
         FROM colaboradores c
         JOIN cargos cg ON cg.id = c."cargoId"
        WHERE c.ativo = true
          AND cg.nome NOT ILIKE 'Terapeuta%'`,
    )
    const nomes = new Set(rows.map((r) => normalizarNome(r.nome)))
    cache = { at: agora, nomes }
    return nomes
  } catch (err) {
    console.error('[rh] falha ao ler não-terapeutas (denylist):', err instanceof Error ? err.message : err)
    return cache?.nomes ?? null
  }
}

// Resolvedor de categoria (Bronze/Prata/Ouro/Diamante) por terapeuta ativo, do RH.
// `resolve(nomeNormalizado)` casa EXATO e, se falhar, por SUBCONJUNTO único — o Belle
// costuma trazer o nome mais curto que o RH (ex.: Belle "Lucilene Moraes" × RH "Lucilene
// de Moraes Nascimento"). null se RH off.
export interface CategoriaResolver {
  resolve: (nomeNorm: string) => string | null
  porRhNome: (rhNorm: string) => string | null       // categoria pelo nome EXATO do R&S (vínculo manual)
  rhLista: { nome: string; categoria: string }[]     // terapeutas do R&S com categoria (p/ o seletor)
}
let cacheCat: { at: number; resolver: CategoriaResolver } | null = null

export async function getCategoriasTerapeutasRH(): Promise<CategoriaResolver | null> {
  const agora = Date.now()
  if (cacheCat && agora - cacheCat.at < TTL_MS) return cacheCat.resolver

  const p = getPool()
  if (!p) return null

  try {
    const { rows } = await p.query<{ nome: string; categoria: string | null }>(
      `SELECT c.nome, c.categoria
         FROM colaboradores c
         JOIN cargos cg ON cg.id = c."cargoId"
        WHERE c.ativo = true
          AND cg.nome ILIKE 'Terapeuta%'`,
    )
    const exato = new Map<string, string>()
    const lista: { norm: string; nome: string; tokens: string[]; cat: string }[] = []
    for (const r of rows) {
      if (!r.categoria) continue
      const norm = normalizarNome(r.nome)
      const cat = String(r.categoria)
      if (!exato.has(norm)) exato.set(norm, cat) // 1ª ocorrência vence (duplicado no RH é raro)
      lista.push({ norm, nome: r.nome, tokens: norm.split(' ').filter(Boolean), cat })
    }
    const resolver: CategoriaResolver = {
      resolve(nomeNorm) {
        const exata = exato.get(nomeNorm)
        if (exata) return exata
        // Fuzzy por PONTUAÇÃO: conta quantos tokens do Belle têm equivalente no RH
        // (igual/prefixo/1 letra). Casa o ÚNICO melhor, exigindo o 1º nome equivalente,
        // ≥2 tokens e no máximo 1 token "sobrando" (tolera grafia e 1 sobrenome trocado).
        // Empate → sem etiqueta (nunca casa errado). Cobre subconjunto também.
        const bt = nomeNorm.split(' ').filter(Boolean)
        if (bt.length < 2) return null
        const pontuados = lista
          .map((e) => ({ e, s: bt.filter((b) => e.tokens.some((t) => tokenEquiv(b, t))).length, fn: e.tokens.length > 0 && tokenEquiv(bt[0], e.tokens[0]) }))
          .filter((x) => x.fn && x.s >= 2 && x.s >= bt.length - 1)
        if (!pontuados.length) return null
        const max = Math.max(...pontuados.map((x) => x.s))
        const top = pontuados.filter((x) => x.s === max)
        const distintos = new Set(top.map((x) => x.e.norm))
        return distintos.size === 1 ? top[0].e.cat : null
      },
      porRhNome(rhNorm) {
        return exato.get(rhNorm) ?? null
      },
      rhLista: (() => {
        const vistos = new Set<string>()
        const out: { nome: string; categoria: string }[] = []
        for (const e of lista) if (!vistos.has(e.norm)) { vistos.add(e.norm); out.push({ nome: e.nome, categoria: e.cat }) }
        return out.sort((a, b) => a.nome.localeCompare(b.nome))
      })(),
    }
    cacheCat = { at: agora, resolver }
    return resolver
  } catch (err) {
    console.error('[rh] falha ao ler categorias dos terapeutas:', err instanceof Error ? err.message : err)
    return cacheCat?.resolver ?? null
  }
}
