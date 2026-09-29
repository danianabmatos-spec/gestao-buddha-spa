// Cria as tabelas do módulo NF Salão Parceiro (F0). Idempotente (SQL aditivo).
// Uso: node scripts/criar-tabelas-nf-salao.mjs
//   NfSalaoMes · NfSalaoTerapeuta · RpsSequencia
// DDL espelhado do banco local (validado 1:1 com ago/26). NÃO usar `prisma db push`
// aqui: ele tentaria dropar Perfil/PerfilPermissao (que existem só no banco, não no schema).

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "NfSalaoMes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "aliquotaIss" REAL NOT NULL DEFAULT 0,
    "aliquotaTributos" REAL NOT NULL DEFAULT 0,
    "faturamentoCaixa" REAL NOT NULL DEFAULT 0,
    "reembolsoVoucher" REAL NOT NULL DEFAULT 0,
    "reembolsoGympass" REAL NOT NULL DEFAULT 0,
    "reembolsoTotalpass" REAL NOT NULL DEFAULT 0,
    "notasAvulsas" REAL NOT NULL DEFAULT 0,
    "valorBase" REAL NOT NULL DEFAULT 0,
    "faturamentoFonte" TEXT,
    "reembolsoFonte" TEXT,
    "fechadoEm" DATETIME,
    "fechadoPorNome" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "NfSalaoMes_unidadeId_ano_mes_key" ON "NfSalaoMes"("unidadeId","ano","mes")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "NfSalaoMes_unidadeId_idx" ON "NfSalaoMes"("unidadeId")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "NfSalaoTerapeuta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nfSalaoMesId" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "terapeutaNome" TEXT NOT NULL,
    "cnpjMei" TEXT NOT NULL DEFAULT '',
    "folhaTerapeutaId" TEXT,
    "comissao" REAL NOT NULL DEFAULT 0,
    "diasCredito" REAL NOT NULL DEFAULT 0,
    "valorTerapeuta" REAL NOT NULL DEFAULT 0,
    "nfComissaoNumero" TEXT,
    "nfCreditoNumero" TEXT,
    "pct" REAL NOT NULL DEFAULT 0,
    "valorNota" REAL NOT NULL DEFAULT 0,
    "baseCalculo" REAL NOT NULL DEFAULT 0,
    "rps" INTEGER,
    "nfSalaoNumero" TEXT,
    "codVerificacao" TEXT,
    "emitidaEm" DATETIME,
    "discriminacao" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "NfSalaoTerapeuta_nfSalaoMesId_idx" ON "NfSalaoTerapeuta"("nfSalaoMesId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "NfSalaoTerapeuta_unidadeId_idx" ON "NfSalaoTerapeuta"("unidadeId")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "RpsSequencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "proximoRps" INTEGER NOT NULL DEFAULT 1,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "RpsSequencia_unidadeId_key" ON "RpsSequencia"("unidadeId")`)

// Semeia o sequenciador de RPS da Anália (unidadeId 2) SÓ se ainda não existir.
// INSERT OR IGNORE => nunca sobrescreve progresso real de emissões já feitas.
const RPS_ANALIA = Number(process.env.NF_SALAO_RPS_ANALIA || 0)
if (RPS_ANALIA > 0) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO "RpsSequencia" ("unidadeId","proximoRps") VALUES (2, ?)`,
    args: [RPS_ANALIA],
  })
}

for (const t of ['NfSalaoMes', 'NfSalaoTerapeuta', 'RpsSequencia']) {
  const c = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(c.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ${t}.`)
}
const seq = await db.execute(`SELECT unidadeId, proximoRps FROM "RpsSequencia" ORDER BY unidadeId`)
console.log('RpsSequencia:', JSON.stringify(seq.rows))
process.exit(0)
