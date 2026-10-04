// Cria as tabelas do Financeiro (migrado do app de Estoque) e semeia o plano de contas.
// Idempotente. Uso: node scripts/criar-tabelas-financeiro.mjs
//   PlanoConta (132 contas) + colunas de classificação na FonteExterna.

import { createClient } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

// ── PlanoConta (catálogo global) ──────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "PlanoConta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'A Pagar',
    "codObrigacao" TEXT NOT NULL DEFAULT '',
    "codProvisao" TEXT NOT NULL DEFAULT '',
    "tipoDespesa" TEXT NOT NULL DEFAULT '',
    "ativa" BOOLEAN NOT NULL DEFAULT 1
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "PlanoConta_nome_key" ON "PlanoConta"("nome")`)

// ── TituloPagar (contas a pagar) ──────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "TituloPagar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "planoContaId" INTEGER,
    "descricao" TEXT NOT NULL DEFAULT '',
    "fornecedorTexto" TEXT NOT NULL DEFAULT '',
    "valor" REAL NOT NULL DEFAULT 0,
    "parcela" INTEGER NOT NULL DEFAULT 1,
    "totalParcelas" INTEGER NOT NULL DEFAULT 1,
    "dataEmissao" TEXT NOT NULL,
    "dataCompetencia" TEXT,
    "dataVencimento" TEXT,
    "dataPagamento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREVISTO',
    "pagamentoAntecipado" BOOLEAN NOT NULL DEFAULT 0,
    "formaPagamento" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "refExterna" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "TituloPagar_unidadeId_status_idx" ON "TituloPagar"("unidadeId","status")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "TituloPagar_unidadeId_dataVencimento_idx" ON "TituloPagar"("unidadeId","dataVencimento")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "TituloPagar_unidadeId_dataCompetencia_idx" ON "TituloPagar"("unidadeId","dataCompetencia")`)

// ── Colunas de classificação na FonteExterna (ALTER aditivo — ignora se já existe) ──
for (const sql of [
  `ALTER TABLE "FonteExterna" ADD COLUMN "planoContaId" INTEGER`,
  `ALTER TABLE "FonteExterna" ADD COLUMN "classificadoEm" DATETIME`,
  `ALTER TABLE "FonteExterna" ADD COLUMN "classificadoPor" TEXT`,
]) {
  try { await db.execute(sql) } catch (e) { if (!/duplicate column/i.test(String(e))) throw e }
}

// ── Seed do plano de contas (upsert por nome) ─────────────────────────────────
const planoPath = path.join(process.cwd(), 'prisma', 'data', 'plano_de_contas.json')
if (fs.existsSync(planoPath)) {
  const contas = JSON.parse(fs.readFileSync(planoPath, 'utf-8'))
  let novas = 0
  for (const c of contas) {
    if (!c.nome) continue
    const r = await db.execute({
      sql: `INSERT INTO "PlanoConta" ("nome","tipo","codObrigacao","codProvisao","tipoDespesa","ativa")
            VALUES (?,?,?,?,?,1)
            ON CONFLICT("nome") DO UPDATE SET
              "tipo"=excluded."tipo", "codObrigacao"=excluded."codObrigacao",
              "codProvisao"=excluded."codProvisao", "tipoDespesa"=excluded."tipoDespesa"`,
      args: [c.nome, c.tipo || 'A Pagar', c.codObrigacao || '', c.codProvisao || '', c.tipoDespesa || ''],
    })
    novas += r.rowsAffected
  }
  console.log(`PlanoConta: ${contas.length} contas semeadas/atualizadas`)
} else {
  console.log('(aviso: prisma/data/plano_de_contas.json não encontrado — tabela criada vazia)')
}

const tot = await db.execute(`SELECT COUNT(*) n FROM "PlanoConta"`)
console.log('PlanoConta total no banco:', tot.rows[0].n)
