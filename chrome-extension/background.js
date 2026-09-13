// Buddha Spa — Reembolso Auto (service worker MV3) — v2.1
//
// Em 1 clique (ou automático dia 1º às 08:00), para cada unidade:
//   1) NAVEGA de verdade até a tela de login (roda o JS do Cloudflare e passa,
//      igual quando você loga na mão) — usa reauth=1 pra trocar de conta;
//   2) preenche usuário/senha e ENVIA o formulário (login por navegação real);
//   3) já logada, busca Vouchers/Omnichannel/Cortesias do mês (GET passa) e
//      envia ao ERP (/api/reembolso/pull).
//
// Login por FETCH não funciona: o Cloudflare exige a execução do JS da página,
// que só acontece em navegação real. As SENHAS ficam só no chrome.storage.local.

const UNIDADES_PADRAO = [
  { slug: 'higienopolis',           nome: 'Higienópolis',           unidadeId: 7, user: 'administracao@buddhaspa.com.br',                     affiliation: '708' },
  { slug: 'analia-franco',          nome: 'Anália Franco',          unidadeId: 2, user: 'buddhaanalia',                                       affiliation: '206' },
  { slug: 'perdizes',               nome: 'Perdizes',               unidadeId: 4, user: 'buddhaperdizes',                                     affiliation: '753' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco', unidadeId: 3, user: 'administracao.shoppinganaliafranco@buddhaspa.com.br', affiliation: '591248' },
  { slug: 'mooca-plaza',            nome: 'Mooca Plaza',            unidadeId: 6, user: 'buddhashoppingmooca',                                affiliation: '299557' },
  { slug: 'tatuape-gomescardim',    nome: 'Tatuapé Gomes Cardim',   unidadeId: 5, user: 'adm.tatuapegomescardim@buddhaspa.com.br',            affiliation: '857895' },
  { slug: 'shopping-metropole',     nome: 'Shopping Metrópole',     unidadeId: 1, user: 'adm.shoppingmetropole@buddhaspa.com.br',             affiliation: '894555' },
]
const ERP_PADRAO = 'https://gestao.solcentral.com.br'
const LOGIN_URL = 'https://buddhaspa.com.br/wp-login.php?reauth=1&redirect_to=%2Fwp-admin%2F'

// ─── Agendamento mensal ───────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('reembolso-mensal', { when: proximoDia1as8h(), periodInMinutes: 43200 })
})
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'reembolso-mensal') { const r = mesAnterior(); runSync(r.ano, r.mes).catch((e) => notificar('Erro no Reembolso Auto', e.message)) }
})
function proximoDia1as8h() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 1, 8, 0, 0).getTime() }
function mesAnterior() { const d = new Date(); let mes = d.getMonth(), ano = d.getFullYear(); if (mes === 0) { mes = 12; ano -= 1 } return { ano, mes } }

// ─── Config ───────────────────────────────────────────────────────────────────
async function getConfig() {
  const { senhas = {}, usuarios = {}, erpUrl = ERP_PADRAO } = await chrome.storage.local.get(['senhas', 'usuarios', 'erpUrl'])
  return { erpUrl, unidades: UNIDADES_PADRAO.map((u) => ({ ...u, user: usuarios[u.slug] || u.user, pwd: senhas[u.slug] || '' })) }
}

// ─── Sincronização ────────────────────────────────────────────────────────────
function progresso(m) { chrome.runtime.sendMessage({ tipo: 'progresso', ...m }).catch(() => {}) }

async function runSync(ano, mes) {
  const { erpUrl, unidades } = await getConfig()
  const ativas = unidades.filter((u) => u.pwd)
  if (!ativas.length) { progresso({ fim: true, erro: 'Nenhuma senha configurada (⚙️ Configurações).' }); return }

  progresso({ inicio: true, total: ativas.length, ano, mes })
  // Aba VISÍVEL: em aba de fundo o Chrome "congela" timers e o JS do Cloudflare
  // pode não rodar. Visível garante que o desafio do Cloudflare se resolva.
  const tab = await chrome.tabs.create({ url: LOGIN_URL, active: true })
  await esperarCarregar(tab.id)

  // Insiste nas que falharem (o servidor deles pisca com erro 520): até 4 rodadas,
  // reprocessando só as pendentes. As que já entraram não são refeitas.
  const MAX_ROUNDS = 8
  const resultados = new Map() // slug → {nome, ...res}
  let pendentes = ativas.slice()

  for (let round = 1; round <= MAX_ROUNDS && pendentes.length; round++) {
    if (round > 1) { progresso({ info: `Tentando de novo ${pendentes.length} unidade(s) que faltaram (rodada ${round})…` }); await sleep(3000) }
    const aindaPendentes = []
    for (const u of pendentes) {
      progresso({ etapa: true, nome: u.nome, status: 'processando' })
      let res
      try { res = await loginEPuxar(tab.id, u, ano, mes, erpUrl) }
      catch (e) { res = { ok: false, error: e.message } }
      resultados.set(u.slug, { nome: u.nome, ...res })
      progresso({ etapa: true, nome: u.nome, status: res.ok ? 'ok' : 'erro', detalhe: res })
      if (!res.ok) aindaPendentes.push(u)
      await sleep(1200)
    }
    pendentes = aindaPendentes
  }

  try { await chrome.tabs.remove(tab.id) } catch { /* já fechada */ }
  const lista = [...resultados.values()]
  const ok = lista.filter((r) => r.ok).length
  progresso({ fim: true, ok, total: ativas.length, resultados: lista })
  notificar('Reembolso Auto', `${ok}/${ativas.length} unidades enviadas ao ERP (${mes}/${ano}).`)
  return lista
}

// Fluxo por unidade: login por NAVEGAÇÃO REAL → puxa relatórios → envia ao ERP.
async function loginEPuxar(tabId, u, ano, mes, erpUrl) {
  // 1) navega até a tela de login (reauth desloga a conta anterior e força o form)
  await chrome.tabs.update(tabId, { url: LOGIN_URL })
  await esperarCarregar(tabId)

  // 2) espera o formulário aparecer (Cloudflare terminar de rodar o JS)
  const form = await esperar(tabId, checkFormLogin, (s) => s && s.form, 22000)
  if (!form) return { ok: false, error: 'Cloudflare pediu verificação no login — clique 1x nessa unidade manualmente.' }

  // 3) preenche e envia o formulário (submit real → navegação)
  await avaliar(tabId, preencherESubmeter, [u.user, u.pwd])

  // 4) espera logar (ou detectar erro/challenge)
  await sleep(1500)
  const pos = await esperar(tabId, checkPosLogin, (s) => s && (s.logado || s.erroLogin || s.challenge || s.erro5xx), 22000)
  if (!pos) return { ok: false, error: 'Login não concluiu (timeout).' }
  if (pos.erro5xx) return { ok: false, error: 'Site instável (erro 5xx) — rode essa unidade de novo daqui a pouco.' }
  if (pos.challenge) return { ok: false, error: 'Cloudflare pediu verificação — clique 1x nessa unidade manualmente.' }
  if (pos.erroLogin || !pos.logado) return { ok: false, error: 'Login falhou (confira usuário/senha).' }

  // 5) logada: busca relatórios (GET passa) e envia ao ERP
  return avaliar(tabId, buscarEEnviar, [u, ano, mes, erpUrl])
}

// ─── Funções INJETADAS na página ────────────────────────────────────────────────
function checkFormLogin() {
  return { form: !!document.querySelector('#user_login'), challenge: /just a moment|um momento/i.test(document.title || '') }
}
function preencherESubmeter(user, pwd) {
  const u = document.querySelector('#user_login'), p = document.querySelector('#user_pass')
  if (!u || !p) return { ok: false }
  u.value = user; p.value = pwd
  const btn = document.querySelector('#wp-submit')
  const form = document.querySelector('#loginform')
  if (btn) btn.click(); else if (form) form.submit()
  return { ok: true }
}
function checkPosLogin() {
  const url = location.href
  const corpo = document.body ? document.body.innerText : ''
  return {
    url,
    logado: !!document.querySelector('#wpadminbar') || (/\/wp-admin\/?(\?|$)/.test(url) && !/wp-login/.test(url)),
    erroLogin: !!document.querySelector('#login_error'),
    challenge: /just a moment|um momento/i.test(document.title || ''),
    erro5xx: /error code 5\d\d|Web server is returning an unknown error/i.test(corpo),
  }
}
function buscarEEnviar(u, ano, mes, erpUrl) {
  return (async () => {
    const mm = ('0' + mes).slice(-2), last = new Date(ano, mes, 0).getDate()
    const ini = ano + '-' + mm + '-01', fim = ano + '-' + mm + '-' + ('0' + last).slice(-2)
    const B = 'https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0'
    const usUrl = B + '&date_sell_start=&date_sell_end=&date_used_start=' + ini + '&date_used_end=' + fim + '&affilliation_id=' + u.affiliation
    const uoUrl = B + '&date_sell_start=' + ini + '&date_sell_end=' + fim + '&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=' + u.affiliation
    const chal = (h) => /just a moment|challenge-platform|um momento/i.test(h)
    const moeda = (t) => parseFloat((t || '').replace(/[R$\s.]/g, '').replace(',', '.')) || 0
    const tot = (h) => { const m = h.match(/<span>R\$\s*([\d.,]+)<\/span><\/h5>\s*<div[^>]*>Reembolso/) || h.match(/R\$\s*([\d.,]+)\s*<\/div>\s*[\s\S]{0,100}Reembolso/); return m ? moeda(m[1]) : 0 }
    const rows = (h) => {
      const tb = h.match(/<tbody[^>]*id=["']the-list["'][^>]*>([\s\S]*?)<\/tbody>/); if (!tb) return []
      const o = []; let r; const rx = /<tr[^>]*>([\s\S]*?)<\/tr>/g
      while ((r = rx.exec(tb[1]))) {
        const c = {}; const cells = []; let td; const rc = /<td([^>]*)>([\s\S]*?)<\/td>/g
        while ((td = rc.exec(r[1]))) {
          const txt = td[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
          cells.push(txt)
          const cn = td[1].match(/data-colname=["']([^"']+)["']/)
          if (cn) c[cn[1].toLowerCase().trim()] = txt
        }
        if (cells.length >= 4) { c._cells = cells; o.push(c) }
      }
      return o
    }
    const get = (c, sub) => { const k = Object.keys(c).find((x) => x.indexOf(sub) >= 0); return k ? c[k] : '' }
    const erro5xx = (h) => /error code 5\d\d|Web server is returning an unknown error/i.test(h)
    const espera = (ms) => new Promise((r) => setTimeout(r, ms))
    // Busca um relatório resistindo ao 520 intermitente (até 3 tentativas).
    async function buscar(url) {
      for (let k = 0; k < 3; k++) {
        const resp = await fetch(url, { credentials: 'include' })
        const h = await resp.text()
        if (chal(h)) return { challenge: true }
        if (resp.ok && !erro5xx(h)) return { h }
        await espera(1500)
      }
      return { falha: true }
    }
    try {
      const bs = await buscar(usUrl)
      if (bs.challenge) return { ok: false, error: 'Cloudflare pediu verificação — clique 1x nessa unidade manualmente.' }
      if (bs.falha) return { ok: false, error: 'Site instável (5xx) — o painel deles está oscilando; rode de novo.' }
      const bo = await buscar(uoUrl)
      if (bo.challenge || bo.falha) return { ok: false, error: 'Site instável (5xx) — rode de novo.' }
      const hs = bs.h, ho = bo.h
      if (/id=["']loginform["']|name=["']log["']/.test(hs)) return { ok: false, error: 'Sessão não autenticou — rode de novo.' }
      // As cortesias-serviço NÃO têm valor na tela; o valor está no EXPORT.
      // O botão "Baixar arquivo" chama admin-ajax.php?action=export_report_xlsx&<filtro>,
      // que devolve um JSON com o preço de cada voucher. Usamos esse JSON como fonte.
      const filtro = 'page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=' + ini + '&date_used_end=' + fim + '&affilliation_id=' + u.affiliation
      let expData = null
      try { expData = await fetch('https://buddhaspa.com.br/wp-admin/admin-ajax.php?action=export_report_xlsx&' + filtro, { credentials: 'include' }).then((r) => r.json()) } catch (e) { expData = null }

      const achaKey = (o, re) => Object.keys(o).find((k) => re.test(k))
      // Números do JSON vêm em formato US ("152.00"): parse direto. NÃO usar moeda() (que é BR e viraria 15200).
      const numJson = (s) => { const f = parseFloat(String(s == null ? '' : s).replace(/[^\d.-]/g, '')); return isFinite(f) ? f : 0 }
      const valorServico = (o) => {
        const g = numJson(o.PRICE_GROSS)
        if (g > 0) return g
        for (const k of Object.keys(o)) { if (/refound|reembolso|net/i.test(k)) continue; if (/gross|price|valor|value|amount/i.test(k)) { const v = numJson(o[k]); if (v > 0) return v } }
        return 0
      }

      let cort, debugObj
      if (Array.isArray(expData) && expData.length) {
        const kR = achaKey(expData[0], /refound|reembolso/i)
        const kN = achaKey(expData[0], /^name$|nome/i)
        const kK = achaKey(expData[0], /^key$|codig|código/i)
        const kU = achaKey(expData[0], /used|utiliza/i)
        const cRows = expData.filter((o) => numJson(o[kR]) === 0)
        cort = cRows.map((o) => {
          const nome = String(o[kN] || '').replace('Mostrar mais detalhes', '').trim()
          const vObj = valorServico(o)
          const m = nome.match(/R\$\s*([\d.,]+)/); const vNome = m ? moeda(m[1]) : 0
          return { codigo: String(o[kK] || ''), nome, valor: vObj > 0 ? vObj : vNome, dataUtilizacao: o[kU] || null }
        })
        debugObj = { fonte: 'export-json', totalCort: cRows.length, primeiraCortesia: cRows[0] || null }
      } else {
        const cortRows = rows(hs).filter((c) => moeda(get(c, 'reembolso')) === 0)
        cort = cortRows.map((c) => { const nome = (get(c, 'nome') || '').replace('Mostrar mais detalhes', '').trim(); const m = nome.match(/R\$\s*([\d.,]+)/); return { codigo: get(c, 'digo'), nome, valor: m ? moeda(m[1]) : 0, dataUtilizacao: get(c, 'utiliza') || null } })
        debugObj = { fonte: 'html-fallback', expData: expData === null ? 'null' : typeof expData }
      }
      const payload = { ano, mes, unidadeId: u.unidadeId, vouchers: tot(hs), omnichannel: tot(ho), cortesias: cort, debug: debugObj }
      const r = await fetch(erpUrl + '/api/reembolso/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((x) => x.json())
      return { ok: !!r.ok, vouchers: payload.vouchers, omnichannel: payload.omnichannel, cortesias: cort.length, cortesiaUsada: cort.reduce((a, c) => a + c.valor, 0), erro: r.ok ? null : (r.error || 'erro no ERP') }
    } catch (e) { return { ok: false, error: e.message } }
  })()
}

// ─── util ───────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
async function avaliar(tabId, func, args = []) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args })
  return r ? r.result : null
}
async function esperar(tabId, func, cond, timeoutMs, intervalMs = 1000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    let s = null
    try { s = await avaliar(tabId, func) } catch { /* página trocando */ }
    if (cond(s)) return s
    await sleep(intervalMs)
  }
  return null
}
function esperarCarregar(tabId) {
  return new Promise((resolve) => {
    let done = false
    const fin = () => { if (!done) { done = true; try { chrome.tabs.onUpdated.removeListener(l) } catch {} resolve() } }
    const l = (id, info) => { if (id === tabId && info.status === 'complete') fin() }
    chrome.tabs.onUpdated.addListener(l)
    setTimeout(fin, 12000) // rede não é garantida — segue após 12s
  })
}
function notificar(title, message) { try { chrome.notifications.create({ type: 'basic', iconUrl: 'icon48.png', title, message }) } catch { /* sem permissão */ } }

// ─── Mensagens do popup ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((req, _s, sendResponse) => {
  if (req.action === 'sync-now') { runSync(req.ano, req.mes).then((r) => sendResponse({ success: true, resultados: r })).catch((e) => sendResponse({ success: false, error: e.message })); return true }
  if (req.action === 'get-unidades') { getConfig().then((c) => sendResponse(c)).catch((e) => sendResponse({ erro: e.message })); return true }
})
