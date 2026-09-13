// Cria as tabelas da Avaliação de Terapeutas (pesos por unidade, faixas globais,
// avaliação por terapeuta/semestre) e semeia os defaults. Idempotente.
//
// Uso local:  node scripts/criar-tabelas-terapeutas.mjs
// Uso VPS:    DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabelas-terapeutas.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

// ─── Tabelas ────────────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "TerapeutaAvaliacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "terapeutaChave" TEXT NOT NULL,
    "terapeutaNome" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "recomendacaoCliente" REAL,
    "horasTreinamento" REAL,
    "avaliacaoColegas" REAL,
    "avaliacaoGestor" REAL,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "TerapeutaAvaliacao_unidadeSlug_terapeutaChave_periodo_key" ON "TerapeutaAvaliacao"("unidadeSlug","terapeutaChave","periodo")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "TerapeutaPesos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL UNIQUE,
    "pesoProdutividade" REAL NOT NULL DEFAULT 25,
    "pesoFidelizacao" REAL NOT NULL DEFAULT 35,
    "pesoNps" REAL NOT NULL DEFAULT 20,
    "pesoRecomendacao" REAL NOT NULL DEFAULT 10,
    "pesoTreinamento" REAL NOT NULL DEFAULT 0,
    "pesoColegas" REAL NOT NULL DEFAULT 10,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "TerapeutaCategoriaFaixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chave" TEXT NOT NULL UNIQUE DEFAULT 'global',
    "minDiamante" REAL NOT NULL DEFAULT 9.5,
    "minOuro" REAL NOT NULL DEFAULT 8.5,
    "minPrata" REAL NOT NULL DEFAULT 7.5,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)

for (const t of ['TerapeutaAvaliacao', 'TerapeutaPesos', 'TerapeutaCategoriaFaixa']) {
  const check = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(check.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}

// ─── Seeds ──────────────────────────────────────────────────────────────────────
// Pesos default (do último semestre) por unidade — não sobrescreve se já existir.
const UNIDADES = [
  'shopping-metropole', 'analia-franco', 'shopping-analia-franco',
  'perdizes', 'tatuape-gomescardim', 'mooca-plaza', 'higienopolis',
]
let seedPesos = 0
for (const slug of UNIDADES) {
  const r = await db.execute({
    sql: `INSERT INTO "TerapeutaPesos" ("unidadeSlug") VALUES (?)
          ON CONFLICT("unidadeSlug") DO NOTHING`,
    args: [slug],
  })
  seedPesos += r.rowsAffected
}
console.log(`✔ Pesos default garantidos (${seedPesos} unidades novas; ${UNIDADES.length - seedPesos} já tinham).`)

// Faixa global default — não sobrescreve.
const rf = await db.execute({
  sql: `INSERT INTO "TerapeutaCategoriaFaixa" ("chave") VALUES ('global')
        ON CONFLICT("chave") DO NOTHING`,
  args: [],
})
console.log(rf.rowsAffected ? '✔ Faixas de categoria (global) criadas.' : '• Faixas de categoria já existiam.')

process.exit(0)
