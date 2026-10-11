// Cria a tabela TerapeutaVinculoRH (vínculo manual: nome do Belle → nome do R&S,
// quando o casamento automático de categoria não acha). SEM modelo no schema.prisma
// (acesso via SQL raw), pra não misturar com WIP do schema de outro terminal.
// Idempotente. Uso: node scripts/criar-tabela-terapeuta-vinculo.mjs
import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "TerapeutaVinculoRH" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "belleNomeNorm" TEXT NOT NULL,
    "rhNome" TEXT NOT NULL,
    "criadoPorNome" TEXT,
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "TerapeutaVinculoRH_belleNomeNorm_key" ON "TerapeutaVinculoRH"("belleNomeNorm")`)

console.log('OK — tabela TerapeutaVinculoRH pronta.')
