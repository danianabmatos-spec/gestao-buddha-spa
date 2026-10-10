// Cria a tabela NpsPendentesCache (cache do nº de NPS pendentes por unidade/mês,
// p/ o badge do menu lateral). Idempotente. Uso: node scripts/criar-tabela-nps-pendentes.mjs
import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "NpsPendentesCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "mesRef" TEXT NOT NULL,
    "pendentes" INTEGER NOT NULL DEFAULT 0,
    "totalMes" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "NpsPendentesCache_unidadeId_mesRef_key" ON "NpsPendentesCache"("unidadeId","mesRef")`)

console.log('OK — tabela NpsPendentesCache pronta.')
