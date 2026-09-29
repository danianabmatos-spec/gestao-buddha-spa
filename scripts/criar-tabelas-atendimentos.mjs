// Cria a tabela da Conciliação de Atendimentos (Parte 2 — F1). Idempotente.
// Uso: node scripts/criar-tabelas-atendimentos.mjs
//   AtendimentoConc (1 linha por atendimento; chave unidadeId+belleAtendId)
// NÃO usar `prisma db push` neste repo (drift no dev.db) — tabela criada por SQL aditivo.

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "AtendimentoConc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "belleAtendId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "horario" TEXT,
    "clienteNome" TEXT NOT NULL,
    "clienteId" TEXT,
    "servico" TEXT,
    "tempo" INTEGER,
    "profissional" TEXT,
    "planoId" TEXT,
    "tipo" TEXT,
    "statusAtend" TEXT NOT NULL,
    "valorBruto" REAL NOT NULL DEFAULT 0,
    "covPlano" REAL NOT NULL DEFAULT 0,
    "covVoucher" REAL NOT NULL DEFAULT 0,
    "covParceria" REAL NOT NULL DEFAULT 0,
    "covCortesia" REAL NOT NULL DEFAULT 0,
    "covDesconto" REAL NOT NULL DEFAULT 0,
    "covFinanceiro" REAL NOT NULL DEFAULT 0,
    "covAberto" REAL NOT NULL DEFAULT 0,
    "classificacao" TEXT NOT NULL DEFAULT 'A_VERIFICAR_FINANCEIRO',
    "justificado" BOOLEAN NOT NULL DEFAULT 0,
    "aniversarioMes" BOOLEAN NOT NULL DEFAULT 0,
    "origemDesconto" TEXT,
    "divergenciaId" INTEGER,
    "importadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "AtendimentoConc_unidadeId_belleAtendId_key" ON "AtendimentoConc"("unidadeId","belleAtendId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "AtendimentoConc_unidadeId_data_idx" ON "AtendimentoConc"("unidadeId","data")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "AtendimentoConc_unidadeId_data_classificacao_idx" ON "AtendimentoConc"("unidadeId","data","classificacao")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "AtendimentoConc_unidadeId_classificacao_idx" ON "AtendimentoConc"("unidadeId","classificacao")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "AtendimentoConc_unidadeId_clienteId_data_idx" ON "AtendimentoConc"("unidadeId","clienteId","data")`)

const c = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: ['AtendimentoConc'] })
console.log(c.rows.length ? '✔ Tabela AtendimentoConc pronta.' : '✖ Falhou AtendimentoConc.')
process.exit(0)
