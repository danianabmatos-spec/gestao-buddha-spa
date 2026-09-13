// Teste de fumaça do ALGORITMO do motor de Rotinas contra o banco vivo (via libsql).
// Reproduz a lógica de src/lib/rotinas/motor.ts: geração por cadência + acúmulo + listagem.
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import path from 'node:path'

const db = createClient({ url: process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db')) })

const hojeISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const dow = (iso) => new Date(`${iso}T00:00:00`).getDay()
const dom = (iso) => parseInt(iso.slice(8,10),10)
const dataRef = hojeISO()
const now = () => new Date().toISOString()

async function ensure(unidadeId) {
  const templates = (await db.execute({ sql: `SELECT * FROM RotinaTemplate WHERE ativa=1 AND (unidadeId IS NULL OR unidadeId=?)`, args: [unidadeId] })).rows
  for (const t of templates) {
    if (t.frequencia === 'SOB_DEMANDA') continue
    const jaHoje = (await db.execute({ sql: `SELECT id FROM TarefaRotina WHERE unidadeId=? AND templateId=? AND dataRef=?`, args: [unidadeId, t.id, dataRef] })).rows
    if (jaHoje.length) continue
    const ins = async (prazo=null) => db.execute({
      sql: `INSERT INTO TarefaRotina (unidadeId,templateId,area,titulo,descricao,frequencia,ordem,dataRef,dataOriginal,horaPrevista,status,origem,prazo,alertaDias,criadoEm,atualizadoEm)
            VALUES (?,?,?,?,?,?,?,?,?,?, 'PENDENTE','SISTEMA', ?,?,?,?)`,
      args: [unidadeId, t.id, t.area, t.titulo, t.descricao, t.frequencia, t.ordem, dataRef, dataRef, t.horaPrevista, prazo, t.alertaDias, now(), now()],
    })
    if (t.frequencia === 'DIARIA') {
      const aberta = (await db.execute({ sql: `SELECT id FROM TarefaRotina WHERE unidadeId=? AND templateId=? AND status!='CONCLUIDA' AND dataRef<? ORDER BY dataRef DESC LIMIT 1`, args: [unidadeId, t.id, dataRef] })).rows
      if (aberta.length) { await db.execute({ sql: `UPDATE TarefaRotina SET dataRef=?, atualizadoEm=? WHERE id=?`, args: [dataRef, now(), aberta[0].id] }); continue }
      await ins()
    } else if (t.frequencia === 'SEMANAL') {
      if (Number(t.diaSemana) === dow(dataRef)) await ins()
    } else if (t.frequencia === 'MENSAL') {
      if (Number(t.diaDoMes) === dom(dataRef)) await ins(t.diaLimite ? `${dataRef.slice(0,7)}-${String(t.diaLimite).padStart(2,'0')}` : null)
    }
  }
}

console.log(`📅 Hoje = ${dataRef} (dia da semana ${dow(dataRef)}, dia do mês ${dom(dataRef)})\n`)

// 1) Login da coordenadora (bcrypt + carga de unidades via UsuarioUnidade)
const coord = (await db.execute({ sql: `SELECT * FROM Usuario WHERE email=?`, args: ['coordenacao.teste@buddhaspa.com.br'] })).rows[0]
const senhaOk = coord && await bcrypt.compare('coord2026', coord.senha)
const vinc = (await db.execute({ sql: `SELECT un.id, un.nome, un.slug FROM UsuarioUnidade uu JOIN Unidade un ON un.id=uu.unidadeId WHERE uu.usuarioId=?`, args: [coord.id] })).rows
console.log(`✔ Login coordenadora: senha ${senhaOk ? 'OK' : 'FALHOU'}, perfil ${coord.perfil}, unidades = [${vinc.map(v=>v.slug).join(', ')}]`)

// 2) Gera e lista as tarefas do dia de cada unidade dela
for (const v of vinc) {
  await ensure(v.id)
  const tarefas = (await db.execute({ sql: `SELECT * FROM TarefaRotina WHERE unidadeId=? AND (dataRef=? OR (dataRef<? AND status!='CONCLUIDA')) ORDER BY area ASC, ordem ASC`, args: [v.id, dataRef, dataRef] })).rows
  const coordN = tarefas.filter(t=>t.area==='COORDENACAO').length
  const recepN = tarefas.filter(t=>t.area==='RECEPCAO').length
  console.log(`\n🏢 ${v.nome}: ${tarefas.length} tarefas hoje (${coordN} coordenação, ${recepN} recepção)`)
  for (const t of tarefas) console.log(`   • [${String(t.area).slice(0,5)}] ${t.titulo}  (${t.frequencia}${t.prazo ? ', prazo '+t.prazo : ''})`)
}

process.exit(0)
