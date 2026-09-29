// Cria as tabelas do Controle da Bola (rodízio de terapeutas). Idempotente.
// Uso: node scripts/criar-tabelas-bola.mjs
//   BolaCheckin · BolaAtendimento

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "BolaCheckin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "terapeutaId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "chegadaEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "BolaCheckin_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "BolaCheckin_unidadeSlug_terapeutaId_data_key" ON "BolaCheckin"("unidadeSlug","terapeutaId","data")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "BolaCheckin_unidadeSlug_data_status_idx" ON "BolaCheckin"("unidadeSlug","data","status")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "BolaAtendimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "terapeutaId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "clienteNome" TEXT,
    "servicoNome" TEXT,
    "servicoCod" INTEGER,
    "duracaoMin" INTEGER NOT NULL,
    "salaNome" TEXT,
    "preferencial" BOOLEAN NOT NULL DEFAULT 0,
    "belleAgendaId" TEXT,
    "inicioEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "fimPrevistoEm" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "BolaAtendimento_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "BolaAtendimento_unidadeSlug_data_idx" ON "BolaAtendimento"("unidadeSlug","data")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "BolaAtendimento_terapeutaId_data_idx" ON "BolaAtendimento"("terapeutaId","data")`)

console.log('Tabelas da bola OK (BolaCheckin, BolaAtendimento).')
