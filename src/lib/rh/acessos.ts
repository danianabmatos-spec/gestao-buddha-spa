import { Pool } from 'pg'

// ─── Integração de ACESSOS com o RH (buddha-rh, Postgres, somente leitura) ───────
// Fonte da verdade de quem é colaborador ATIVO. Usada para DESPROVISIONAR acessos:
// quando o RH marca um colaborador como inativo (desligado), o acesso no ERP é
// desativado. Casamento ERP↔RH por E-MAIL (o Usuario do ERP não tem CPF).
//
// Fail-safe: se o RH não estiver configurado/acessível, retorna null e o
// reconciliador NÃO desativa ninguém (não confiar num RH indisponível).

let pool: Pool | null = null
function getPool(): Pool | null {
  const url = process.env.RH_DATABASE_URL
  if (!url) return null
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000 })
  }
  return pool
}

export function normalizarEmail(email: string): string {
  return String(email || '').toLowerCase().trim()
}

export interface StatusEmailsRH {
  ativos: Set<string>     // e-mails (normalizados) com ao menos 1 vínculo ATIVO no RH
  desligados: Set<string> // e-mails que existem no RH mas sem nenhum vínculo ativo
}

// Cargos do RH com a contagem de colaboradores ATIVOS por cargo. Usado na tela de
// mapeamento cargo→perfil. Fail-open: null se o RH estiver indisponível.
export async function getCargosRH(): Promise<{ cargo: string; ativos: number }[] | null> {
  const p = getPool()
  if (!p) return null
  try {
    const { rows } = await p.query<{ cargo: string; ativos: string }>(
      `SELECT cg.nome AS cargo, COUNT(*) FILTER (WHERE c.ativo) AS ativos
         FROM cargos cg
         LEFT JOIN colaboradores c ON c."cargoId" = cg.id
        GROUP BY cg.nome
        ORDER BY COUNT(*) FILTER (WHERE c.ativo) DESC, cg.nome`,
    )
    return rows.map((r) => ({ cargo: r.cargo, ativos: Number(r.ativos) || 0 }))
  } catch (err) {
    console.error('[rh] falha ao ler cargos:', err instanceof Error ? err.message : err)
    return null
  }
}

// Status de acesso por e-mail, agregando por pessoa: um e-mail conta como ATIVO se
// tiver qualquer colaborador ativo (cobre readmissão — o vínculo ativo prevalece).
export async function getStatusEmailsRH(): Promise<StatusEmailsRH | null> {
  const p = getPool()
  if (!p) return null
  try {
    const { rows } = await p.query<{ email: string; tem_ativo: boolean }>(
      `SELECT lower(trim(email)) AS email, bool_or(ativo) AS tem_ativo
         FROM colaboradores
        WHERE email IS NOT NULL AND trim(email) <> ''
        GROUP BY lower(trim(email))`,
    )
    const ativos = new Set<string>()
    const desligados = new Set<string>()
    for (const r of rows) {
      if (r.tem_ativo) ativos.add(r.email)
      else desligados.add(r.email)
    }
    return { ativos, desligados }
  } catch (err) {
    console.error('[rh] falha ao ler status de acessos:', err instanceof Error ? err.message : err)
    return null
  }
}
