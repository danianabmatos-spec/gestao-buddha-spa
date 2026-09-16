// Cria as tabelas do sistema de permissões (Perfil + PerfilPermissao). Idempotente.
// O seed dos perfis de sistema e da matriz-padrão é feito pela app (store.ts,
// garantirSeed) na 1ª leitura — pra reaproveitar o catálogo TS sem duplicar.
//
// Uso VPS: DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabelas-permissoes.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

await db.execute(`
  CREATE TABLE IF NOT EXISTS "Perfil" (
    "chave" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "sistema" INTEGER NOT NULL DEFAULT 0,
    "superadmin" INTEGER NOT NULL DEFAULT 0,
    "ativo" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "PerfilPermissao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "perfilChave" TEXT NOT NULL,
    "funcionalidadeChave" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'NENHUM',
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "PerfilPermissao_perfil_func_key" ON "PerfilPermissao"("perfilChave","funcionalidadeChave")`)

for (const t of ['Perfil', 'PerfilPermissao']) {
  const c = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(c.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}
process.exit(0)
