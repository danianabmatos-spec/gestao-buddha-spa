// Cria as tabelas do Cockpit de Rotinas (Coordenação/Recepção) e semeia o catálogo.
// Idempotente: CREATE TABLE IF NOT EXISTS + upsert por chave. NÃO toca em nada existente.
//
// Uso local:  node scripts/criar-tabelas-rotinas.mjs
// Uso VPS:    DATABASE_URL=file:/var/www/apps/gestao-buddha/dev.db node scripts/criar-tabelas-rotinas.mjs

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import path from 'node:path'

const url = process.env.DATABASE_URL || ('file:' + path.join(process.cwd(), 'dev.db'))
const db = createClient({ url })

const now = () => new Date().toISOString()

// ─── 1. Tabelas ─────────────────────────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "UsuarioUnidade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" TEXT NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioUnidade_usuarioId_unidadeId_key" ON "UsuarioUnidade"("usuarioId","unidadeId")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "UsuarioUnidade_usuarioId_idx" ON "UsuarioUnidade"("usuarioId")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "RotinaTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chave" TEXT NOT NULL UNIQUE,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "area" TEXT NOT NULL,
    "frente" TEXT,
    "frequencia" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 100,
    "diaSemana" INTEGER,
    "diaDoMes" INTEGER,
    "diaLimite" INTEGER,
    "horaPrevista" TEXT,
    "alertaDias" INTEGER,
    "acaoApp" TEXT,
    "unidadeId" INTEGER,
    "ativa" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "RotinaTemplate_area_frequencia_idx" ON "RotinaTemplate"("area","frequencia")`)
// Aditivo/idempotente: garante colunas em bancos já criados antes desta versão.
{
  const cols = (await db.execute('PRAGMA table_info(RotinaTemplate)')).rows.map((r) => r.name)
  if (!cols.includes('diaLimite')) {
    await db.execute(`ALTER TABLE "RotinaTemplate" ADD COLUMN "diaLimite" INTEGER`)
    console.log('✔ Coluna RotinaTemplate.diaLimite criada.')
  }
  if (!cols.includes('acaoApp')) {
    await db.execute(`ALTER TABLE "RotinaTemplate" ADD COLUMN "acaoApp" TEXT`)
    console.log('✔ Coluna RotinaTemplate.acaoApp criada.')
  }
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS "TarefaRotina" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "area" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "frequencia" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 100,
    "dataRef" TEXT NOT NULL,
    "dataOriginal" TEXT NOT NULL,
    "horaPrevista" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "atribuidoArea" TEXT,
    "prazo" TEXT,
    "alertaDias" INTEGER,
    "acaoApp" TEXT,
    "concluidaEm" DATETIME,
    "concluidaPorId" TEXT,
    "concluidaPorNome" TEXT,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
// NULLs são distintos no SQLite → tarefas delegadas (templateId NULL) não colidem;
// tarefas de sistema deduplicam por (unidade, template, dia).
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "TarefaRotina_unidadeId_templateId_dataRef_key" ON "TarefaRotina"("unidadeId","templateId","dataRef")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "TarefaRotina_unidadeId_dataRef_idx" ON "TarefaRotina"("unidadeId","dataRef")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "TarefaRotina_unidadeId_status_idx" ON "TarefaRotina"("unidadeId","status")`)
{
  const cols = (await db.execute('PRAGMA table_info(TarefaRotina)')).rows.map((r) => r.name)
  if (!cols.includes('acaoApp')) {
    await db.execute(`ALTER TABLE "TarefaRotina" ADD COLUMN "acaoApp" TEXT`)
    console.log('✔ Coluna TarefaRotina.acaoApp criada.')
  }
}

// ─── Controle de Caixa (recepção) ───────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS "ContagemCaixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "fundoAbertura" REAL,
    "abertoPorNome" TEXT,
    "abertoContadoPor" TEXT,
    "abertoEm" DATETIME,
    "obsAbertura" TEXT,
    "valorFechamento" REAL,
    "fechadoPorNome" TEXT,
    "fechadoContadoPor" TEXT,
    "fechadoEm" DATETIME,
    "obsFechamento" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "ContagemCaixa_unidadeId_data_key" ON "ContagemCaixa"("unidadeId","data")`)
{
  const cols = (await db.execute('PRAGMA table_info(ContagemCaixa)')).rows.map((r) => r.name)
  if (!cols.includes('abertoContadoPor')) { await db.execute(`ALTER TABLE "ContagemCaixa" ADD COLUMN "abertoContadoPor" TEXT`); console.log('✔ Coluna ContagemCaixa.abertoContadoPor criada.') }
  if (!cols.includes('fechadoContadoPor')) { await db.execute(`ALTER TABLE "ContagemCaixa" ADD COLUMN "fechadoContadoPor" TEXT`); console.log('✔ Coluna ContagemCaixa.fechadoContadoPor criada.') }
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS "SaidaCaixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "descricao" TEXT NOT NULL,
    "fotoPath" TEXT,
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS "SaidaCaixa_unidadeId_data_idx" ON "SaidaCaixa"("unidadeId","data")`)

await db.execute(`
  CREATE TABLE IF NOT EXISTS "TratativaNps" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unidadeId" INTEGER NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'NPS',
    "chaveCaso" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "classificacao" TEXT NOT NULL,
    "nota" INTEGER,
    "comentario" TEXT,
    "acaoTomada" TEXT NOT NULL,
    "tipoProblema" TEXT,
    "cortesiaConcedida" INTEGER,
    "clienteSatisfeito" TEXT,
    "tratadoPorId" TEXT,
    "tratadoPorNome" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT (datetime('now')),
    "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)
await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "TratativaNps_unidadeId_chaveCaso_key" ON "TratativaNps"("unidadeId","chaveCaso")`)
await db.execute(`CREATE INDEX IF NOT EXISTS "TratativaNps_unidadeId_idx" ON "TratativaNps"("unidadeId")`)
// Aditivo/idempotente: colunas novas em bancos criados antes desta versão.
{
  const cols = (await db.execute('PRAGMA table_info(TratativaNps)')).rows.map((r) => r.name)
  const add = async (nome, ddl) => { if (!cols.includes(nome)) { await db.execute(`ALTER TABLE "TratativaNps" ADD COLUMN ${ddl}`); console.log(`✔ Coluna TratativaNps.${nome} criada.`) } }
  await add('origem', `"origem" TEXT NOT NULL DEFAULT 'NPS'`)
  await add('tipoProblema', `"tipoProblema" TEXT`)
  await add('cortesiaConcedida', `"cortesiaConcedida" INTEGER`)
  await add('clienteSatisfeito', `"clienteSatisfeito" TEXT`)
}

for (const t of ['UsuarioUnidade', 'RotinaTemplate', 'TarefaRotina', 'TratativaNps', 'ContagemCaixa', 'SaidaCaixa']) {
  const check = await db.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [t] })
  console.log(check.rows.length ? `✔ Tabela ${t} pronta.` : `✖ Falhou ao criar ${t}.`)
}

// ─── 2. Catálogo de rotinas (da lista da Daniana) ───────────────────────────────
// frequencia: DIARIA | SEMANAL | MENSAL | SOB_DEMANDA
// diaSemana anchor SEMANAL = 1 (segunda). diaDoMes anchor MENSAL configurável.
const CATALOGO = [
  // ── COORDENAÇÃO ──
  { chave: 'agenda-preenchimento', titulo: 'Agenda: verificar e preencher', frente: 'Agenda', area: 'COORDENACAO', frequencia: 'DIARIA', ordem: 1, descricao: 'Verificar a quantidade de agendamentos do dia e definir ações de preenchimento da agenda. É a PRIMEIRA ação do dia.' },
  { chave: 'fila-do-dia', titulo: 'Fila do Dia (reativação)', frente: 'Reativação', area: 'COORDENACAO', frequencia: 'DIARIA', ordem: 10, descricao: 'Trabalhar a Fila do Dia — clientes a reativar (pacotes vencendo, clientes sumidos).' },
  { chave: 'experiencia-ambiente', titulo: 'Experiência & ambiente (5 sentidos)', frente: 'Experiência', area: 'COORDENACAO', frequencia: 'DIARIA', ordem: 20, descricao: 'Conferir o padrão de experiência e ambiente: aroma, chá, música, limpeza e a "cara" Buddha da unidade.' },
  { chave: 'validar-ponto', titulo: 'Validar ponto das funcionárias', frente: 'Equipe', area: 'COORDENACAO', frequencia: 'DIARIA', ordem: 30, descricao: 'Validar o ponto das funcionárias do dia.' },
  { chave: 'meta-desdobramento', titulo: 'Meta: acompanhar e desdobrar', frente: 'Metas', area: 'COORDENACAO', frequencia: 'DIARIA', ordem: 40, descricao: 'Acompanhar a meta e desdobrar mês → semana → dia.' },
  { chave: 'acomp-erros-financeiro', titulo: 'Acompanhar erros do Financeiro', frente: 'Financeiro', area: 'COORDENACAO', frequencia: 'DIARIA', ordem: 50, alertaDias: 3, descricao: 'Acompanhar a correção dos erros apontados pelo Financeiro. Alerta se ficar mais de 3 dias sem solução. Fim do mês tem que fechar sem pendências.' },
  { chave: 'estoque-semanal', titulo: 'Estoque: acompanhamento semanal', frente: 'Estoque', area: 'COORDENACAO', frequencia: 'SEMANAL', diaSemana: 1, ordem: 60, descricao: 'Acompanhamento semanal de estoque.' },
  { chave: 'feedback-clt', titulo: 'Feedback 1:1 com CLTs', frente: 'Equipe', area: 'COORDENACAO', frequencia: 'SEMANAL', diaSemana: 1, ordem: 61, descricao: 'Feedback 1:1 semanal com as CLTs.' },
  { chave: 'escala-mensal', titulo: 'Escala mensal (CLT + terapeutas)', frente: 'Escala', area: 'COORDENACAO', frequencia: 'MENSAL', diaDoMes: 15, diaLimite: 20, ordem: 70, descricao: 'Fazer a escala mensal (CLT + terapeutas) do mês seguinte. Iniciar no dia 15 e finalizar até o dia 20.' },
  { chave: 'estoque-inventario', titulo: 'Inventário de estoque', frente: 'Estoque', area: 'COORDENACAO', frequencia: 'MENSAL', diaDoMes: 21, diaLimite: 25, ordem: 71, descricao: 'Inventário mensal de estoque. Iniciar no dia 21 e finalizar até o dia 25.' },
  { chave: 'manutencao-checklist', titulo: 'Checklist de manutenção', frente: 'Manutenção', area: 'COORDENACAO', frequencia: 'MENSAL', diaDoMes: 1, ordem: 72, descricao: 'Checklist mensal de manutenção da unidade.' },
  { chave: 'nps-mensal', titulo: 'NPS: tratar avaliação recebida', frente: 'NPS', area: 'COORDENACAO', frequencia: 'SOB_DEMANDA', ordem: 73, alertaDias: 3, descricao: 'Ao receber uma avaliação de NPS (detrator/neutro), entrar em contato com o cliente. Alerta se ficar mais de 3 dias sem tratar.' },
  { chave: 'google-mensal', titulo: 'Google: responder avaliação recebida', frente: 'Reputação', area: 'COORDENACAO', frequencia: 'SOB_DEMANDA', ordem: 74, alertaDias: 3, descricao: 'Ao receber uma avaliação do Google diferente de 5 estrelas, responder e tratar. Alerta se ficar mais de 3 dias sem tratar.' },
  { chave: 'feedback-terapeutas', titulo: 'Feedback 1:1 com terapeutas', frente: 'Equipe', area: 'COORDENACAO', frequencia: 'MENSAL', diaDoMes: 1, ordem: 75, descricao: 'Feedback 1:1 mensal com as terapeutas.' },
  { chave: 'ajuste-escala-terapeutas', titulo: 'Ajuste de escala de terapeutas', frente: 'Escala', area: 'COORDENACAO', frequencia: 'SOB_DEMANDA', ordem: 80, descricao: 'Ajustes de escala de terapeutas ao longo do mês, sob demanda.' },
  { chave: 'tratar-detratores', titulo: 'Tratar detratores/neutros (NPS e Google)', frente: 'NPS', area: 'COORDENACAO', frequencia: 'SOB_DEMANDA', ordem: 81, descricao: 'Tratar detratores e neutros de NPS e Google, sob demanda.' },
  { chave: 'manutencao-demanda', titulo: 'Levantar necessidade de manutenção', frente: 'Manutenção', area: 'COORDENACAO', frequencia: 'SOB_DEMANDA', ordem: 82, descricao: 'Levantar necessidade de manutenção, sob demanda.' },
  { chave: 'marketing-local', titulo: 'Marketing local', frente: 'Marketing', area: 'COORDENACAO', frequencia: 'SOB_DEMANDA', ordem: 83, descricao: 'Ações de marketing local, sob demanda, junto com o marketing.' },

  // ── RECEPÇÃO ──
  { chave: 'rec-abertura', titulo: 'Abertura da unidade', frente: 'Abertura', area: 'RECEPCAO', frequencia: 'DIARIA', ordem: 1, acaoApp: 'caixa:abertura', descricao: 'Abertura da unidade: ambiente (aroma, chá, música), salas prontas e abertura de caixa (informe o fundo de troco no controle de caixa).' },
  { chave: 'rec-vouchers', titulo: 'Validação de vouchers', frente: 'Vouchers', area: 'RECEPCAO', frequencia: 'DIARIA', ordem: 10, descricao: 'Validar os vouchers do dia.' },
  { chave: 'rec-insumos', titulo: 'Levantar necessidade de insumos', frente: 'Estoque', area: 'RECEPCAO', frequencia: 'DIARIA', ordem: 20, descricao: 'Levantar diariamente a necessidade de insumos.' },
  { chave: 'rec-erros-financeiro', titulo: 'Corrigir erros do Financeiro', frente: 'Financeiro', area: 'RECEPCAO', frequencia: 'DIARIA', ordem: 30, alertaDias: 3, descricao: 'Corrigir os erros apontados pelo Financeiro. Alerta se ficar mais de 3 dias sem solução.' },
  { chave: 'rec-fechamento-turno', titulo: 'Fechamento + troca de turno', frente: 'Fechamento', area: 'RECEPCAO', frequencia: 'DIARIA', ordem: 40, acaoApp: 'caixa:fechamento', descricao: 'Fechamento do caixa (informe o valor contado no controle de caixa) e registrar o procedimento de troca de turno para o próximo turno saber o que fazer.' },
]

let seeded = 0
for (const r of CATALOGO) {
  await db.execute({
    sql: `INSERT INTO "RotinaTemplate"
      ("chave","titulo","descricao","area","frente","frequencia","ordem","diaSemana","diaDoMes","diaLimite","horaPrevista","alertaDias","acaoApp","unidadeId","ativa","criadoEm","atualizadoEm")
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
      ON CONFLICT("chave") DO UPDATE SET
        titulo=excluded.titulo, descricao=excluded.descricao, area=excluded.area, frente=excluded.frente,
        frequencia=excluded.frequencia, ordem=excluded.ordem, diaSemana=excluded.diaSemana,
        diaDoMes=excluded.diaDoMes, diaLimite=excluded.diaLimite, horaPrevista=excluded.horaPrevista, alertaDias=excluded.alertaDias,
        acaoApp=excluded.acaoApp, atualizadoEm=excluded.atualizadoEm`,
    args: [r.chave, r.titulo, r.descricao ?? null, r.area, r.frente ?? null, r.frequencia, r.ordem ?? 100,
      r.diaSemana ?? null, r.diaDoMes ?? null, r.diaLimite ?? null, r.horaPrevista ?? null, r.alertaDias ?? null, r.acaoApp ?? null, r.unidadeId ?? null,
      now(), now()],
  })
  seeded++
}
console.log(`✔ Catálogo semeado: ${seeded} rotinas (${CATALOGO.filter(r=>r.area==='COORDENACAO').length} coordenação, ${CATALOGO.filter(r=>r.area==='RECEPCAO').length} recepção).`)

// ─── 3. Coordenadora de teste (multi-unidade) — SÓ EM DESENVOLVIMENTO ────────────
// NÃO cria em produção (DATABASE_URL apontando p/ /var/www). Evita conta de teste
// com senha fraca no ar. Local: cria normalmente. senha "coord2026", unidades 1+7.
if ((process.env.DATABASE_URL || '').includes('/var/www')) {
  console.log('• Ambiente de produção — coordenadora de teste NÃO criada.')
  process.exit(0)
}
const COORD_EMAIL = 'coordenacao.teste@buddhaspa.com.br'
const COORD_SENHA = 'coord2026'
const COORD_UNIDADES = [1, 7]

const existente = await db.execute({ sql: `SELECT id FROM Usuario WHERE email=?`, args: [COORD_EMAIL] })
let coordId
if (existente.rows.length) {
  coordId = existente.rows[0].id
  console.log(`• Coordenadora de teste já existe (id=${coordId}).`)
} else {
  coordId = 'coord_' + Math.random().toString(36).slice(2, 10)
  const hash = await bcrypt.hash(COORD_SENHA, 10)
  await db.execute({
    sql: `INSERT INTO Usuario ("id","nome","email","senha","perfil","unidadeId","ativo","createdAt")
          VALUES (?,?,?,?,?,NULL,1,?)`,
    args: [coordId, 'Coordenação (teste)', COORD_EMAIL, hash, 'COORDENACAO', now()],
  })
  console.log(`✔ Coordenadora de teste criada (id=${coordId}, senha "${COORD_SENHA}").`)
}

for (const uid of COORD_UNIDADES) {
  await db.execute({
    sql: `INSERT INTO "UsuarioUnidade" ("usuarioId","unidadeId","criadoEm") VALUES (?,?,?)
          ON CONFLICT("usuarioId","unidadeId") DO NOTHING`,
    args: [coordId, uid, now()],
  })
}
console.log(`✔ Coordenadora vinculada às unidades: ${COORD_UNIDADES.join(', ')}.`)

process.exit(0)
