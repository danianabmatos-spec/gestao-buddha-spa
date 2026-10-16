// ─── Config da integração Itaú (API de Extrato Conta Corrente v1-externo) ─────────
// Modelo de autenticação do Itaú (confirmado no e-mail de Implantação Cash):
//   • BOOTSTRAP (uma vez por CNPJ): com a CREDENCIAL + TOKEN TEMPORÁRIO (validade 7 dias)
//     gera-se um CERTIFICADO DINÂMICO (validade 1 ano) — via Postman/Insomnia (Fluxo
//     Primeira Chamada Varejo) ou no Devportal → Produção → Certificado Dinâmico. O token
//     temporário NÃO chama a API; serve só pra gerar o certificado. Guardar cert+key no
//     servidor e apontar aqui via env.
//   • RUNTIME (diário/automático): com o CERTIFICADO (mTLS) + CREDENCIAL/SECRET pega-se um
//     ACCESS TOKEN (OAuth2 client_credentials) e chama-se o extrato.
// Docs: https://devportal.itau.com.br/nossas-apis/itau-vw9-api-account-statement-v1-externo
//
// NADA de segredo no código — tudo vem do .env (nunca commitar). Variáveis esperadas:
//   Globais:
//     ITAU_TOKEN_URL     = endpoint OAuth de access token (do Devportal/Fluxo)
//     ITAU_EXTRATO_URL   = base do extrato v1-externo (do Devportal)
//     ITAU_SCOPE         = escopo(s) do token, se exigido (opcional)
//   Por unidade (SLUG maiúsculo, '-' → '_'; ex.: ANALIA_FRANCO):
//     ITAU_<SLUG>_CREDENCIAL  = a "CREDENCIAL" (client_id) da planilha
//     ITAU_<SLUG>_SECRET      = client_secret (se o fluxo OAuth exigir)
//     ITAU_<SLUG>_CERT_PATH   = caminho do certificado dinâmico (PEM) no servidor
//     ITAU_<SLUG>_KEY_PATH    = caminho da chave privada (PEM) do certificado
//     ITAU_<SLUG>_CERT_SENHA  = senha da chave, se houver
//     ITAU_<SLUG>_TOKEN_TEMP  = token temporário (só p/ o bootstrap do certificado)

export interface ContaItau {
  agencia: string // 4 dígitos
  conta: string   // 5 dígitos
  dac: string     // 1 dígito
}

// Coordenadas bancárias por unidade. Anália já conhecida (extrato OFX de out/26).
// As demais: preencher conforme forem chegando as contas/credenciais (1 CNPJ por unidade).
export const CONTAS_ITAU: Record<string, ContaItau> = {
  'analia-franco': { agencia: '0002', conta: '70565', dac: '5' },
  // 'shopping-metropole': { agencia: '', conta: '', dac: '' },
  // 'shopping-analia-franco': { agencia: '', conta: '', dac: '' },
  // 'perdizes': { agencia: '', conta: '', dac: '' },
  // 'tatuape-gomescardim': { agencia: '', conta: '', dac: '' },
  // 'mooca-plaza': { agencia: '', conta: '', dac: '' },
  // 'higienopolis': { agencia: '', conta: '', dac: '' },
}

// accountStatement = agência(4) + "00" + conta(5) + DAC(1)  (formato exigido pelo Itaú).
export function accountStatement(c: ContaItau): string {
  return `${c.agencia}00${c.conta}${c.dac}`
}

export interface CredsItau {
  credencial: string
  secret: string | null
  certPath: string | null
  keyPath: string | null
  certSenha: string | null
  tokenTemp: string | null
}

function envKey(slug: string, sufixo: string): string {
  return `ITAU_${slug.toUpperCase().replace(/-/g, '_')}_${sufixo}`
}

// Lê as credenciais da unidade do .env. null se a CREDENCIAL não estiver setada (unidade
// ainda não configurada — o conector pula sem quebrar).
export function credsDaUnidade(slug: string): CredsItau | null {
  const credencial = process.env[envKey(slug, 'CREDENCIAL')]
  if (!credencial) return null
  return {
    credencial,
    secret: process.env[envKey(slug, 'SECRET')] ?? null,
    certPath: process.env[envKey(slug, 'CERT_PATH')] ?? null,
    keyPath: process.env[envKey(slug, 'KEY_PATH')] ?? null,
    certSenha: process.env[envKey(slug, 'CERT_SENHA')] ?? null,
    tokenTemp: process.env[envKey(slug, 'TOKEN_TEMP')] ?? null,
  }
}

export const ITAU_TOKEN_URL = process.env.ITAU_TOKEN_URL ?? ''
export const ITAU_EXTRATO_URL = process.env.ITAU_EXTRATO_URL ?? ''
export const ITAU_SCOPE = process.env.ITAU_SCOPE ?? ''

// Unidade pronta p/ sincronizar via Itaú? (coordenadas + credencial + certificado + endpoints)
export function itauConfigurado(slug: string): { ok: boolean; motivo?: string } {
  if (!CONTAS_ITAU[slug]) return { ok: false, motivo: 'sem coordenadas bancárias (agência/conta/DAC)' }
  const c = credsDaUnidade(slug)
  if (!c) return { ok: false, motivo: 'sem CREDENCIAL no .env' }
  if (!c.certPath || !c.keyPath) return { ok: false, motivo: 'sem certificado dinâmico (CERT_PATH/KEY_PATH)' }
  if (!ITAU_TOKEN_URL || !ITAU_EXTRATO_URL) return { ok: false, motivo: 'sem ITAU_TOKEN_URL/ITAU_EXTRATO_URL' }
  return { ok: true }
}
