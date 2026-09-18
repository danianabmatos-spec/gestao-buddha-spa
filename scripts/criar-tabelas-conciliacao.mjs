// Cria as tabelas da Conciliação Financeira (F0–F3). Idempotente.
// Uso: node scripts/criar-tabelas-conciliacao.mjs
//   MovimentacaoBelle · FonteExterna · Divergencia · ConciliacaoDia

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "MovimentacaoBelle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "belleMovId" TEXT NOT NULL,
    "vendaRef" TEXT,
    "data" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteId" TEXT,
    "cpf" TEXT,
    "responsavel" TEXT,
    "servico" TEXT,
    "tipoVenda" TEXT,
    "formaPagamento" TEXT,
    "tipoMovimento" TEXT,
    "confirmado" BOOLEAN NOT NULL DEFAULT 1,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "valorBruto" REAL NOT NULL DEFAULT 0,
    "taxas" REAL NOT NULL DEFAULT 0,
    "valorDesconto" REAL NOT NULL DEFAULT 0,
    "valorLiquido" REAL NOT NULL DEFAULT 0,
    "statusConcil" TEXT NOT NULL DEFAULT 'PENDENTE',
    "importadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "MovimentacaoBelle_unidadeId_belleMovId_key" ON "MovimentacaoBelle"("unidadeId","belleMovId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "MovimentacaoBelle_unidadeId_data_idx" ON "MovimentacaoBelle"("unidadeId","data")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "MovimentacaoBelle_unidadeId_data_formaPagamento_idx" ON "MovimentacaoBelle"("unidadeId","data","formaPagamento")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "MovimentacaoBelle_unidadeId_statusConcil_idx" ON "MovimentacaoBelle"("unidadeId","statusConcil")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "FonteExterna" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "origem" TEXT NOT NULL,
    "refExterna" TEXT,
    "data" TEXT NOT NULL,
    "dataHora" DATETIME,
    "valor" REAL NOT NULL DEFAULT 0,
    "formaPagamento" TEXT,
    "descricao" TEXT,
    "raw" TEXT,
    "statusMatch" TEXT NOT NULL DEFAULT 'PENDENTE',
    "movimentacaoId" INTEGER,
    "importadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "FonteExterna_unidadeId_origem_refExterna_key" ON "FonteExterna"("unidadeId","origem","refExterna")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "FonteExterna_unidadeId_data_idx" ON "FonteExterna"("unidadeId","data")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "FonteExterna_unidadeId_origem_statusMatch_idx" ON "FonteExterna"("unidadeId","origem","statusMatch")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "Divergencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "formaPagamento" TEXT,
    "valorEsperado" REAL NOT NULL DEFAULT 0,
    "valorEncontrado" REAL NOT NULL DEFAULT 0,
    "diferenca" REAL NOT NULL DEFAULT 0,
    "descricao" TEXT,
    "sugestaoAjuste" TEXT,
    "movimentacaoId" INTEGER,
    "fonteExternaId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "tratadaPorId" TEXT,
    "tratadaPorNome" TEXT,
    "justificativa" TEXT,
    "tratadaEm" DATETIME,
    "reprocessadaEm" DATETIME,
    "criadaEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadaEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "Divergencia_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "MovimentacaoBelle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Divergencia_unidadeId_data_status_idx" ON "Divergencia"("unidadeId","data","status")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "Divergencia_unidadeId_tipo_idx" ON "Divergencia"("unidadeId","tipo")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ConciliacaoDia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "totalBelle" REAL NOT NULL DEFAULT 0,
    "totalConciliado" REAL NOT NULL DEFAULT 0,
    "qtdMovimentacoes" INTEGER NOT NULL DEFAULT 0,
    "qtdDivergencias" INTEGER NOT NULL DEFAULT 0,
    "qtdAbertas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "ultimoProcessamento" DATETIME,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ConciliacaoDia_unidadeId_data_key" ON "ConciliacaoDia"("unidadeId","data")`)

for (const t of ['MovimentacaoBelle', 'FonteExterna', 'Divergencia', 'ConciliacaoDia']) {
  const c = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(c.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ${t}.`)
}
process.exit(0)
