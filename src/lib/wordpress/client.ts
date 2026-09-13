// WordPress client — Application Password (REST API) + Browser Relay (admin pages)
//
// Autenticação: Application Password funciona para REST API (/wp-json/)
// Para a página admin de vouchers (HTML), usa Browser Relay:
//   O browser (com sessão ativa) faz o fetch e envia para /api/vouchers/sync

const WP_URL = 'https://buddhaspa.com.br'
const WP_USER = process.env.WP_METROPOLE_USER!
const WP_APP_PASS = process.env.WP_METROPOLE_APP_PASS!
const WP_AFFILIATION = process.env.WP_METROPOLE_AFFILIATION ?? '894555'

function getBasicAuth(): string {
  return `Basic ${Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64')}`
}

const API_HEADERS = {
  'Authorization': getBasicAuth(),
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36',
}

// Testa autenticação REST API
export async function testarAuth(): Promise<{ ok: boolean; user?: string; error?: string }> {
  try {
    const resp = await fetch(`${WP_URL}/wp-json/wp/v2/users/me`, {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(30_000),
    })
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` }
    const user = await resp.json()
    return { ok: true, user: user.name }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// Valida voucher via REST API (Application Password autentica corretamente)
export async function validarVoucher(voucherKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const resp = await fetch(`${WP_URL}/wp-json/buddha/v1/update-voucher`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ key: voucherKey, affilliation_id: WP_AFFILIATION }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await resp.json().catch(() => ({}))
    return {
      success: resp.ok,
      message: data?.message ?? (resp.ok ? 'Voucher validado com sucesso' : `Erro HTTP ${resp.status}`),
    }
  } catch (err) {
    throw new Error(`Falha ao validar: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// URL correta para a página de vouchers com filtro de data
// Descoberta via análise do formulário: usa GET sem refounded/notrefounded no query string
export function getVouchersUrl(dataIni: string, dataFim: string): string {
  return `${WP_URL}/wp-admin/admin.php?` + new URLSearchParams({
    page: 'vouchers',
    status: '',
    product_id: '0',
    category_id: '0',
    date_sell_start: '',
    date_sell_end: '',
    date_used_start: dataIni,
    date_used_end: dataFim,
    affilliation_id: WP_AFFILIATION,
  }).toString()
}

// Script de relay para ser executado pelo browser na página buddhaspa.com.br
// Extrai os dados e envia para nosso servidor local
export function getBrowserRelayScript(dataIni: string, dataFim: string, callbackUrl: string): string {
  return `
(async () => {
  const url = '${getVouchersUrl(dataIni, dataFim)}';

  // Navega para a página filtrada e captura o HTML
  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();

  // Envia para o servidor Next.js
  const syncResp = await fetch('${callbackUrl}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataIni: '${dataIni}', dataFim: '${dataFim}', html }),
  });

  const result = await syncResp.json();
  console.log('[Vouchers Sync]', result.rowCount, 'vouchers, R$', result.totalReembolso);
  return result;
})();
  `.trim()
}

export { WP_AFFILIATION, WP_URL }
