// Seed de DESENVOLVIMENTO: 1 terapeuta de teste (login) + atendimentos de exemplo,
// só pra visualizar/testar a tela "Meus Atendimentos". NÃO roda em produção.
//
// Uso local:  node scripts/seed-terapeuta-teste.mjs
// Login gerado: terapeuta.teste@buddhaspa.com.br / senha "terapeuta2026"

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
if (url.includes('/var/www')) {
  console.log('• Ambiente de produção — seed de teste NÃO executado.')
  process.exit(0)
}
const db = createClient({ url })
const now = () => new Date().toISOString()
const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 1. Unidade de referência (a primeira ativa).
const u = await db.execute(`SELECT id, slug, nome FROM Unidade ORDER BY id LIMIT 1`)
if (!u.rows.length) { console.log('✖ Nenhuma unidade cadastrada — rode o seed de unidades antes.'); process.exit(1) }
const unidade = u.rows[0]
console.log(`• Unidade de teste: ${unidade.nome} (${unidade.slug})`)

// 2. Usuário TERAPEUTA (login).
const EMAIL = 'terapeuta.teste@buddhaspa.com.br'
const SENHA = 'terapeuta2026'
let usuarioId
const ex = await db.execute({ sql: `SELECT id FROM Usuario WHERE email=?`, args: [EMAIL] })
if (ex.rows.length) {
  usuarioId = ex.rows[0].id
  await db.execute({ sql: `UPDATE Usuario SET perfil='TERAPEUTA', unidadeId=?, ativo=1 WHERE id=?`, args: [unidade.id, usuarioId] })
  console.log(`• Usuário terapeuta já existia (id=${usuarioId}) — perfil/unid. garantidos.`)
} else {
  usuarioId = 'ter_' + Math.random().toString(36).slice(2, 10)
  const hash = await bcrypt.hash(SENHA, 10)
  await db.execute({
    sql: `INSERT INTO Usuario ("id","nome","email","senha","perfil","unidadeId","ativo","createdAt") VALUES (?,?,?,?,?,?,1,?)`,
    args: [usuarioId, 'Maria (terapeuta teste)', EMAIL, hash, 'TERAPEUTA', unidade.id, now()],
  })
  console.log(`✔ Usuário terapeuta criado (senha "${SENHA}").`)
}

// 3. Registro Terapeuta ligado ao usuário.
let terapeutaId
const t = await db.execute({ sql: `SELECT id FROM Terapeuta WHERE usuarioId=?`, args: [usuarioId] })
if (t.rows.length) {
  terapeutaId = t.rows[0].id
} else {
  const ins = await db.execute({
    sql: `INSERT INTO "Terapeuta" ("nome","nomeBelle","unidadeSlug","usuarioId","ativo","criadoEm","atualizadoEm") VALUES (?,?,?,?,1,?,?)`,
    args: ['Maria (terapeuta teste)', 'Maria', unidade.slug, usuarioId, now(), now()],
  })
  terapeutaId = Number(ins.lastInsertRowid)
  console.log(`✔ Terapeuta criada (id=${terapeutaId}).`)
}

// 4. Atendimentos de exemplo (hoje), status PENDENTE — pra ela validar + recomendar.
const exemplos = [
  { cliente: 'Ana Beatriz Souza', servico: 'Massagem Relaxante 60min', hora: '09:00', comissao: 48 },
  { cliente: 'Carlos Mendes', servico: 'Massagem Relaxante 60min', hora: '10:30', comissao: 48 },
  { cliente: 'Juliana Prado', servico: 'Day Spa Prime Individual', hora: '13:00', comissao: 120 },
  { cliente: 'Roberto Lima', servico: 'Massagem Modeladora 50min', hora: '15:00', comissao: 45 },
  { cliente: 'Fernanda Alves', servico: 'Massagem Relaxante 60min', hora: '16:30', comissao: 48 },
]
let n = 0
for (const [i, e] of exemplos.entries()) {
  const belleId = `seed-${hoje()}-${i + 1}`
  await db.execute({
    sql: `INSERT INTO "Atendimento"
      ("belleId","unidadeSlug","terapeutaId","terapeutaNome","clienteNome","servico","data","hora","valorComissao","statusValidacao","fechamentoRef","criadoEm","atualizadoEm")
      VALUES (?,?,?,?,?,?,?,?,?, 'PENDENTE', ?, ?, ?)
      ON CONFLICT("belleId") DO NOTHING`,
    args: [belleId, unidade.slug, terapeutaId, 'Maria', e.cliente, e.servico, hoje(), e.hora, e.comissao, hoje().slice(0, 7), now(), now()],
  })
  n++
}
console.log(`✔ ${n} atendimentos de exemplo garantidos para hoje (${hoje()}).`)
console.log(`\n➡  Acesse /login com ${EMAIL} / ${SENHA} e depois /meus-atendimentos`)
process.exit(0)
