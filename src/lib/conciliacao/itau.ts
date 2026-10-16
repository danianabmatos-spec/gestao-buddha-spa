import https from 'node:https'
import fs from 'node:fs'
import { salvarFontesExternas, type TransacaoExterna } from '@/lib/conciliacao/fontes-externas'
import { conciliarPixUnidade } from '@/lib/conciliacao/motor'
import { prisma } from '@/lib/prisma'
import {
  CONTAS_ITAU, accountStatement, credsDaUnidade, itauConfigurado,
  ITAU_TOKEN_URL, ITAU_EXTRATO_URL, ITAU_SCOPE,
} from '@/lib/conciliacao/itau-config'

// ─── Conector Itaú · API de Extrato Conta Corrente (v1-externo) ───────────────────
// Autentica via mTLS (certificado dinâmico) + OAuth2 client_credentials, puxa o extrato
// e joga no MESMO motor do OFX (FonteExterna BANCO_PIX → conciliarPixUnidade). Assim a
// automação do Itaú substitui a importação manual de OFX, sem reescrever a conciliação.
//
// ⚠️ Os formatos exatos (corpo do token, rota/params do extrato, nomes dos campos do
// lançamento) vêm da doc do Devportal — estão marcados com AJUSTAR e são fáceis de trocar
// quando virmos a primeira resposta real (igual fizemos com o OFX).

// ── Requisição mTLS (node:https) usando o certificado dinâmico da unidade ────────
interface RespItau { status: number; body: string }
function requestMtls(slug: string, opts: { method: string; url: string; headers?: Record<string, string>; body?: string }): Promise<RespItau> {
  const creds = credsDaUnidade(slug)
  if (!creds?.certPath || !creds?.keyPath) return Promise.reject(new Error(`Certificado do Itaú não configurado p/ ${slug}`))
  const u = new URL(opts.url)
  const agent = new https.Agent({
    cert: fs.readFileSync(creds.certPath),
    key: fs.readFileSync(creds.keyPath),
    passphrase: creds.certSenha ?? undefined,
    keepAlive: true,
  })
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method: opts.method, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: opts.headers, agent },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      },
    )
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

// ── Access token (OAuth2 client_credentials), cache em memória por unidade ───────
const tokenCache = new Map<string, { token: string; exp: number }>()
async function obterAccessToken(slug: string): Promise<string> {
  const cached = tokenCache.get(slug)
  if (cached && cached.exp > Date.now() + 30_000) return cached.token
  const creds = credsDaUnidade(slug)!
  // AJUSTAR conforme Devportal: corpo/headers do grant_type=client_credentials.
  const corpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.credencial,
    ...(creds.secret ? { client_secret: creds.secret } : {}),
    ...(ITAU_SCOPE ? { scope: ITAU_SCOPE } : {}),
  }).toString()
  const r = await requestMtls(slug, {
    method: 'POST', url: ITAU_TOKEN_URL,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: corpo,
  })
  if (r.status < 200 || r.status >= 300) throw new Error(`Itaú token ${r.status}: ${r.body.slice(0, 300)}`)
  const j = JSON.parse(r.body) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new Error('Itaú: resposta de token sem access_token')
  tokenCache.set(slug, { token: j.access_token, exp: Date.now() + (j.expires_in ?? 300) * 1000 })
  return j.access_token
}

// ── Busca o extrato de um período (YYYY-MM-DD) ───────────────────────────────────
interface LancamentoItau { [k: string]: unknown }
async function buscarExtrato(slug: string, dataIni: string, dataFim: string): Promise<LancamentoItau[]> {
  const conta = CONTAS_ITAU[slug]
  const token = await obterAccessToken(slug)
  const acct = accountStatement(conta)
  // AJUSTAR conforme Devportal: rota + params de data. Padrão provável:
  //   GET {ITAU_EXTRATO_URL}/{accountStatement}?dataInicio=..&dataFim=..
  const url = `${ITAU_EXTRATO_URL.replace(/\/$/, '')}/${acct}?dataInicio=${dataIni}&dataFim=${dataFim}`
  const r = await requestMtls(slug, {
    method: 'GET', url,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'x-itau-apikey': credsDaUnidade(slug)!.credencial },
  })
  if (r.status < 200 || r.status >= 300) throw new Error(`Itaú extrato ${r.status}: ${r.body.slice(0, 300)}`)
  const j = JSON.parse(r.body)
  // AJUSTAR: o array de lançamentos pode vir em data.lancamentos / data.items / etc.
  const arr = j?.data?.lancamentos ?? j?.lancamentos ?? j?.data?.transactions ?? j?.data ?? []
  return Array.isArray(arr) ? arr : []
}

// ── Mapeamento (AJUSTAR aos nomes reais dos campos do extrato) ───────────────────
const str = (l: LancamentoItau, ...ks: string[]) => { for (const k of ks) { const v = l[k]; if (typeof v === 'string' && v) return v } return '' }
const num = (l: LancamentoItau, ...ks: string[]) => { for (const k of ks) { const v = l[k]; if (typeof v === 'number') return v; if (typeof v === 'string' && v && !isNaN(Number(v.replace(',', '.')))) return Number(v.replace(',', '.')) } return 0 }

function dataLanc(l: LancamentoItau): string {
  const d = str(l, 'dataLancamento', 'data', 'date', 'dataMovimento')
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/) || d.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`
}
// Crédito positivo. Alguns extratos vêm com sinal no valor; outros com tipo C/D separado.
function valorCredito(l: LancamentoItau): number {
  const tipo = str(l, 'tipoLancamento', 'tipo', 'indicadorLancamento', 'natureza').toUpperCase()
  let v = num(l, 'valorLancamento', 'valor', 'amount', 'valorMovimento')
  if (tipo && /^D|DEB|DÉBITO|DEBITO|S$/.test(tipo)) v = -Math.abs(v)
  else if (tipo && /^C|CRED|CRÉDITO|CREDITO|E$/.test(tipo)) v = Math.abs(v)
  return v
}
const RE_PIX = /\bpix\b/i
function ehPixRecebidoItau(l: LancamentoItau): boolean {
  const hist = str(l, 'descricaoLancamento', 'historico', 'descricao', 'memo', 'complemento')
  return valorCredito(l) > 0 && RE_PIX.test(hist)
}
function idLanc(l: LancamentoItau, i: number): string {
  return str(l, 'idLancamento', 'id', 'identificadorTransacao', 'endToEndId', 'numeroDocumento') || `itau-${dataLanc(l)}-${i}`
}

export interface ResultadoItau {
  unidadeSlug: string
  configurado: boolean
  motivo?: string
  lidas: number
  pixRecebidos: number
  gravadas: number
  dias: string[]
  periodo: { de: string; ate: string } | null
}

// Puxa o extrato do Itaú no período e concilia (mesmo pipeline do OFX). Idempotente por id.
export async function ingerirExtratoItau(unidadeSlug: string, dataIni: string, dataFim: string): Promise<ResultadoItau> {
  const cfg = itauConfigurado(unidadeSlug)
  if (!cfg.ok) return { unidadeSlug, configurado: false, motivo: cfg.motivo, lidas: 0, pixRecebidos: 0, gravadas: 0, dias: [], periodo: null }

  const lancamentos = await buscarExtrato(unidadeSlug, dataIni, dataFim)
  const pix = lancamentos.filter(ehPixRecebidoItau)
  const registros: TransacaoExterna[] = pix.map((l, i): TransacaoExterna => ({
    origem: 'BANCO_PIX',
    refExterna: idLanc(l, i),
    data: dataLanc(l),
    valor: Number(valorCredito(l).toFixed(2)),
    formaPagamento: 'Pix - Banco',
    descricao: (str(l, 'descricaoLancamento', 'historico', 'descricao', 'memo') || '').slice(0, 200) || null,
    raw: l,
  })).filter((r) => r.data && r.refExterna)

  const res = await salvarFontesExternas(unidadeSlug, registros)
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug }, select: { id: true } })
  if (unidade) await conciliarPixUnidade(unidade.id)

  const datas = registros.map((r) => r.data).sort()
  return {
    unidadeSlug, configurado: true,
    lidas: lancamentos.length, pixRecebidos: pix.length, gravadas: res.gravadas, dias: res.dias,
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
  }
}
