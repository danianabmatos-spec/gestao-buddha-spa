// Estende FaturamentoHistorico com as colunas de parcerias (gympass, totalpass).
// Idempotente (aditivo): cria a tabela se faltar e adiciona as colunas só se não
// existirem. NÃO usar `prisma db push` (tentaria reconciliar tabelas cruas).
// Uso: node scripts/criar-tabelas-parcerias-historico.mjs
import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

// Garante a tabela (no-op se já existe — criada pelo Prisma em produção)
await db.execute(`
  CREATE TABLE IF NOT EXISTS "FaturamentoHistorico" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeSlug" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "caixa" REAL NOT NULL DEFAULT 0,
    "horas" REAL NOT NULL DEFAULT 0,
    "gympass" REAL NOT NULL DEFAULT 0,
    "totalpass" REAL NOT NULL DEFAULT 0,
    "voucherOnline" REAL NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "FaturamentoHistorico_unidadeSlug_ano_mes_key" ON "FaturamentoHistorico"("unidadeSlug","ano","mes")`)

// Adiciona colunas em bancos que já tinham a tabela sem elas
const info = await db.execute(`PRAGMA table_info("FaturamentoHistorico")`)
const cols = new Set(info.rows.map(r => r.name))
for (const col of ['gympass', 'totalpass', 'voucherOnline']) {
  if (!cols.has(col)) {
    await db.execute(`ALTER TABLE "FaturamentoHistorico" ADD COLUMN "${col}" REAL NOT NULL DEFAULT 0`)
    console.log(`✔ coluna ${col} adicionada`)
  } else {
    console.log(`• coluna ${col} já existe`)
  }
}

const check = await db.execute(`PRAGMA table_info("FaturamentoHistorico")`)
console.log('colunas:', check.rows.map(r => r.name).join(', '))
process.exit(0)
