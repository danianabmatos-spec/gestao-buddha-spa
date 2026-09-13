// Resolve a unidade do ERP a partir do que o WordPress informa no relay:
// o nome da conta logada (#wp-admin-bar-my-account) e/ou o nome que aparece na
// coluna "Unidade" do relatório. Também mapeia por affiliation_id (fallback).

export interface UnidadeRef { slug: string; nome: string }

// affiliation_id do WordPress → slug do ERP (memória wordpress-affiliation-ids)
export const AFFILIATION_TO_SLUG: Record<string, string> = {
  '894555': 'shopping-metropole',
  '206': 'analia-franco',
  '591248': 'shopping-analia-franco',
  '753': 'perdizes',
  '857895': 'tatuape-gomescardim',
  '299557': 'mooca-plaza',
  '708': 'higienopolis',
}

function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .trim()
}

/**
 * Casa um texto livre (nome da conta WP ou coluna "Unidade") com o slug do ERP.
 * A ordem importa: SAF ("shopping anália") é testado antes de Anália Franco.
 * Retorna null se não reconhecer.
 */
export function matchSlugPorNome(texto: string): string | null {
  const t = normalizar(texto)
  if (!t) return null
  if (t.includes('metropole') || t.includes('metropolis')) return 'shopping-metropole'
  if (t.includes('higien')) return 'higienopolis'
  if (t.includes('perdizes')) return 'perdizes'
  if (t.includes('tatuap')) return 'tatuape-gomescardim'
  if (t.includes('mooca')) return 'mooca-plaza'
  // "shopping anália" / "shop. anália" / "saf" → SAF (antes do Anália puro)
  if (t.includes('saf') || ((t.includes('shop') || t.includes('shopping')) && t.includes('anal'))) return 'shopping-analia-franco'
  if (t.includes('anal')) return 'analia-franco'
  return null
}

/** Resolve o slug a partir dos sinais possíveis do relay (na ordem de confiança). */
export function resolverSlug(sinais: { unidadeNome?: string | null; contaWp?: string | null; affiliation?: string | null }): string | null {
  if (sinais.affiliation && AFFILIATION_TO_SLUG[sinais.affiliation]) return AFFILIATION_TO_SLUG[sinais.affiliation]
  return matchSlugPorNome(sinais.unidadeNome || '') || matchSlugPorNome(sinais.contaWp || '')
}
