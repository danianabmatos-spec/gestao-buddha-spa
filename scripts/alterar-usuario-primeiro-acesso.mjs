// Aditivo: adiciona a coluna Usuario.primeirAcesso (trava de troca de senha no 1º acesso).
// Idempotente. Uso: node scripts/alterar-usuario-primeiro-acesso.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

const cols = (await db.execute('PRAGMA table_info(Usuario)')).rows.map((r) => r.name)
if (!cols.includes('primeirAcesso')) {
  await db.execute(`ALTER TABLE "Usuario" ADD COLUMN "primeirAcesso" INTEGER NOT NULL DEFAULT 0`)
  console.log('✔ Coluna Usuario.primeirAcesso criada.')
} else {
  console.log('• Usuario.primeirAcesso já existe.')
}
process.exit(0)
