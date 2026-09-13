// Cria SOMENTE a tabela TemplateMensagem (não toca em nada existente).
// Idempotente (CREATE TABLE IF NOT EXISTS). Alternativa segura ao `prisma db push`
// quando há drift em outras tabelas.
//
// Uso local:   node scripts/criar-tabela-templates.mjs
// Uso VPS:     DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabela-templates.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "TemplateMensagem" (
    "cluster" TEXT NOT NULL PRIMARY KEY,
    "texto" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
  )
`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "LeadFlowOutbox" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "nomeCliente" TEXT NOT NULL,
    "telefone" TEXT,
    "texto" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "enviadoEm" DATETIME
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "LeadFlowOutbox_status_idx" ON "LeadFlowOutbox"("status")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ClienteTotalPass" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "clienteId" INTEGER,
    "nomeCliente" TEXT NOT NULL,
    "telefone" TEXT,
    "usosAno" INTEGER NOT NULL DEFAULT 0,
    "ultimoUso" DATETIME,
    "mesRef" TEXT NOT NULL,
    "sessoesMes" INTEGER NOT NULL DEFAULT 0,
    "planoCancelado" INTEGER NOT NULL DEFAULT 0,
    "ultimoContato" DATETIME,
    "motivoContato" TEXT,
    "atualizadoEm" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ClienteTotalPass_unidadeSlug_nomeCliente_key" ON "ClienteTotalPass"("unidadeSlug","nomeCliente")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ClienteTotalPass_unidadeSlug_idx" ON "ClienteTotalPass"("unidadeSlug")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ContatoBloqueado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nomeCliente" TEXT,
    "motivo" TEXT NOT NULL,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ContatoBloqueado_unidadeSlug_telefone_key" ON "ContatoBloqueado"("unidadeSlug","telefone")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ContatoBloqueado_telefone_idx" ON "ContatoBloqueado"("telefone")`)

for (const t of ['TemplateMensagem', 'LeadFlowOutbox', 'ContatoBloqueado']) {
  const check = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(check.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}

// Coluna temPacoteAtivo em ClienteScore (trava anti-mensagem-errada) — aditivo/idempotente
const cols = (await db.execute('PRAGMA table_info(ClienteScore)')).rows.map((r) => r.name)
for (const col of ['temPacoteAtivo', 'temPacoteSuspenso']) {
  if (!cols.includes(col)) {
    await db.execute(`ALTER TABLE ClienteScore ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`)
    console.log(`✔ Coluna ClienteScore.${col} criada.`)
  } else {
    console.log(`• Coluna ClienteScore.${col} já existe.`)
  }
}
process.exit(0)
