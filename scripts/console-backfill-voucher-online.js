// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL do histórico de VOUCHER ONLINE (site/WordPress) — unidade Higienópolis
//
// COMO USAR:
//   1. Abra https://buddhaspa.com.br/wp-admin (faça login normalmente)
//   2. Abra o Console do Chrome (F12 → aba "Console")
//   3. Cole TODO este arquivo e pressione Enter
//   4. Aguarde — ele percorre mês a mês de 2023 até o mês passado (uns 1-2 min)
//   5. No fim, abra: https://gestao.solcentral.com.br/dashboard/higienopolis/historico
//
// Ele usa a SUA sessão do WordPress (passa o Cloudflare) pra baixar o HTML de cada
// mês e envia pro ERP, que soma o reembolso e monta o gráfico.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const UNIDADE = 'higienopolis'
  const AFFILIATION = '708'                 // afiliação do Higienópolis no WordPress
  const API = 'https://gestao.solcentral.com.br/api/historico/voucher-online'
  const ANO_INI = 2023, MES_INI = 1

  const hoje = new Date()
  let anoFim = hoje.getFullYear()
  let mesFim = hoje.getMonth()              // 0-based → já é o mês ANTERIOR (fechado)
  if (mesFim === 0) { mesFim = 12; anoFim -= 1 }
  const pad = (n) => String(n).padStart(2, '0')

  console.log(`Backfill voucher online ${UNIDADE}: ${ANO_INI}-01 → ${anoFim}-${pad(mesFim)}`)
  let ok = 0, erros = 0, totalGeral = 0
  for (let ano = ANO_INI; ano <= anoFim; ano++) {
    const m1 = ano === ANO_INI ? MES_INI : 1
    const m2 = ano === anoFim ? mesFim : 12
    for (let mes = m1; mes <= m2; mes++) {
      const ini = `${ano}-${pad(mes)}-01`
      const fim = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`
      const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0`
                + `&date_sell_start=&date_sell_end=&date_used_start=${ini}&date_used_end=${fim}&affilliation_id=${AFFILIATION}`
      try {
        const html = await (await fetch(url, { credentials: 'include' })).text()
        const r = await (await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unidadeSlug: UNIDADE, ano, mes, html }),
        })).json()
        if (r.ok) { ok++; totalGeral += r.voucherOnline; console.log(`  ${ano}-${pad(mes)}: R$ ${r.voucherOnline.toFixed(2)} (${r.vouchers} vouchers)`) }
        else { erros++; console.log(`  ${ano}-${pad(mes)}: ERRO — ${r.error}`) }
      } catch (e) { erros++; console.log(`  ${ano}-${pad(mes)}: FALHA — ${e.message}`) }
      await new Promise((res) => setTimeout(res, 800))  // respira entre os meses
    }
  }
  console.log(`\n✅ Fim: ${ok} meses OK, ${erros} erros, total R$ ${totalGeral.toFixed(2)}.`)
  console.log('Confira: https://gestao.solcentral.com.br/dashboard/higienopolis/historico')
})();
