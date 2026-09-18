// Provisiona os logins reais no gestao a partir do export do rh (/root/rh_pessoas.json):
//  - TERAPEUTA: 1 Usuario por terapeuta (e-mail do rh), linkado ao Terapeuta (casando nome),
//  - COORDENACAO: coordenadoras + Monique (financeiro) em Tatuapé/Mooca, ligadas às unidades.
// Senha padrão + primeirAcesso=1 (troca obrigatória no 1º acesso). IDEMPOTENTE:
//  não recria quem já existe (por e-mail) e NÃO reseta senha de quem já trocou.
//
// Uso (no VPS): DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db \
//   SENHA_PADRAO='Buddha@2026' PESSOAS_JSON=/root/rh_pessoas.json node scripts/provisionar-logins.mjs

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const JSON_PATH = process.env.PESSOAS_JSON || '/root/rh_pessoas.json'
const SENHA_PADRAO = process.env.SENHA_PADRAO || 'Buddha@2026'
const db = createClient({ url })

const SLUG_NOME = {
  'shopping-metropole': 'shopping metropole', 'analia-franco': 'analia franco',
  'shopping-analia-franco': 'shopping analia franco', 'perdizes': 'perdizes',
  'tatuape-gomescardim': 'tatuape gomescardim', 'mooca-plaza': 'mooca plaza', 'higienopolis': 'higienopolis',
}
const NOME_SLUG = Object.fromEntries(Object.entries(SLUG_NOME).map(([s, n]) => [n, s]))
// Fallback sem espaços: "tatuape gomes cardim" (rh) casa com "tatuape gomescardim" (gestao).
const NOME_SLUG_NS = Object.fromEntries(Object.entries(SLUG_NOME).map(([s, n]) => [n.replace(/ /g, ''), s]))
const MONIQUE_UNIDADES = ['tatuape-gomescardim', 'mooca-plaza'] // decisão da Daniana

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
const toks = (s) => norm(s).split(' ').filter((w) => w.length >= 3)
const nomeParaSlug = (nomeUnidade) => NOME_SLUG[norm(nomeUnidade)] || NOME_SLUG_NS[norm(nomeUnidade).replace(/ /g, '')] || null
const now = () => new Date().toISOString()

const pessoas = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
const hash = await bcrypt.hash(SENHA_PADRAO, 10)

const uni = await db.execute(`SELECT id, slug FROM Unidade`)
const slugId = new Map(uni.rows.map((r) => [r.slug, r.id]))

async function upsertUsuario(nome, email, perfil, unidadeId) {
  const e = String(email).toLowerCase().trim()
  const ex = await db.execute({ sql: `SELECT id FROM Usuario WHERE email=?`, args: [e] })
  if (ex.rows.length) {
    await db.execute({ sql: `UPDATE Usuario SET perfil=?, unidadeId=?, ativo=1 WHERE email=?`, args: [perfil, unidadeId ?? null, e] })
    return { id: ex.rows[0].id, novo: false }
  }
  const id = perfil.toLowerCase().slice(0, 3) + '_' + Math.random().toString(36).slice(2, 12)
  await db.execute({
    sql: `INSERT INTO Usuario ("id","nome","email","senha","perfil","unidadeId","ativo","primeirAcesso","createdAt") VALUES (?,?,?,?,?,?,1,1,?)`,
    args: [id, nome, e, hash, perfil, unidadeId ?? null, now()],
  })
  return { id, novo: true }
}

// ── TERAPEUTAS ──
let terNovos = 0, terLink = 0, terCriada = 0, terSemUnidade = 0
for (const t of pessoas.terapeutas) {
  const slug = t.unidades.map(nomeParaSlug).find(Boolean)
  if (!slug) { terSemUnidade++; continue }
  const unidadeId = slugId.get(slug) ?? null
  const u = await upsertUsuario(t.nome, t.email, 'TERAPEUTA', unidadeId)
  if (u.novo) terNovos++

  const pool = (await db.execute({ sql: `SELECT id, nome, nomeBelle FROM Terapeuta WHERE unidadeSlug=? AND ativo=1`, args: [slug] })).rows
  const n = norm(t.nome)
  let ter = pool.find((x) => x.nomeBelle && norm(x.nomeBelle) === n) || pool.find((x) => norm(x.nome) === n)
  if (!ter) {
    const tkA = toks(t.nome)
    const cand = pool.filter((x) => {
      const tk = toks(x.nome); if (!tk.length || !tkA.length) return false
      const sh = tkA.filter((w) => tk.includes(w)).length
      return tkA[0] === tk[0] && sh >= 2 && sh / Math.max(tkA.length, tk.length) >= 0.5
    })
    if (cand.length === 1) ter = cand[0]
  }
  if (ter) {
    await db.execute({ sql: `UPDATE Terapeuta SET usuarioId=?, nomeBelle=COALESCE(nomeBelle, nome), atualizadoEm=? WHERE id=?`, args: [u.id, now(), ter.id] })
    terLink++
  } else {
    await db.execute({ sql: `INSERT INTO Terapeuta ("nome","nomeBelle","unidadeSlug","usuarioId","ativo","criadoEm","atualizadoEm") VALUES (?,?,?,?,1,?,?)`, args: [t.nome, t.nome, slug, u.id, now(), now()] })
    terCriada++
  }
}

// ── COORDENAÇÃO (coordenadoras + Monique) ──
async function coordenar(nome, email, slugs) {
  const u = await upsertUsuario(nome, email, 'COORDENACAO', null)
  await db.execute({ sql: `DELETE FROM UsuarioUnidade WHERE usuarioId=?`, args: [u.id] })
  for (const s of slugs) {
    const uid = slugId.get(s)
    if (uid) await db.execute({ sql: `INSERT INTO "UsuarioUnidade" ("usuarioId","unidadeId","criadoEm") VALUES (?,?,?) ON CONFLICT("usuarioId","unidadeId") DO NOTHING`, args: [u.id, uid, now()] })
  }
  return u.novo
}
let coordNovos = 0
for (const c of pessoas.coordenadoras) {
  if (await coordenar(c.nome, c.email, c.unidades.map(nomeParaSlug).filter(Boolean))) coordNovos++
}
const mon = (pessoas.financeiro || [])[0]
if (mon && await coordenar(mon.nome, mon.email, MONIQUE_UNIDADES)) coordNovos++

console.log(`✔ TERAPEUTAS: ${terNovos} usuários novos | ${terLink} linkados a Terapeuta existente | ${terCriada} Terapeuta criada (sem atendimento) | ${terSemUnidade} sem unidade mapeada`)
console.log(`✔ COORDENAÇÃO: ${coordNovos} usuários novos (coordenadoras + Monique em Tatuapé/Mooca)`)
console.log(`   senha padrão: ${SENHA_PADRAO} · todos com troca obrigatória no 1º acesso`)
process.exit(0)
