// Cria a tabela ParceriaConciliacao (validação do reembolso de parcerias:
// valor recebido de fato + justificativa da diferença, por unidade/mês/parceria).
// Idempotente. Uso: node scripts/criar-tabela-parceria-conciliacao.mjs
import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ParceriaConciliacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "parceria" TEXT NOT NULL,
    "recebido" REAL NOT NULL DEFAULT 0,
    "justificativa" TEXT NOT NULL DEFAULT '',
    "conciliado" BOOLEAN NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ParceriaConciliacao_ano_mes_unidadeId_parceria_key" ON "ParceriaConciliacao"("ano","mes","unidadeId","parceria")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ParceriaConciliacao_ano_mes_idx" ON "ParceriaConciliacao"("ano","mes")`)

console.log('OK — tabela ParceriaConciliacao pronta.')
