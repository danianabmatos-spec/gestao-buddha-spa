// Credenciais do WordPress (site de vouchers) por unidade, lidas do .env.local.
// Um login por unidade + affiliation_id filtra a unidade no painel WP.

export interface WpCredenciais { user: string; pass: string; affiliation: string }

// slug da unidade → prefixo das vars (WP_<PREFIXO>_USER/PASS/AFFILIATION)
const PREFIXO: Record<string, string> = {
  'shopping-metropole': 'METROPOLE',
  'analia-franco': 'ANALIA',
  'shopping-analia-franco': 'SHOPPING_ANALIA',
  'perdizes': 'PERDIZES',
  'tatuape-gomescardim': 'TATUAPE',
  'mooca-plaza': 'MOOCA',
  'higienopolis': 'HIGIENOPOLIS',
}

export function getWpCredenciais(unidadeSlug: string): WpCredenciais | null {
  const p = PREFIXO[unidadeSlug]
  if (!p) return null
  const user = process.env[`WP_${p}_USER`]
  const pass = process.env[`WP_${p}_PASS`]
  const affiliation = process.env[`WP_${p}_AFFILIATION`]
  if (!user || !pass || !affiliation) return null
  return { user, pass, affiliation }
}
