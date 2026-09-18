// Cria/atualiza a tabela FechamentoValidacao (estado da validação do mês por unidade).
// Idempotente + aditivo. Uso: node scripts/criar-tabela-fechamento-validacao.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "FechamentoValidacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "liberado" INTEGER NOT NULL DEFAULT 0,
    "liberadoEm" DATETIME,
    "liberadoPorNome" TEXT,
    "forcado" INTEGER NOT NULL DEFAULT 0,
    "forcadoInfo" TEXT,
    "enviadoFolhaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "FechamentoValidacao_unidadeSlug_ref_key" ON "FechamentoValidacao"("unidadeSlug","ref")`)

// Aditivo: garante as colunas em bancos criados antes desta versão.
{
  const cols = (await db.execute('PRAGMA table_info(FechamentoValidacao)')).rows.map((r) => r.name)
  if (!cols.includes('forcado')) { await db.execute(`ALTER TABLE "FechamentoValidacao" ADD COLUMN "forcado" INTEGER NOT NULL DEFAULT 0`); console.log('✔ Coluna forcado criada.') }
  if (!cols.includes('forcadoInfo')) { await db.execute(`ALTER TABLE "FechamentoValidacao" ADD COLUMN "forcadoInfo" TEXT`); console.log('✔ Coluna forcadoInfo criada.') }
}

const chk = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='FechamentoValidacao'`)
console.log(chk.rows.length ? '✔ Tabela FechamentoValidacao pronta.' : '✖ Falhou.')
process.exit(0)
