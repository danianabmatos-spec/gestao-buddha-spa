// Limpa os caches que guardam "Recebido em Caixa" calculado pela fonte ANTIGA
// (Report 184/Consolidado). Após trocar a fonte para o Report 103 (Movimentação
// Detalhado por confirmação), esses caches precisam ser recalculados — cada um
// se reconstrói sozinho na próxima leitura / no refresh das 7h.
// Uso: node scripts/limpar-caches-caixa.mjs
import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

for (const tabela of ['CaixaDiarioCache', 'RadarCache', 'DashboardCache', 'RealizadoMensalCache']) {
  try {
    const r = await db.execute(`DELETE FROM "${tabela}"`)
    console.log(`  ${tabela}: ${r.rowsAffected} linha(s) removida(s)`)
  } catch (e) {
    console.log(`  ${tabela}: erro — ${e?.message || e}`)
  }
}
console.log('OK — caches de caixa limpos.')
