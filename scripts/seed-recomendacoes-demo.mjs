// Seed de DESENVOLVIMENTO: cria recomendações de exemplo (ligadas a atendimentos reais
// do Shopping Metrópole) pra a fila do pós-venda ter conteúdo. NÃO roda em produção.
// Uso: node scripts/seed-recomendacoes-demo.mjs

import { createClient } from '@libsql/client'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
if (url.includes('/var/www')) { console.log('• Produção — seed NÃO executado.'); process.exit(0) }
const db = createClient({ url })
const now = () => new Date().toISOString()

const USUARIO = 'ter_zp99hrw1' // usuário terapeuta de teste (só referência)
const PLANOS = [
  { itens: ['OLEO_SONO', 'CHA_RELAX'], retorno: 'Massagem relaxante a cada 15 dias', tel: '11999990001' },
  { itens: ['PACOTE'], retorno: 'Pacote de 10 sessões de relaxante', tel: '11999990002' },
  { itens: ['OLEO_CALMA', 'NOVO_AGENDAMENTO'], retorno: 'Voltar em 1 semana', tel: null },
  { itens: ['CHA_DETOX', 'PRODUTO_OUTRO'], retorno: 'Continuar o cuidado em casa', tel: null },
  { itens: ['VOUCHER'], retorno: 'Presentear alguém especial', tel: '11999990005' },
]

const ats = await db.execute(`
  SELECT belleId, clienteNome, terapeutaNome, data, servico
  FROM Atendimento
  WHERE unidadeSlug='shopping-metropole' AND belleId NOT IN (SELECT belleId FROM Recomendacao)
  ORDER BY data DESC LIMIT ${PLANOS.length}
`)
if (!ats.rows.length) { console.log('• Sem atendimentos disponíveis (rode o sync antes).'); process.exit(0) }

let n = 0
for (let i = 0; i < ats.rows.length; i++) {
  const a = ats.rows[i]
  const plano = PLANOS[i % PLANOS.length]
  const ins = await db.execute({
    sql: `INSERT INTO "Recomendacao"
      ("belleId","unidadeSlug","usuarioId","terapeutaNome","clienteNome","clienteTelefone","dataAtendimento","servico","retorno","status","criadoEm","atualizadoEm")
      VALUES (?,?,?,?,?,?,?,?,?, 'PENDENTE_VENDA', ?, ?)
      ON CONFLICT("belleId") DO NOTHING`,
    args: [a.belleId, 'shopping-metropole', USUARIO, a.terapeutaNome, a.clienteNome, plano.tel, a.data, a.servico, plano.retorno, now(), now()],
  })
  if (!ins.rowsAffected) continue
  const rec = await db.execute({ sql: `SELECT id FROM Recomendacao WHERE belleId=?`, args: [a.belleId] })
  const recId = rec.rows[0].id
  for (const tipo of plano.itens) {
    await db.execute({ sql: `INSERT INTO "RecomendacaoItem" ("recomendacaoId","tipo","criadoEm") VALUES (?,?,?)`, args: [recId, tipo, now()] })
  }
  n++
}
console.log(`✔ ${n} recomendações de demonstração criadas (fila do pós-venda).`)
process.exit(0)
