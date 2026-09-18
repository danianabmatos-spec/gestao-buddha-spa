// Cria as tabelas Terapeuta + Atendimento (F1 — réplica do sync da folha no gestao).
// Idempotente: CREATE TABLE IF NOT EXISTS. NÃO toca em nada existente.
//
// Uso local:  node scripts/criar-tabelas-atendimentos.mjs
// Uso VPS:    DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabelas-atendimentos.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

// ─── Terapeuta ─────────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "Terapeuta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "nomeBelle" TEXT,
    "unidadeSlug" TEXT NOT NULL,
    "usuarioId" TEXT,
    "colaboradorId" TEXT,
    "ativo" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Terapeuta_usuarioId_key" ON "Terapeuta"("usuarioId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Terapeuta_unidadeSlug_ativo_idx" ON "Terapeuta"("unidadeSlug","ativo")`)

// ─── Atendimento ───────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "Atendimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "belleId" TEXT NOT NULL UNIQUE,
    "unidadeSlug" TEXT NOT NULL,
    "terapeutaId" INTEGER,
    "terapeutaNome" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "servico" TEXT,
    "data" TEXT NOT NULL,
    "hora" TEXT,
    "valorComissao" REAL NOT NULL DEFAULT 0,
    "statusValidacao" TEXT NOT NULL DEFAULT 'PENDENTE',
    "observacaoContestacao" TEXT,
    "respostaCoord" TEXT,
    "fechamentoRef" TEXT,
    "enviadoFolhaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Atendimento_unidadeSlug_data_idx" ON "Atendimento"("unidadeSlug","data")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Atendimento_terapeutaId_statusValidacao_idx" ON "Atendimento"("terapeutaId","statusValidacao")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Atendimento_unidadeSlug_statusValidacao_fechamentoRef_idx" ON "Atendimento"("unidadeSlug","statusValidacao","fechamentoRef")`)

for (const t of ['Terapeuta', 'Atendimento']) {
  const check = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(check.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}

process.exit(0)
