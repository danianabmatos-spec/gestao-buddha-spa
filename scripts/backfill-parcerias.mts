// Backfill do histórico de parcerias (Gympass + TotalPass) por unidade, no cache
// FaturamentoHistorico. Puxa cada mês FECHADO do Belle (getFaturamentoMensal, que já
// retorna gympass/totalPass) e faz upsert. Idempotente: pula meses que já têm parceria
// gravada, a menos que --force. Também completa caixa/horas de quebra.
//
// Uso: npx tsx scripts/backfill-parcerias.mts <unidadeSlug> [--from=YYYY-MM] [--force]
// Ex.: npx tsx scripts/backfill-parcerias.mts higienopolis
import fs from 'node:fs'

// carrega .env.local ANTES de importar prisma/libs (DATABASE_URL + BELLE_*)
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const slug = process.argv[2]
if (!slug) { console.error('uso: npx tsx scripts/backfill-parcerias.mts <unidadeSlug> [--from=YYYY-MM] [--force]'); process.exit(1) }
const force = process.argv.includes('--force')
const fromArg = process.argv.find(a => a.startsWith('--from='))?.split('=')[1]

const { getFaturamentoMensal } = await import('@/lib/belle/bi')
const { getUnidadeCredenciais } = await import('@/lib/belle/unidades-config')
const { prisma } = await import('@/lib/prisma')

const cred = getUnidadeCredenciais(slug)
if (!cred) { console.error(`unidade não encontrada: ${slug}`); process.exit(1) }

// Início: --from ou jan/2023 (a página ignora meses vazios). Fim: último mês FECHADO.
const [fromAno, fromMes] = (fromArg ?? '2023-01').split('-').map(Number)
const hoje = new Date()
let endAno = hoje.getFullYear()
let endMes = hoje.getMonth() // 0-based getMonth() = mês anterior em 1-based -> último fechado
if (endMes === 0) { endMes = 12; endAno -= 1 }

console.log(`Backfill parcerias ${slug}: ${fromAno}-${String(fromMes).padStart(2,'0')} → ${endAno}-${String(endMes).padStart(2,'0')} ${force ? '(force)' : ''}`)

let ok = 0, pulados = 0, vazios = 0, erros = 0
for (let ano = fromAno; ano <= endAno; ano++) {
  const mIni = ano === fromAno ? fromMes : 1
  const mFim = ano === endAno ? endMes : 12
  for (let mes = mIni; mes <= mFim; mes++) {
    try {
      if (!force) {
        const ex = await prisma.faturamentoHistorico.findUnique({
          where: { unidadeSlug_ano_mes: { unidadeSlug: slug, ano, mes } },
        })
        if (ex && (ex.gympass > 0 || ex.totalpass > 0)) { pulados++; continue }
      }
      const mm = String(mes).padStart(2, '0')
      const dataIni = `${ano}-${mm}-01`
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const dataFim = `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}`
      const f = await getFaturamentoMensal(cred.email, cred.password, String(cred.estab), dataIni, dataFim)
      const gympass = f.gympass ?? 0
      const totalpass = f.totalPass ?? 0
      const caixa = f.caixa ?? 0
      const horas = f.horasAtendimento ?? 0
      if (gympass === 0 && totalpass === 0 && caixa === 0 && horas === 0) {
        vazios++; console.log(`  ${ano}-${mm}: vazio (sem dados no Belle) — não grava`); continue
      }
      await prisma.faturamentoHistorico.upsert({
        where: { unidadeSlug_ano_mes: { unidadeSlug: slug, ano, mes } },
        create: { unidadeSlug: slug, ano, mes, caixa, horas, gympass, totalpass },
        update: { caixa, horas, gympass, totalpass },
      })
      ok++
      console.log(`  ${ano}-${mm}: gympass=${gympass.toFixed(2)} totalpass=${totalpass.toFixed(2)} (caixa=${caixa.toFixed(0)} horas=${horas.toFixed(1)})`)
    } catch (e) {
      erros++
      console.error(`  ${ano}-${String(mes).padStart(2,'0')}: ERRO —`, (e as Error).message)
    }
  }
}
console.log(`\nFim: gravados=${ok} pulados=${pulados} vazios=${vazios} erros=${erros}`)
process.exit(0)
