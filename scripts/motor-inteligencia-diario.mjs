/**
 * Motor de Inteligência — cron diário (05:00, após sync-belle-diario das 04:00)
 * Calcula scores de churn, upgrade e Day Spa para todas as 7 unidades.
 *
 * Na VPS: adicionar ao crontab
 *   0 5 * * * cd /var/www/gestao-buddha-spa && node scripts/motor-inteligencia-diario.mjs >> logs/motor-inteligencia.log 2>&1
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'

async function main() {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  console.log(`\n[${agora}] ▶ Motor de Inteligência iniciando...`)

  try {
    const resp = await fetch(`${BASE_URL}/api/inteligencia/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // vazio = todas as unidades
    })

    const data = await resp.json()

    if (!data.ok) {
      console.error('❌ Erro no sync:', data.erro)
      process.exit(1)
    }

    console.log('✅ Resultados por unidade:')
    for (const [slug, resultado] of Object.entries(data.resultados || {})) {
      if (typeof resultado === 'number') {
        console.log(`   ${slug}: ${resultado} clientes processados`)
      } else {
        console.log(`   ${slug}: ⚠️ ${resultado}`)
      }
    }

    console.log(`[${agora}] ✅ Motor concluído\n`)
  } catch (err) {
    console.error('❌ Falha crítica:', err)
    process.exit(1)
  }
}

main()
