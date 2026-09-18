// Seed de DESENVOLVIMENTO: cria recomendações + vendas de exemplo para várias
// terapeutas do Shopping Metrópole, pra a tela de Pontuação ter ranking + prêmios.
// Uso: node scripts/seed-pontuacao-demo.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
if (url.includes('/var/www')) { console.log('• Produção — seed NÃO executado.'); process.exit(0) }
const db = createClient({ url })
const now = () => new Date().toISOString()
const USUARIO = 'ter_zp99hrw1'

// [tipo, quantidade] — pacote = nº de sessões pagas.
const PLANOS = [
  [['PACOTE', 30], ['VOUCHER', 2], ['PRODUTO', 3]],   // 35
  [['PACOTE', 20], ['VOUCHER', 3], ['PRODUTO', 2]],   // 25
  [['PACOTE', 15], ['NOVO_AGENDAMENTO', 2]],          // 17
  [['PACOTE', 15], ['PRODUTO', 4]],                   // 19
  [['VOUCHER', 4], ['NOVO_AGENDAMENTO', 3], ['PRODUTO', 5]], // 12
  [['PACOTE', 12], ['VOUCHER', 2]],                   // 14
  [['PACOTE', 10], ['PRODUTO', 3]],                   // 13
  [['PACOTE', 18], ['VOUCHER', 1], ['NOVO_AGENDAMENTO', 1]], // 20
]

const ters = await db.execute(`
  SELECT id, nome FROM Terapeuta
  WHERE unidadeSlug='shopping-metropole' AND ativo=1 AND lower(nome) NOT LIKE '%banho%' AND trim(nome)<>'---'
  ORDER BY id LIMIT ${PLANOS.length}
`)
if (!ters.rows.length) { console.log('• Sem terapeutas — rode o sync antes.'); process.exit(0) }

let nRec = 0, nVenda = 0, totalPts = 0
for (let i = 0; i < ters.rows.length; i++) {
  const ter = ters.rows[i]
  const plano = PLANOS[i % PLANOS.length]
  const at = await db.execute({
    sql: `SELECT belleId, clienteNome, data, servico FROM Atendimento
          WHERE terapeutaId=? AND belleId NOT IN (SELECT belleId FROM Recomendacao) LIMIT 1`,
    args: [ter.id],
  })
  if (!at.rows.length) continue
  const a = at.rows[0]

  await db.execute({
    sql: `INSERT INTO "Recomendacao"
      ("belleId","unidadeSlug","usuarioId","terapeutaNome","clienteNome","dataAtendimento","servico","status","criadoEm","atualizadoEm")
      VALUES (?,?,?,?,?,?,?, 'VENDIDA', ?, ?) ON CONFLICT("belleId") DO NOTHING`,
    args: [a.belleId, 'shopping-metropole', USUARIO, ter.nome, a.clienteNome, a.data, a.servico, now(), now()],
  })
  const rec = await db.execute({ sql: `SELECT id FROM Recomendacao WHERE belleId=?`, args: [a.belleId] })
  const recId = rec.rows[0].id
  nRec++

  // Venda (remove venda anterior desta recomendação, se houver, pra ser idempotente)
  await db.execute({ sql: `DELETE FROM Venda WHERE recomendacaoId=?`, args: [recId] })
  const ins = await db.execute({
    sql: `INSERT INTO "Venda" ("recomendacaoId","belleId","unidadeSlug","confirmadoPorNome","criadoEm","atualizadoEm")
          VALUES (?,?,?, 'Recepção (demo)', ?, ?)`,
    args: [recId, a.belleId, 'shopping-metropole', now(), now()],
  })
  const vendaId = Number(ins.lastInsertRowid)
  for (const [tipo, qtd] of plano) {
    await db.execute({ sql: `INSERT INTO "VendaItem" ("vendaId","tipo","quantidade","criadoEm") VALUES (?,?,?,?)`, args: [vendaId, tipo, qtd, now()] })
    totalPts += qtd
  }
  nVenda++
}
console.log(`✔ ${nRec} recomendações VENDIDAS + ${nVenda} vendas criadas. Total de pontos na unidade: ${totalPts}.`)
process.exit(0)
