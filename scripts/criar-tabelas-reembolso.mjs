// Cria as tabelas do módulo de Reembolso de Vouchers e semeia PermutaConfig + PexPremiacao.
// Idempotente: CREATE TABLE IF NOT EXISTS + upsert por chave. NÃO toca em nada existente.
//
// Uso local:  node scripts/criar-tabelas-reembolso.mjs
// Uso VPS:    DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabelas-reembolso.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })
const now = () => new Date().toISOString()

// ─── 1. Tabelas ─────────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "ReembolsoMes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ReembolsoMes_ano_mes_key" ON "ReembolsoMes"("ano","mes")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ReembolsoUnidade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reembolsoMesId" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "vouchers" REAL NOT NULL DEFAULT 0,
    "omnichannel" REAL NOT NULL DEFAULT 0,
    "cortesiaUsada" REAL NOT NULL DEFAULT 0,
    "cortesiaReembolso" REAL NOT NULL DEFAULT 0,
    "creditoInicial" REAL NOT NULL DEFAULT 0,
    "saldoAcumulado" REAL NOT NULL DEFAULT 0,
    "compras" REAL NOT NULL DEFAULT 0,
    "treinamento" REAL NOT NULL DEFAULT 0,
    "faturamentoCaixa" REAL NOT NULL DEFAULT 0,
    "royaltiesMkt" REAL NOT NULL DEFAULT 0,
    "pex" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" DATETIME,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ReembolsoUnidade_reembolsoMesId_unidadeId_key" ON "ReembolsoUnidade"("reembolsoMesId","unidadeId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ReembolsoUnidade_unidadeId_idx" ON "ReembolsoUnidade"("unidadeId")`)
// Aditivo/idempotente: colunas de conciliação bancária.
{
  const cols = (await db.execute('PRAGMA table_info(ReembolsoUnidade)')).rows.map((r) => r.name)
  if (!cols.includes('valorRecebido')) { await db.execute(`ALTER TABLE "ReembolsoUnidade" ADD COLUMN "valorRecebido" REAL NOT NULL DEFAULT 0`); console.log('✔ Coluna ReembolsoUnidade.valorRecebido criada.') }
  if (!cols.includes('conciliado')) { await db.execute(`ALTER TABLE "ReembolsoUnidade" ADD COLUMN "conciliado" INTEGER NOT NULL DEFAULT 0`); console.log('✔ Coluna ReembolsoUnidade.conciliado criada.') }
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ReembolsoCortesia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reembolsoUnidadeId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" REAL NOT NULL DEFAULT 0,
    "dataUtilizacao" TEXT
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ReembolsoCortesia_reembolsoUnidadeId_idx" ON "ReembolsoCortesia"("reembolsoUnidadeId")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ReembolsoCompra" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reembolsoUnidadeId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL DEFAULT 0,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ReembolsoCompra_reembolsoUnidadeId_idx" ON "ReembolsoCompra"("reembolsoUnidadeId")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "ReembolsoTreinamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reembolsoUnidadeId" INTEGER NOT NULL,
    "terapeuta" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "ReembolsoTreinamento_reembolsoUnidadeId_idx" ON "ReembolsoTreinamento"("reembolsoUnidadeId")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "PermutaConfig" (
    "unidadeId" INTEGER NOT NULL PRIMARY KEY,
    "valorMensalPermutavel" REAL NOT NULL DEFAULT 0,
    "limiteAcumulo" REAL NOT NULL DEFAULT 0,
    "saldoInicial" REAL NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
// Aditivo/idempotente: garante a coluna saldoInicial em bancos criados antes desta versão.
{
  const cols = (await db.execute('PRAGMA table_info(PermutaConfig)')).rows.map((r) => r.name)
  if (!cols.includes('saldoInicial')) {
    await db.execute(`ALTER TABLE "PermutaConfig" ADD COLUMN "saldoInicial" REAL NOT NULL DEFAULT 0`)
    console.log('✔ Coluna PermutaConfig.saldoInicial criada.')
  }
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS "PexPremiacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "mesInicio" INTEGER NOT NULL,
    "mesFim" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "PexPremiacao_unidadeId_ano_mesInicio_mesFim_key" ON "PexPremiacao"("unidadeId","ano","mesInicio","mesFim")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "PexPremiacao_unidadeId_ano_idx" ON "PexPremiacao"("unidadeId","ano")`)

for (const t of ['ReembolsoMes', 'ReembolsoUnidade', 'ReembolsoCortesia', 'ReembolsoCompra', 'ReembolsoTreinamento', 'PermutaConfig', 'PexPremiacao']) {
  const c = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(c.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}

// ─── 2. Seed PermutaConfig (das abas Cortesias da planilha) ──────────────────────
// unidadeId → { mensal permutável, teto de acúmulo }
const PERMUTA = [
  { unidadeId: 1, mensal: 650,  limite: 3900 }, // Shopping Metrópole
  { unidadeId: 2, mensal: 500,  limite: 3000 }, // Anália Franco
  { unidadeId: 3, mensal: 650,  limite: 3900 }, // Shopping Anália Franco (SAF)
  { unidadeId: 4, mensal: 500,  limite: 3000 }, // Perdizes
  { unidadeId: 5, mensal: 650,  limite: 3900 }, // Tatuapé Gomes Cardim
  { unidadeId: 6, mensal: 650,  limite: 3900 }, // Mooca Plaza
  { unidadeId: 7, mensal: 1300, limite: 3900 }, // Higienópolis
]
for (const p of PERMUTA) {
  await db.execute({
    sql: `INSERT INTO "PermutaConfig" ("unidadeId","valorMensalPermutavel","limiteAcumulo","atualizadoEm")
          VALUES (?,?,?,?)
          ON CONFLICT("unidadeId") DO UPDATE SET
            valorMensalPermutavel=excluded.valorMensalPermutavel,
            limiteAcumulo=excluded.limiteAcumulo,
            atualizadoEm=excluded.atualizadoEm`,
    args: [p.unidadeId, p.mensal, p.limite, now()],
  })
}
console.log(`✔ PermutaConfig semeada: ${PERMUTA.length} unidades.`)

// ─── 3. Seed PexPremiacao — ganhadoras jul–dez/2026: SAF (3) e Perdizes (4) ───────
const PEX = [
  { unidadeId: 3, ano: 2026, mesInicio: 7, mesFim: 12 }, // Shopping Anália Franco
  { unidadeId: 4, ano: 2026, mesInicio: 7, mesFim: 12 }, // Perdizes
]
for (const x of PEX) {
  await db.execute({
    sql: `INSERT INTO "PexPremiacao" ("unidadeId","ano","mesInicio","mesFim","criadoEm")
          VALUES (?,?,?,?,?)
          ON CONFLICT("unidadeId","ano","mesInicio","mesFim") DO NOTHING`,
    args: [x.unidadeId, x.ano, x.mesInicio, x.mesFim, now()],
  })
}
console.log(`✔ PexPremiacao semeada: ${PEX.length} unidades (SAF + Perdizes, jul–dez/2026).`)

process.exit(0)
