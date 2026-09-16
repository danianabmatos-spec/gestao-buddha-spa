// Seed de usuários e unidades para o multi-tenant da Inteligência.
// Cria (de forma idempotente): as 7 unidades, 1 conta DONA e 1 conta RECEPÇÃO por unidade.
// Senhas temporárias são geradas aleatoriamente e impressas UMA vez — anote e troque depois.
//
// Uso:  node scripts/seed-usuarios.mjs
//       node scripts/seed-usuarios.mjs --reset-senhas   (regera senha de quem já existe)

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import path from 'node:path'

const RESET = process.argv.includes('--reset-senhas')
const DB_URL = 'file:' + path.join(process.cwd(), 'dev.db')
const db = createClient({ url: DB_URL })

const UNIDADES = [
  ['shopping-metropole', 'Shopping Metrópole'],
  ['analia-franco', 'Anália Franco'],
  ['shopping-analia-franco', 'Shopping Anália Franco'],
  ['perdizes', 'Perdizes'],
  ['tatuape-gomescardim', 'Tatuapé Gomes Cardim'],
  ['mooca-plaza', 'Mooca Plaza'],
  ['higienopolis', 'Higienópolis'],
]

const DONA_EMAIL = 'buddhaspasolar@gmail.com'
const DONA_NOME = 'Daniana Matos'

// E-mails REAIS de login de cada recepção (não seguem o slug — ex.: Mooca).
const RECEP_EMAIL = {
  'shopping-metropole': 'recepcao.shoppingmetropole@buddhaspa.com.br',
  'analia-franco': 'recepcao.analiafranco@buddhaspa.com.br',
  'shopping-analia-franco': 'recepcao.shoppinganaliafranco@buddhaspa.com.br',
  'perdizes': 'recepcao.perdizes@buddhaspa.com.br',
  'tatuape-gomescardim': 'recepcao.tatuapegomescardim@buddhaspa.com.br',
  'mooca-plaza': 'recepcao.shoppingmooca@buddhaspa.com.br',
  'higienopolis': 'recepcao.higienopolis@buddhaspa.com.br',
}

function senhaTemp() {
  // 10 chars legíveis (sem caracteres ambíguos)
  const alfa = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 10; i++) s += alfa[crypto.randomInt(alfa.length)]
  return s
}

async function unidadeId(slug, nome) {
  const found = await db.execute({ sql: 'SELECT id FROM Unidade WHERE slug = ?', args: [slug] })
  if (found.rows.length) return Number(found.rows[0].id)
  await db.execute({
    sql: `INSERT INTO Unidade (nome, slug, belleEmail, bellePassword, belleEstabId, ativa, createdAt)
          VALUES (?, ?, '', '', 1, 1, datetime('now'))`,
    args: [nome, slug],
  })
  const again = await db.execute({ sql: 'SELECT id FROM Unidade WHERE slug = ?', args: [slug] })
  return Number(again.rows[0].id)
}

async function upsertUsuario({ nome, email, perfil, unidadeId }) {
  const existing = await db.execute({ sql: 'SELECT id FROM Usuario WHERE email = ?', args: [email] })
  if (existing.rows.length && !RESET) {
    return { email, status: 'já existia (senha mantida)', senha: null }
  }
  const senha = senhaTemp()
  const hash = await bcrypt.hash(senha, 10)
  if (existing.rows.length) {
    await db.execute({ sql: 'UPDATE Usuario SET senha = ?, ativo = 1 WHERE email = ?', args: [hash, email] })
    return { email, status: 'senha regerada', senha }
  }
  await db.execute({
    sql: `INSERT INTO Usuario (id, nome, email, senha, perfil, unidadeId, ativo, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
    args: [crypto.randomUUID(), nome, email, hash, perfil, unidadeId],
  })
  return { email, status: 'criado', senha }
}

async function main() {
  const linhas = []

  // Unidades + recepções
  for (const [slug, nome] of UNIDADES) {
    const uid = await unidadeId(slug, nome)
    const r = await upsertUsuario({
      nome: `Recepção ${nome}`,
      email: RECEP_EMAIL[slug] ?? `recepcao.${slug}@buddhaspa.com.br`,
      perfil: 'RECEPCAO',
      unidadeId: uid,
    })
    linhas.push({ perfil: 'RECEPCAO', unidade: nome, ...r })
  }

  // Dona (vê todas as unidades → unidadeId null)
  const d = await upsertUsuario({ nome: DONA_NOME, email: DONA_EMAIL, perfil: 'DONA', unidadeId: null })
  linhas.push({ perfil: 'DONA', unidade: '(todas)', ...d })

  console.log('\n════════════════ USUÁRIOS ════════════════\n')
  for (const l of linhas) {
    const senha = l.senha ? `senha: ${l.senha}` : l.status
    console.log(`[${l.perfil}] ${l.unidade}`)
    console.log(`   e-mail: ${l.email}`)
    console.log(`   ${l.senha ? senha : '(' + l.status + ')'}\n`)
  }
  console.log('⚠️  Anote as senhas acima — elas não serão exibidas de novo.')
  console.log('    Para regerar as que já existiam: node scripts/seed-usuarios.mjs --reset-senhas\n')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
