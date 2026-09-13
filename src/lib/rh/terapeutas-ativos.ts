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
    const { rows } = await p.query<{ nome: string }>(
      `SELECT c.nome
         FROM colaboradores c
         JOIN cargos cg ON cg.id = c."cargoId"
        WHERE c.ativo = true
          AND cg.nome <> 'Terapeuta'`,
    )
    const nomes = new Set(rows.map((r) => normalizarNome(r.nome)))
    cache = { at: agora, nomes }
    return nomes
  } catch (err) {
    console.error('[rh] falha ao ler não-terapeutas (denylist):', err instanceof Error ? err.message : err)
    return cache?.nomes ?? null
  }
}
