// Sync de vouchers WordPress → Buddha Board
// Usa DOMParser (não regex) para parsear o HTML — rodar no console do Chrome
//
// COMO USAR:
//   1. Logue no WordPress: https://buddhaspa.com.br/wp-admin
//   2. Abra o console (F12)
//   3. Ajuste dataIni, dataFim e API_URL abaixo
//   4. Cole e execute

(async () => {
  // ─── CONFIG ──────────────────────────────────────────────
  const dataIni     = '2026-07-01'
  const dataFim     = '2026-07-11'  // até hoje
  const AFFILIATION = '894555'
  const API_URL     = 'http://localhost:3002/api/vouchers/sync'
  // ─────────────────────────────────────────────────────────

  function parseMoeda(txt) {
    if (!txt) return 0
    return parseFloat(txt.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
  }

  function parseVouchers(doc, tipo) {
    const rows = doc.querySelectorAll('tbody#the-list tr')
    const vouchers = []

    for (const row of rows) {
      const get = (col) => (row.querySelector(`td[data-colname="${col}"]`)?.textContent ?? '').trim()

      const codigo = get('Código')
      if (!codigo) continue

      const produto       = get('Nome').replace('Mostrar mais detalhes', '').trim()
      const dataVenda     = get('Data da Venda')
      const dataTerapia   = get('Data da Utilização')
      const unidade       = get('Unidade')
      const statusVoucher = get('Status')
      const valorStr      = get('Valor de Reembolso')
      const valorReembolso = parseMoeda(valorStr)

      const status = statusVoucher.includes('Utilizado') ? 'Utilizado'
                   : statusVoucher.includes('Validado')  ? 'Validado'
                   : 'Pendente'

      vouchers.push({ codigo, produto, dataVenda, dataTerapia, unidade, statusVoucher, status, formaValidacao: 'Automatico', valorReembolso })
    }

    if (tipo === 'cortesia') {
      return vouchers.filter(v => v.valorReembolso === 0)
    }
    return vouchers
  }

  const tipos = [
    { tipo: 'site',         url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}` },
    { tipo: 'omnichannel',  url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=${dataIni}&date_sell_end=${dataFim}&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=${AFFILIATION}` },
    { tipo: 'cortesia',     url: `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}` },
  ]

  console.log(`🚀 Sincronizando ${dataIni} a ${dataFim}...\n`)

  for (const { tipo, url } of tipos) {
    console.log(`📅 ${tipo.toUpperCase()}...`)

    const resp = await fetch(url, { credentials: 'include' })
    const html = await resp.text()
    const doc  = new DOMParser().parseFromString(html, 'text/html')

    const vouchers       = parseVouchers(doc, tipo)
    const totalReembolso = tipo === 'cortesia' ? 0 : vouchers.reduce((s, v) => s + v.valorReembolso, 0)
    const totalValor     = tipo === 'cortesia' ? vouchers.reduce((s, v) => {
      const m = v.produto.match(/R\$\s*([\d.,]+)/)
      return s + (m ? parseMoeda(m[1]) : 0)
    }, 0) : undefined

    console.log(`  ✓ ${vouchers.length} vouchers | R$ ${tipo === 'cortesia' ? totalValor : totalReembolso}`)

    const result = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataIni, dataFim, tipo,
        totalReembolso,
        totalValor,
        totalValidados:     vouchers.length,
        pendentesValidacao: vouchers.filter(v => v.status === 'Pendente').length,
        validacaoManual:    0,
        validacaoAutomatica: vouchers.filter(v => v.status !== 'Pendente').length,
        vouchers,
      })
    })

    const data = await result.json()
    data.ok ? console.log(`  ✅ Salvo`) : console.log(`  ❌ Erro:`, data.error)
    console.log('')
  }

  console.log('✅ Sync concluído!')
  console.log(`Acesse: http://localhost:3002/vouchers e pressione Ctrl+F5`)
})()
