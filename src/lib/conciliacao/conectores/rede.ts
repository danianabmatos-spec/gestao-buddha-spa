import { maybeDecrypt } from '@/lib/auth/crypto'
import type { ConectorCartao, TransacaoExterna } from '@/lib/conciliacao/fontes-externas'

// ─── F3 · Conector da Rede (API "Gestão de Vendas" / Sales Management) ───────────
// Puxa as vendas de cartão (crédito/débito) da Rede por período e devolve no formato
// TransacaoExterna (origem OPERADORA_CARTAO). O motor de cartão (casarPorValor) casa
// por valor BRUTO com o que a recepção lançou no Belle.
//
// Doc oficial: developer.userede.com.br — "Gestão de Vendas". Fluxo:
//   1) OAuth: POST {BASE}/oauth/token  · Header Basic base64(ClientID:SecretCode)
//      · body grant_type=password&username=<user>&password=<senha>
//      → { access_token, refresh_token, expires_in (~24min), scope }.
//   2) GET {BASE}/statement/v1/sales/{PV}/daily?startDate&endDate&size  · Bearer token.
//      Atualização D-1 (dados sempre do dia anterior).
//
// 🚧 ACESSO: produção NÃO é self-serve — a Rede precisa registrar/certificar o app
//    (e-mail ecommerce@userede.com.br) antes de liberar. Só então autentica.
// ⚠️ VERIFICAR NA 1ª RESPOSTA REAL (marcado com [VERIFICAR]): nomes exatos dos campos
//    da venda e se o VALOR vem em reais (decimal) ou centavos (inteiro). Sem acesso não
//    dá pra confirmar; o mapeamento abaixo é defensivo (aceita vários nomes).

const BASE_PADRAO = 'https://api.userede.com.br/redelabs'

// Nº de estabelecimento (parentCompanyNumber / PV) por unidade — Daniana forneceu.
// Não é segredo (é o nº do EC). Higienópolis usa Getnet, não entra aqui.
export const REDE_PV: Record<string, string> = {
  'shopping-metropole': '104552484',       // AELIA SAUDE E BEM ESTAR
  'analia-franco': '83105131',             // BUDDHA SPA SOL CENTRAL
  'mooca-plaza': '83131701',               // BUDDHA MOOCA SHOPPING
  'tatuape-gomescardim': '101049153',      // BUDDHA SPA TATUAPE GC
  'perdizes': '95309977',                  // BUDDHA SPA PERDIZES
  'shopping-analia-franco': '95311874',    // BUDDHA SPA SAF
}

export interface RedeCred extends Record<string, string> {
  clientId: string
  clientSecret: string
  username: string
  password: string
  pv: string
}

function baseUrl(): string {
  return (process.env.REDE_BASE_URL || BASE_PADRAO).replace(/\/$/, '')
}

/** Autentica na Rede (grant_type=password) e devolve o access_token. */
export async function autenticarRede(cred: RedeCred): Promise<string> {
  const basic = Buffer.from(`${cred.clientId}:${cred.clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'password',
    username: cred.username,
    password: cred.password,
  })
  const resp = await fetch(`${baseUrl()}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Rede OAuth ${resp.status}: ${txt.slice(0, 200)}`)
  const json = JSON.parse(txt) as { access_token?: string }
  if (!json.access_token) throw new Error(`Rede OAuth sem access_token: ${txt.slice(0, 200)}`)
  return json.access_token
}

// Converte "2026-09-01T..." ou "01/09/2026" → "YYYY-MM-DD".
function toISO(s: unknown): string {
  const t = String(s ?? '').trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// [VERIFICAR] Rede pode devolver o valor em CENTAVOS (inteiro) — se for o caso,
// setar REDE_VALOR_EM_CENTAVOS=true no .env que dividimos por 100.
function valorEmReais(v: unknown): number {
  const raw = num(v)
  if (!Number.isFinite(raw)) return NaN
  return process.env.REDE_VALOR_EM_CENTAVOS === 'true' ? raw / 100 : raw
}

type Venda = Record<string, unknown>

/** Extrai a lista de vendas de um payload de resposta (nomes de campo defensivos). */
function extrairLista(json: Record<string, unknown>): Venda[] {
  const cand = json.sales ?? json.content ?? json.transactions ?? json.data ?? json.records ?? []
  return Array.isArray(cand) ? (cand as Venda[]) : []
}

/** Extrai o cursor de próxima página, se houver (paginação por cursor da Rede). */
function proximoCursor(json: Record<string, unknown>): string | null {
  const c = json.cursor ?? json.nextCursor ?? json.next ??
    (json.pagination as Record<string, unknown> | undefined)?.cursor ??
    (json._links as Record<string, { href?: string }> | undefined)?.next?.href
  return c ? String(c) : null
}

/** Busca todas as vendas do EC no período (paginando). */
export async function buscarVendasRede(
  token: string, pv: string, dataIniISO: string, dataFimISO: string,
): Promise<Venda[]> {
  const SIZE = 200
  const all: Venda[] = []
  let cursor: string | null = null
  let guarda = 0
  do {
    const qs = new URLSearchParams({ startDate: dataIniISO, endDate: dataFimISO, size: String(SIZE) })
    if (cursor) qs.set('cursor', cursor)
    const url = `${baseUrl()}/statement/v1/sales/${pv}/daily?${qs.toString()}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    const txt = await resp.text()
    if (!resp.ok) throw new Error(`Rede sales ${resp.status} (PV ${pv}): ${txt.slice(0, 200)}`)
    const json = JSON.parse(txt) as Record<string, unknown>
    const lista = extrairLista(json)
    all.push(...lista)
    cursor = proximoCursor(json)
    if (lista.length === 0) break
  } while (cursor && ++guarda < 100)
  return all
}

/** Mapeia uma venda da Rede → TransacaoExterna (mapeamento defensivo). */
export function mapearVenda(v: Venda, pv: string): TransacaoExterna | null {
  const g = (...ks: string[]) => { for (const k of ks) if (v[k] != null) return v[k]; return undefined }
  const data = toISO(g('saleDate', 'date', 'transactionDate', 'dateAccounting', 'saleDateTime'))
  const valor = valorEmReais(g('grossAmount', 'amount', 'saleAmount', 'originalAmount', 'value'))
  if (!data || !Number.isFinite(valor)) return null

  const nsu = g('nsu', 'nsuAcquirer', 'acquirerTransactionId', 'transactionId', 'id', 'saleId')
  const autoriz = g('authorizationCode', 'authorization', 'authorizationNumber')
  const bandeira = g('brand', 'cardBrand', 'flag')
  const modalidade = g('modality', 'paymentType', 'transactionType', 'productType') // crédito/débito
  const status = g('status', 'saleStatus')

  // Chave estável: id da transação se houver, senão NSU+data+autorização+valor.
  const refExterna = String(
    g('id', 'transactionId', 'saleId') ??
    `${nsu ?? 'sem-nsu'}-${data}-${autoriz ?? ''}-${valor.toFixed(2)}`,
  )

  const forma = [bandeira, modalidade].filter(Boolean).join(' ').trim() || 'Cartão'
  return {
    origem: 'OPERADORA_CARTAO',
    refExterna,
    data,
    dataHora: null,
    valor,
    formaPagamento: forma,
    descricao: [status ? `status:${status}` : null, `PV:${pv}`].filter(Boolean).join(' · ') || null,
    raw: v,
  }
}

export class ConectorRede implements ConectorCartao {
  nome = 'Rede'
  async buscar(cred: Record<string, string>, dataIniISO: string, dataFimISO: string): Promise<TransacaoExterna[]> {
    const c = cred as RedeCred
    if (!c.clientId || !c.clientSecret || !c.username || !c.password) {
      throw new Error('Rede: credenciais incompletas (clientId/clientSecret/username/password)')
    }
    if (!c.pv) throw new Error('Rede: PV (nº do estabelecimento) ausente')
    const token = await autenticarRede(c)
    const vendas = await buscarVendasRede(token, c.pv, dataIniISO, dataFimISO)
    return vendas.map((v) => mapearVenda(v, c.pv)).filter((t): t is TransacaoExterna => t !== null)
  }
}

/** Monta as credenciais da Rede p/ uma unidade a partir do ambiente + mapa de PV. */
export function getRedeCred(slug: string): RedeCred | null {
  const pv = REDE_PV[slug]
  const clientId = process.env.REDE_CLIENT_ID
  const clientSecret = maybeDecrypt(process.env.REDE_CLIENT_SECRET)
  const username = process.env.REDE_USERNAME
  const password = maybeDecrypt(process.env.REDE_PASSWORD)
  if (!pv || !clientId || !clientSecret || !username || !password) return null
  return { clientId, clientSecret, username, password, pv }
}
