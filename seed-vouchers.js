const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const vouchersTeste = [
  {
    codigo: 'VCH-2026-001',
    produto: 'Massagem Relaxante 60min',
    dataTerapia: '2026-06-02',
    dataVenda: '2026-05-28',
    status: 'Validado',
    formaValidacao: 'Automatico',
    valorReembolso: 154,
    unidade: 'Shopping Metrópole'
  },
  {
    codigo: 'VCH-2026-002',
    produto: 'Day Spa Prime Individual',
    dataTerapia: '2026-06-03',
    dataVenda: '2026-05-30',
    status: 'Validado',
    formaValidacao: 'Manualmente',
    valorReembolso: 380,
    unidade: 'Shopping Metrópole'
  },
  {
    codigo: 'VCH-2026-003',
    produto: 'Massagem Relaxante 60min',
    dataTerapia: '2026-06-04',
    dataVenda: '2026-06-01',
    status: 'Pendente',
    formaValidacao: 'Pendente',
    valorReembolso: 154,
    unidade: 'Shopping Metrópole'
  },
  {
    codigo: 'VCH-2026-004',
    produto: 'Massagem Terapêutica 60min',
    dataTerapia: '2026-06-05',
    dataVenda: '2026-06-02',
    status: 'Validado',
    formaValidacao: 'Automatico',
    valorReembolso: 164,
    unidade: 'Shopping Metrópole'
  },
  {
    codigo: 'VCH-2026-005',
    produto: 'Day Spa Prime em Dupla',
    dataTerapia: '2026-06-05',
    dataVenda: '2026-06-03',
    status: 'Validado',
    formaValidacao: 'Automatico',
    valorReembolso: 680,
    unidade: 'Shopping Metrópole'
  },
]

const validados = vouchersTeste.filter(v => v.status === 'Validado')
const pendentes = vouchersTeste.filter(v => v.status === 'Pendente')
const automaticos = validados.filter(v => v.formaValidacao === 'Automatico')
const manuais = validados.filter(v => v.formaValidacao === 'Manualmente')
const totalReembolso = validados.reduce((sum, v) => sum + v.valorReembolso, 0)

async function seed() {
  console.log('🌱 Populando cache de vouchers...')

  await prisma.voucherCache.upsert({
    where: {
      dataIni_dataFim: {
        dataIni: '2026-06-01',
        dataFim: '2026-06-06'
      }
    },
    create: {
      dataIni: '2026-06-01',
      dataFim: '2026-06-06',
      totalReembolso,
      totalValidados: validados.length,
      pendentesValidacao: pendentes.length,
      validacaoManual: manuais.length,
      validacaoAutomatica: automaticos.length,
      vouchers: JSON.stringify(vouchersTeste),
    },
    update: {
      totalReembolso,
      totalValidados: validados.length,
      pendentesValidacao: pendentes.length,
      validacaoManual: manuais.length,
      validacaoAutomatica: automaticos.length,
      vouchers: JSON.stringify(vouchersTeste),
    },
  })

  console.log(`✅ Cache populado!`)
  console.log(`   Total Reembolso: R$ ${totalReembolso.toLocaleString('pt-BR')}`)
  console.log(`   Vouchers Validados: ${validados.length}`)
  console.log(`   Pendentes: ${pendentes.length}`)
  console.log(`   Validação Automática: ${automaticos.length}`)
  console.log(`   Validação Manual: ${manuais.length}`)

  await prisma.$disconnect()
}

seed().catch(console.error)
