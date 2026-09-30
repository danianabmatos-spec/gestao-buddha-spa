// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL do histórico de VOUCHER ONLINE (site/WordPress) — uma unidade por vez
//
// IMPORTANTE — a UNIDADE é definida pela CONTA logada no WordPress, NÃO pela URL.
//   Testado (30/09/2026): o parâmetro `affilliation_id` da URL é IGNORADO — a
//   conta só enxerga os vouchers da própria unidade. Então, para cada unidade,
//   faça login com a conta DAQUELA unidade e ajuste `UNIDADE` abaixo pra bater.
//
// COMO USAR:
//   1. Faça login em https://buddhaspa.com.br/wp-admin com a conta DA UNIDADE.
//   2. Ajuste a constante UNIDADE abaixo (slug usado no ERP).
//   3. Abra o Console do Chrome (F12 → aba "Console"), cole TODO este arquivo, Enter.
//   4. Aguarde — percorre mês a mês de 2023 até o mês passado (uns 2-4 min).
//   5. Confira: https://gestao.solcentral.com.br/dashboard/<UNIDADE>/historico
//
// Usa a SUA sessão do WordPress (passa o Cloudflare) pra baixar o HTML de cada mês
// — INCLUINDO TODAS AS PÁGINAS (a lista pagina de 200 em 200; sem isso, meses com
// 400+ vouchers ficariam pela METADE) — e envia pro ERP, que soma o reembolso.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const UNIDADE = 'higienopolis'            // ⚠️ AJUSTE p/ a unidade da conta logada
  const API = 'https://gestao.solcentral.com.br/api/historico/voucher-online'
  const ANO_INI = 2023, MES_INI = 1

  const hoje = new Date()
  let anoFim = hoje.getFullYear()
  let mesFim = hoje.getMonth()              // 0-based → já é o mês ANTERIOR (fechado)
  if (mesFim === 0) { mesFim = 12; anoFim -= 1 }
  const pad = (n) => String(n).padStart(2, '0')
  const reTbody = /<tbody[^>]*id=["']the-list["'][^>]*>([\s\S]*?)<\/tbody>/
  const reTotal = /class=["']total-pages["']>([\d.]+)</

  // Baixa TODAS as páginas do mês e devolve um único <tbody> com todas as linhas.
  async function htmlDoMes(ano, mes) {
    const ini = `${ano}-${pad(mes)}-01`
    const fim = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`
    const base = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0`
              + `&date_sell_start=&date_sell_end=&date_used_start=${ini}&date_used_end=${fim}`
    const h1 = await (await fetch(base, { credentials: 'include' })).text()
    const totalPaginas = parseInt((h1.match(reTotal)?.[1] || '1').replace('.', ''), 10) || 1
    let linhas = h1.match(reTbody)?.[1] || ''
    if (totalPaginas > 1) {
      const resto = await Promise.all(
        Array.from({ length: totalPaginas - 1 }, (_, i) =>
          fetch(`${base}&paged=${i + 2}`, { credentials: 'include' }).then((r) => r.text())),
      )
      for (const hp of resto) linhas += hp.match(reTbody)?.[1] || ''
    }
    return { html: `<tbody id="the-list">${linhas}</tbody>`, totalPaginas }
  }

  console.log(`Backfill voucher online ${UNIDADE}: ${ANO_INI}-01 → ${anoFim}-${pad(mesFim)}`)
  let ok = 0, erros = 0, totalGeral = 0
  for (let ano = ANO_INI; ano <= anoFim; ano++) {
    const m1 = ano === ANO_INI ? MES_INI : 1
    const m2 = ano === anoFim ? mesFim : 12
    for (let mes = m1; mes <= m2; mes++) {
      try {
        const { html, totalPaginas } = await htmlDoMes(ano, mes)
        const r = await (await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unidadeSlug: UNIDADE, ano, mes, html }),
        })).json()
        if (r.ok) { ok++; totalGeral += r.voucherOnline; console.log(`  ${ano}-${pad(mes)}: R$ ${r.voucherOnline.toFixed(2)} (${r.vouchers} vouchers, ${totalPaginas} pág.)`) }
        else { erros++; console.log(`  ${ano}-${pad(mes)}: ERRO — ${r.error}`) }
      } catch (e) { erros++; console.log(`  ${ano}-${pad(mes)}: FALHA — ${e.message}`) }
      await new Promise((res) => setTimeout(res, 500))  // respira entre os meses
    }
  }
  console.log(`\n✅ Fim: ${ok} meses OK, ${erros} erros, total R$ ${totalGeral.toFixed(2)}.`)
  console.log(`Confira: https://gestao.solcentral.com.br/dashboard/${UNIDADE}/historico`)
})();
