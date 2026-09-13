// Testa idempotência da geração e o ACÚMULO (carry-over) de tarefa diária não feita.
import { createClient } from '@libsql/client'
import path from 'node:path'
const db = createClient({ url: process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db')) })
const now = () => new Date().toISOString()
const hoje = '2026-09-01'
const ontem = '2026-08-31'

// Reaproveita a mesma lógica DIÁRIA do motor, isolada para a tarefa "Abertura" (unidade 1).
const tpl = (await db.execute(`SELECT * FROM RotinaTemplate WHERE chave='rec-abertura'`)).rows[0]

async function ensureDiaria(unidadeId, t, dataRef) {
  const jaHoje = (await db.execute({ sql: `SELECT id FROM TarefaRotina WHERE unidadeId=? AND templateId=? AND dataRef=?`, args: [unidadeId, t.id, dataRef] })).rows
  if (jaHoje.length) return 'existe-hoje(skip)'
  const aberta = (await db.execute({ sql: `SELECT id FROM TarefaRotina WHERE unidadeId=? AND templateId=? AND status!='CONCLUIDA' AND dataRef<? ORDER BY dataRef DESC LIMIT 1`, args: [unidadeId, t.id, dataRef] })).rows
  if (aberta.length) { await db.execute({ sql: `UPDATE TarefaRotina SET dataRef=?, atualizadoEm=? WHERE id=?`, args: [dataRef, now(), aberta[0].id] }); return 'carregada(carry-over)' }
  await db.execute({ sql: `INSERT INTO TarefaRotina (unidadeId,templateId,area,titulo,frequencia,ordem,dataRef,dataOriginal,status,origem,criadoEm,atualizadoEm) VALUES (?,?,?,?,?,?,?,?, 'PENDENTE','SISTEMA',?,?)`, args: [unidadeId, t.id, t.area, t.titulo, t.frequencia, t.ordem, dataRef, dataRef, now(), now()] })
  return 'criada-nova'
}

// 1) Idempotência: rodar de novo para hoje não deve duplicar
const antes = (await db.execute({ sql: `SELECT COUNT(*) n FROM TarefaRotina WHERE unidadeId=1 AND templateId=? AND dataRef=?`, args: [tpl.id, hoje] })).rows[0].n
const r1 = await ensureDiaria(1, tpl, hoje)
const depois = (await db.execute({ sql: `SELECT COUNT(*) n FROM TarefaRotina WHERE unidadeId=1 AND templateId=? AND dataRef=?`, args: [tpl.id, hoje] })).rows[0].n
console.log(`1) Idempotência "Abertura": antes=${antes}, ação=${r1}, depois=${depois}  ${Number(antes)===Number(depois)?'✔ não duplicou':'✖ DUPLICOU'}`)

// 2) Acúmulo: joga a de hoje para ONTEM (fingindo que não foi feita), depois roda a geração de hoje.
await db.execute({ sql: `UPDATE TarefaRotina SET dataRef=?, dataOriginal=? WHERE unidadeId=1 AND templateId=? AND dataRef=?`, args: [ontem, ontem, tpl.id, hoje] })
const r2 = await ensureDiaria(1, tpl, hoje)
const row = (await db.execute({ sql: `SELECT dataRef, dataOriginal, status FROM TarefaRotina WHERE unidadeId=1 AND templateId=? ORDER BY id DESC LIMIT 1`, args: [tpl.id] })).rows[0]
const total = (await db.execute({ sql: `SELECT COUNT(*) n FROM TarefaRotina WHERE unidadeId=1 AND templateId=?`, args: [tpl.id] })).rows[0].n
const atraso = Math.round((new Date(hoje) - new Date(row.dataOriginal)) / 86400000)
console.log(`2) Acúmulo: ação=${r2}, agora dataRef=${row.dataRef}, dataOriginal=${row.dataOriginal} → atraso=${atraso}d, total de instâncias=${total}`)
console.log(`   ${r2==='carregada(carry-over)' && row.dataRef===hoje && Number(total)===1 ? '✔ carregou a mesma tarefa p/ hoje com atraso (não criou 2ª)' : '✖ comportamento inesperado'}`)

process.exit(0)
