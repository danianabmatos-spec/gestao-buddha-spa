import { salvarFontesExternas, type ResultadoFontes } from '@/lib/conciliacao/fontes-externas'
import { ConectorRede, getRedeCred } from '@/lib/conciliacao/conectores/rede'

// ─── F3 · Sincronização de CARTÃO (operadoras) ──────────────────────────────────
// Para cada unidade: descobre o adquirente, monta as credenciais, puxa as vendas e
// grava em FonteExterna (origem OPERADORA_CARTAO). O motor (conciliarCartaoDia) casa
// por valor bruto com o Belle. Hoje só a Rede tem conector; Getnet/Stone entram depois.

export type Adquirente = 'rede' | 'getnet' | 'stone'

// Adquirente PRINCIPAL por unidade (mapa confirmado pela Daniana).
// Higienópolis = Getnet; as demais = Rede. (Stone é uso baixo/secundário — depois.)
export const ADQUIRENTE_POR_UNIDADE: Record<string, Adquirente> = {
  'shopping-metropole': 'rede',
  'analia-franco': 'rede',
  'shopping-analia-franco': 'rede',
  'perdizes': 'rede',
  'tatuape-gomescardim': 'rede',
  'mooca-plaza': 'rede',
  'higienopolis': 'getnet',
}

export interface ResultadoCartao extends ResultadoFontes {
  adquirente: Adquirente
}

/**
 * Sincroniza as vendas de cartão de uma unidade no período e reconcilia.
 * Lança erro claro se o adquirente não tiver conector ou faltar credencial (sem
 * mascarar — assim o cron loga por unidade sem derrubar as outras).
 */
export async function sincronizarCartao(
  slug: string, dataIniISO: string, dataFimISO: string,
): Promise<ResultadoCartao> {
  const adquirente = ADQUIRENTE_POR_UNIDADE[slug]
  if (!adquirente) throw new Error(`Unidade sem adquirente mapeado: ${slug}`)

  if (adquirente === 'rede') {
    const cred = getRedeCred(slug)
    if (!cred) throw new Error(`Rede: credenciais/PV ausentes p/ ${slug} (conferir .env + REDE_PV)`)
    const txs = await new ConectorRede().buscar(cred, dataIniISO, dataFimISO)
    const r = await salvarFontesExternas(slug, txs)
    return { ...r, adquirente }
  }

  // Getnet (Higienópolis) e Stone ainda sem conector.
  throw new Error(`Adquirente "${adquirente}" ainda sem conector (unidade ${slug})`)
}

/** Unidades que já têm conector de cartão pronto p/ sincronizar. */
export function unidadesCartaoProntas(): string[] {
  return Object.entries(ADQUIRENTE_POR_UNIDADE)
    .filter(([, adq]) => adq === 'rede')
    .map(([slug]) => slug)
}
