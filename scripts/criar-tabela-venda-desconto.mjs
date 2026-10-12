// Cria a tabela VendaDescontoConc (lançamentos de VENDA — pacote/voucher/produto —
// com desconto ou cortesia, que NÃO são atendimento; vão pra coluna "Vendas c/ desconto"
// da conciliação, a justificar). SEM modelo no schema.prisma (acesso via SQL raw).
// Idempotente. Uso: node scripts/criar-tabela-venda-desconto.mjs
import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "VendaDescontoConc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "idVenda" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "cliente" TEXT,
    "item" TEXT,
    "origemDesconto" TEXT,
    "valorBruto" REAL NOT NULL DEFAULT 0,
    "valorDesconto" REAL NOT NULL DEFAULT 0,
    "cortesia" INTEGER NOT NULL DEFAULT 0,
    "justificativa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tratadaPorNome" TEXT,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "VendaDescontoConc_unidadeId_idVenda_key" ON "VendaDescontoConc"("unidadeId","idVenda")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "VendaDescontoConc_unidadeId_data_idx" ON "VendaDescontoConc"("unidadeId","data")`)

console.log('OK — tabela VendaDescontoConc pronta.')
