import { Pool } from 'pg'

// ─── Integração (somente leitura) com o app de RH (buddha-rh, Postgres) ──────────
// Fonte da verdade de QUEM é terapeuta ATIVO. Usado para filtrar a tela de
// Terapeutas: só entra quem está ativo E tem cargo "Terapeuta" no RH — assim
// coordenadoras (ex.: cargo "Coordenador"), recepção e inativos ficam de fora.
// Conexão via RH_DATABASE_URL (usuário read-only gestao_ro). Fail-open: se o RH
// não estiver configurado/acessível, retorna null e o chamador NÃO filtra.

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
 * Conjunto de nomes NORMALIZADOS dos terapeutas ATIVOS (cargo "Terapeuta") no RH.
 * Retorna null quando o RH não está configurado ou indisponível (fail-open).
 */
export async function getTerapeutasAtivosRH(): Promise<Set<string> | null> {
  const agora = Date.now()
  if (cache && agora - cache.at < TTL_MS) return cache.nomes

  const p = getPool()
  if (!p) return null

  try {
    const { rows } = await p.query<{ nome: string }>(
      `SELECT c.nome
         FROM colaboradores c
         JOIN cargos cg ON cg.id = c."cargoId"
        WHERE c.ativo = true
          AND cg.nome = 'Terapeuta'`,
    )
    const nomes = new Set(rows.map((r) => normalizarNome(r.nome)))
    cache = { at: agora, nomes }
    return nomes
  } catch (err) {
    console.error('[rh] falha ao ler terapeutas ativos:', err instanceof Error ? err.message : err)
    // Se houver cache antigo, usa; senão null (fail-open: não filtra).
    return cache?.nomes ?? null
  }
}
