// Cria as tabelas Venda + VendaItem (F2 — pós-venda/conversão). Idempotente.
// Uso: node scripts/criar-tabelas-venda.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "Venda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recomendacaoId" INTEGER NOT NULL UNIQUE,
    "belleId" TEXT NOT NULL,
    "unidadeSlug" TEXT NOT NULL,
    "confirmadoPorId" TEXT,
    "confirmadoPorNome" TEXT,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Venda_recomendacaoId_key" ON "Venda"("recomendacaoId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Venda_unidadeSlug_idx" ON "Venda"("unidadeSlug")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "VendaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vendaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "descricao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "VendaItem_vendaId_idx" ON "VendaItem"("vendaId")`)

for (const t of ['Venda', 'VendaItem']) {
  const c = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(c.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ${t}.`)
}
process.exit(0)
