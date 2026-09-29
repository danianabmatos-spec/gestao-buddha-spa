// E2E F2 (dev.db): popula Parte 1 + roda ingestão/motor da Parte 2 e valida
// divergências + idempotência. Uso: npx tsx scripts/testar-f2-atendimentos.ts
import fs from 'node:fs'

// carrega .env.local no process.env ANTES de importar prisma/libs
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const slug = 'shopping-metropole', ini = '2026-09-01', fim = '2026-09-19'

const { ingerirMovimentacoes } = await import('@/lib/conciliacao/ingestao-belle')
const { ingerirAtendimentos } = await import('@/lib/conciliacao/ingestao-atendimentos')
const { conciliarAtendimentosDia } = await import('@/lib/conciliacao/motor-atendimentos')
const { prisma } = await import('@/lib/prisma')

const unidade = await prisma.unidade.findUnique({ where: { slug } })
if (!unidade) throw new Error('unidade não encontrada no dev.db')
const unidadeId = unidade.id

console.log('1) Parte 1 — ingerindo movimentações (lastro financeiro)...')
const m = await ingerirMovimentacoes(slug, ini, fim)
console.log(`   movs: lidas=${m.lidas} gravadas=${m.gravadas} dias=${m.dias}`)

console.log('2) Parte 2 — ingerindo + classificando + conciliando atendimentos...')
const a1 = await ingerirAtendimentos(slug, ini, fim)
console.log('   distribuição:', JSON.stringify(a1.distribuicao))

async function snapshot(tag: string) {
  const porCls = await prisma.atendimentoConc.groupBy({ by: ['classificacao'], where: { unidadeId }, _count: true })
  const div = await prisma.divergencia.count({ where: { unidadeId, tipo: { in: ['ATENDIMENTO_SEM_JUSTIFICATIVA', 'CORTESIA', 'DESCONTO'] } } })
  const divAbertas = await prisma.divergencia.count({ where: { unidadeId, tipo: { in: ['ATENDIMENTO_SEM_JUSTIFICATIVA', 'CORTESIA', 'DESCONTO'] }, status: { in: ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA'] } } })
  console.log(`   [${tag}] AtendimentoConc: ${JSON.stringify(porCls.map(p => `${p.classificacao}:${p._count}`))} · Divergências atend: ${div} (abertas ${divAbertas})`)
  return { div, divAbertas }
}
const s1 = await snapshot('após 1ª rodada')

console.log('3) Idempotência — reprocessando os mesmos dias...')
const dias = (await prisma.atendimentoConc.findMany({ where: { unidadeId }, select: { data: true }, distinct: ['data'] })).map(d => d.data)
for (const d of dias) await conciliarAtendimentosDia(unidadeId, d)
const s2 = await snapshot('após reprocessar')
console.log(`   idempotente: divergências ${s1.div}→${s2.div} ${s1.div === s2.div ? '✅ estável' : '❌ MUDOU'}`)

console.log('4) Exemplos SEM_JUSTIFICATIVA (🔴 vazamentos):')
const leaks = await prisma.atendimentoConc.findMany({ where: { unidadeId, classificacao: 'SEM_JUSTIFICATIVA' }, take: 10 })
leaks.forEach(l => console.log(`   ${l.data} | ${l.servico} | ${l.clienteNome}`))

console.log('5) Loop — simulando correção (1 leak vira FINANCEIRO) e reprocessando...')
if (leaks[0]) {
  await prisma.atendimentoConc.update({ where: { id: leaks[0].id }, data: { classificacao: 'A_VERIFICAR_FINANCEIRO' } })
  // injeta um pagamento fake pro cliente nesse dia
  await prisma.movimentacaoBelle.create({ data: { unidadeId, belleMovId: `TESTE-${leaks[0].id}`, data: leaks[0].data, clienteNome: leaks[0].clienteNome, clienteId: leaks[0].clienteId, formaPagamento: 'Dinheiro', tipoMovimento: 'E', valorLiquido: leaks[0].valorBruto || 100 } })
  await conciliarAtendimentosDia(unidadeId, leaks[0].data)
  const depois = await prisma.atendimentoConc.findUnique({ where: { id: leaks[0].id } })
  const dv = depois?.divergenciaId ? await prisma.divergencia.findUnique({ where: { id: depois.divergenciaId } }) : null
  console.log(`   ${leaks[0].clienteNome}: ${depois?.classificacao} · divergência status=${dv?.status ?? '(sem)'} ${depois?.classificacao === 'FINANCEIRO' && (!dv || dv.status === 'CONCILIADA') ? '✅ loop fechou' : '❌'}`)
  // limpa o pagamento fake
  await prisma.movimentacaoBelle.deleteMany({ where: { unidadeId, belleMovId: `TESTE-${leaks[0].id}` } })
}

console.log('\n✔ E2E concluído.')
process.exit(0)
