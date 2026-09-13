const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const $ = (id) => document.getElementById(id)

// Mês de referência padrão = mês anterior
function mesAnterior() {
  const d = new Date()
  let mes = d.getMonth(), ano = d.getFullYear()
  if (mes === 0) { mes = 12; ano -= 1 }
  return { ano, mes }
}

let UNIDADES = []

async function init() {
  const ref = mesAnterior()
  // selects de mês/ano
  MESES.forEach((m, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = m; if (i + 1 === ref.mes) o.selected = true; $('mes').appendChild(o) })
  ;[ref.ano - 1, ref.ano, ref.ano + 1].forEach((a) => { const o = document.createElement('option'); o.value = a; o.textContent = a; if (a === ref.ano) o.selected = true; $('ano').appendChild(o) })

  // carrega config atual
  const cfg = await chrome.runtime.sendMessage({ action: 'get-unidades' })
  UNIDADES = cfg.unidades || []
  $('erpUrl').value = cfg.erpUrl || 'https://gestao.solcentral.com.br'

  const cont = $('cfgUnidades')
  cont.innerHTML = ''
  let faltaSenha = 0
  UNIDADES.forEach((u) => {
    const row = document.createElement('div')
    row.className = 'cfg-row'
    row.innerHTML = `<span>${u.nome}</span>
      <input data-user="${u.slug}" value="${u.user || ''}" placeholder="usuário" />
      <input data-pwd="${u.slug}" type="password" value="${u.pwd || ''}" placeholder="senha" />`
    cont.appendChild(row)
    if (!u.pwd) faltaSenha++
  })
  if (faltaSenha) { $('cfg').open = true; log(`Configure a senha de ${faltaSenha} unidade(s) antes de sincronizar.`, 'run') }
}

function log(texto, cls) {
  const d = document.createElement('div')
  d.className = 'item'
  d.innerHTML = `<span>${texto}</span>`
  if (cls) d.classList.add(cls)
  $('log').prepend(d)
}

$('salvar').addEventListener('click', async () => {
  const senhas = {}, usuarios = {}
  document.querySelectorAll('[data-pwd]').forEach((i) => { if (i.value) senhas[i.getAttribute('data-pwd')] = i.value })
  document.querySelectorAll('[data-user]').forEach((i) => { if (i.value) usuarios[i.getAttribute('data-user')] = i.value })
  await chrome.storage.local.set({ senhas, usuarios, erpUrl: $('erpUrl').value.trim() || 'https://gestao.solcentral.com.br' })
  log('✔ Configurações salvas.', 'ok')
  init()
})

$('sync').addEventListener('click', () => {
  const ano = Number($('ano').value), mes = Number($('mes').value)
  $('log').innerHTML = ''
  log(`Iniciando ${MESES[mes - 1]}/${ano}…`, 'run')
  $('sync').disabled = true
  chrome.runtime.sendMessage({ action: 'sync-now', ano, mes })
    .then((r) => { if (r && !r.success) log('Erro: ' + r.error, 'err') })
    .catch(() => {})
    .finally(() => { $('sync').disabled = false })
})

// progresso vindo do background
chrome.runtime.onMessage.addListener((m) => {
  if (m.tipo !== 'progresso') return
  if (m.inicio) log(`Puxando ${m.total} unidades…`, 'run')
  else if (m.info) log(m.info, 'run')
  else if (m.etapa) {
    const brl = (n) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    if (m.status === 'processando') log(`(${m.i}/${m.total}) ${m.nome}…`, 'run')
    else if (m.status === 'ok') log(`✔ ${m.nome}: Vouchers R$ ${brl(m.detalhe.vouchers)} · Cort ${m.detalhe.cortesias}`, 'ok')
    else log(`✖ ${m.nome}: ${m.detalhe.error || m.detalhe.erro || 'erro'}`, 'err')
  } else if (m.fim) {
    if (m.erro) log(m.erro, 'err')
    else log(`Concluído: ${m.ok}/${m.total} unidades enviadas.`, 'ok')
  }
})

init()
