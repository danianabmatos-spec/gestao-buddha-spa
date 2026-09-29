// E2E F2d — regra de cortesia de colaborador. Uso: npx tsx scripts/testar-f2d-colaborador.mts
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const slug = 'shopping-metropole', ini = '2026-09-01', fim = '2026-09-19', MES = '2026-09'

const { ingerirMovimentacoes } = await import('@/lib/conciliacao/ingestao-belle')
const { ingerirAtendimentos } = await import('@/lib/conciliacao/ingestao-atendimentos')
const { aplicarRegraColaborador } = await import('@/lib/conciliacao/motor-atendimentos')
const { normalizarNome } = await import('@/lib/conciliacao/roster-colaboradores')
const { prisma } = await import('@/lib/prisma')

const unidadeId = (await prisma.unidade.findUnique({ where: { slug } }))!.id

console.log('Preparando estado (ingestão P1 + P2, roster real vazio)...')
await ingerirMovimentacoes(slug, ini, fim)
await ingerirAtendimentos(slug, ini, fim)

const divAntes = await prisma.divergencia.count({ where: { unidadeId, tipo: { in: ['ATENDIMENTO_SEM_JUSTIFICATIVA','CORTESIA','DESCONTO'] }, status: { in: ['ABERTA','EM_TRATAMENTO','REPROCESSADA'] } } })
const cortesias = await prisma.atendimentoConc.findMany({ where: { unidadeId, data: { startsWith: MES }, classificacao: 'CORTESIA' } })
console.log(`\nCortesias no mês: ${cortesias.length} → ${JSON.stringify(cortesias.map(c => `${c.clienteNome.trim()} (${c.tempo}min)`))}`)
console.log(`Divergências abertas ANTES da regra: ${divAntes}`)

// Injeta os clientes das cortesias como colaboradores (simula o roster do RH).
const roster = new Map<string, any>()
for (const c of cortesias) roster.set(normalizarNome(c.clienteNome), { nome: c.clienteNome, cpf: null, tipoContrato: 'CLT', nivel: null })

console.log('\n>>> Aplicando regra de colaborador com esses nomes no roster...')
const r1 = await aplicarRegraColaborador(unidadeId, MES, roster)
console.log(`   resultado: colaboradores=${r1.colaborador} válidas=${r1.validas} abusos=${r1.abusos}`)

const depois = await prisma.atendimentoConc.findMany({ where: { unidadeId, data: { startsWith: MES }, classificacao: { in: ['CORTESIA','CORTESIA_COLABORADOR'] } } })
console.log('   classificação agora:', JSON.stringify(depois.map(c => `${c.clienteNome.trim()}:${c.classificacao}${c.justificado ? '✓' : '⚠'}`)))
const divDepois = await prisma.divergencia.count({ where: { unidadeId, tipo: { in: ['ATENDIMENTO_SEM_JUSTIFICATIVA','CORTESIA','DESCONTO'] }, status: { in: ['ABERTA','EM_TRATAMENTO','REPROCESSADA'] } } })
console.log(`   divergências abertas DEPOIS: ${divDepois} (esperado: ${divAntes - r1.validas}, pois ${r1.validas} cortesias válidas fecharam)`)

// --- teste de ABUSO: injeta 2ª cortesia no mês pro mesmo colaborador ---
const alvo = cortesias[0]
if (alvo) {
  console.log(`\n>>> Teste de abuso: 2ª cortesia no mês para ${alvo.clienteNome.trim()}...`)
  await prisma.atendimentoConc.create({ data: {
    unidadeId, belleAtendId: `TESTE-ABUSO-${alvo.id}`, data: '2026-09-25', clienteNome: alvo.clienteNome,
    clienteId: alvo.clienteId, servico: 'Relaxante 60 (teste)', tempo: 60, statusAtend: 'Atendido',
    valorBruto: 228, covCortesia: 228, classificacao: 'CORTESIA', justificado: false, origemDesconto: 'Uso de promocao: Cortesia',
  } })
  const r2 = await aplicarRegraColaborador(unidadeId, MES, roster)
  const doAlvo = await prisma.atendimentoConc.findMany({ where: { unidadeId, clienteId: alvo.clienteId, data: { startsWith: MES }, classificacao: 'CORTESIA_COLABORADOR' }, orderBy: [{ data: 'asc' }] })
  console.log(`   ${alvo.clienteNome.trim()}: ${JSON.stringify(doAlvo.map(c => `${c.data} ${c.justificado ? 'VÁLIDA✓' : 'ABUSO⚠'}`))}`)
  console.log(`   abusos detectados: ${r2.abusos} ${r2.abusos >= 1 ? '✅' : '❌'}`)
  // limpa o registro de teste
  await prisma.atendimentoConc.deleteMany({ where: { unidadeId, belleAtendId: `TESTE-ABUSO-${alvo.id}` } })
  // reverte o alvo pra estado limpo do mês
  await aplicarRegraColaborador(unidadeId, MES, roster)
}

console.log('\n✔ F2d testado.')
process.exit(0)
