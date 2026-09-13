import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Unidade Shopping Metrópole
  const metropole = await prisma.unidade.upsert({
    where: { slug: 'shopping-metropole' },
    update: {},
    create: {
      nome: 'Shopping Metrópole',
      slug: 'shopping-metropole',
      belleEmail: process.env.BELLE_METROPOLE_EMAIL ?? '',
      bellePassword: process.env.BELLE_METROPOLE_PASSWORD ?? '',
      belleEstabId: 1,
      ativa: true,
    },
  })

  // Usuário admin padrão
  await prisma.usuario.upsert({
    where: { email: 'daniana@buddhaspa.com.br' },
    update: {},
    create: {
      nome: 'Daniana Matos',
      email: 'daniana@buddhaspa.com.br',
      senha: 'trocar_na_primeira_entrada',
      perfil: 'ADMINISTRADOR',
      unidadeId: metropole.id,
    },
  })

  // Metas padrão Shopping Metrópole (seg=1 a sab=6)
  const metasPadrao = [
    { diaSemana: 1, metaReceita: 2000, metaAtend: 15 }, // Segunda
    { diaSemana: 2, metaReceita: 2000, metaAtend: 15 }, // Terça
    { diaSemana: 3, metaReceita: 2500, metaAtend: 18 }, // Quarta
    { diaSemana: 4, metaReceita: 2500, metaAtend: 18 }, // Quinta
    { diaSemana: 5, metaReceita: 3000, metaAtend: 22 }, // Sexta
    { diaSemana: 6, metaReceita: 3500, metaAtend: 25 }, // Sábado
  ]

  for (const meta of metasPadrao) {
    await prisma.metaDiaria.upsert({
      where: {
        id: meta.diaSemana,
      },
      update: meta,
      create: { ...meta, unidadeId: metropole.id },
    })
  }

  // Meta mensal Shopping Metrópole — Junho 2026
  // Prêmios: a preencher após confirmação da Daniana
  await prisma.metaMensal.upsert({
    where: { unidadeId_ano_mes: { unidadeId: metropole.id, ano: 2026, mes: 6 } },
    update: {},
    create: {
      unidadeId: metropole.id,
      ano: 2026,
      mes: 6,
      metaFaturamento: 90000,
      metaHoras: 600,
      metaVendas: 60000,
      premioFaturamento: 0, // a definir
      premioHoras: 0,       // a definir
      premioVendas: 0,      // a definir
    },
  })

  console.log('Seed concluído: Shopping Metrópole configurada.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
