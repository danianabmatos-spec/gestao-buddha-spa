// E2E F3 — justificativa da equipe preserva-se ao reprocessar. npx tsx scripts/testar-f3-justificativa.mts
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { conciliarAtendimentosDia, aplicarRegraColaborador } = await import('@/lib/conciliacao/motor-atendimentos')
const { prisma } = await import('@/lib/prisma')

const unidadeId = (await prisma.unidade.findUnique({ where: { slug: 'shopping-metropole' } }))!.id

// pega uma divergência de atendimento aberta (cortesia/desconto)
const div = await prisma.divergencia.findFirst({
  where: { unidadeId, tipo: { in: ['CORTESIA', 'DESCONTO', 'ATENDIMENTO_SEM_JUSTIFICATIVA'] }, status: { in: ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA'] } },
})
if (!div) { console.log('Sem divergência de atendimento aberta para testar.'); process.exit(0) }
console.log(`Divergência #${div.id} (${div.tipo}) status=${div.status} data=${div.data}`)

// 1) equipe justifica (o que a rota faz com acao=justificar)
await prisma.divergencia.update({ where: { id: div.id }, data: { status: 'JUSTIFICADA', justificativa: 'Cortesia autorizada pela gerência (teste)', tratadaPorNome: 'Teste' } })
console.log('→ justificada pela equipe (JUSTIFICADA)')

// 2) motor roda de novo (reprocessar / próxima sincronização) — NÃO pode reabrir
await conciliarAtendimentosDia(unidadeId, div.data)
await aplicarRegraColaborador(unidadeId, div.data.slice(0, 7))
const depois = await prisma.divergencia.findUnique({ where: { id: div.id } })
console.log(`→ após reprocessar: status=${depois?.status} ${depois?.status === 'JUSTIFICADA' ? '✅ preservada' : '❌ REABRIU (bug)'}`)
console.log(`   justificativa mantida: "${depois?.justificativa}" por ${depois?.tratadaPorNome}`)

// restaura estado (reabre p/ não deixar dado de teste "justificado")
await prisma.divergencia.update({ where: { id: div.id }, data: { status: 'ABERTA', justificativa: null, tratadaPorNome: null } })
console.log('(estado restaurado)')
process.exit(0)
