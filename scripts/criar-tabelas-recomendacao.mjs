// Cria as tabelas do Programa de Recomendação das Terapeutas (F1).
// Idempotente: CREATE TABLE IF NOT EXISTS. NÃO toca em nada existente.
//
// Uso local:  node scripts/criar-tabelas-recomendacao.mjs
// Uso VPS:    DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabelas-recomendacao.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

// ─── Recomendacao ────────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "Recomendacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "belleId" TEXT NOT NULL UNIQUE,
    "unidadeSlug" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "terapeutaNome" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteTelefone" TEXT,
    "dataAtendimento" TEXT NOT NULL,
    "servico" TEXT,
    "notaSono" INTEGER,
    "notaEnergia" INTEGER,
    "notaEstresse" INTEGER,
    "pontosTensao" TEXT,
    "retorno" TEXT,
    "fotoPath" TEXT,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE_VENDA',
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Recomendacao_unidadeSlug_status_idx" ON "Recomendacao"("unidadeSlug","status")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Recomendacao_usuarioId_idx" ON "Recomendacao"("usuarioId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Recomendacao_unidadeSlug_dataAtendimento_idx" ON "Recomendacao"("unidadeSlug","dataAtendimento")`)

// ─── RecomendacaoItem ──────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "RecomendacaoItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recomendacaoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "RecomendacaoItem_recomendacaoId_idx" ON "RecomendacaoItem"("recomendacaoId")`)

for (const t of ['Recomendacao', 'RecomendacaoItem']) {
  const check = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(check.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}

process.exit(0)
