// Teste direto da tabela ClienteScore
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PrismaClient } = require('../src/generated/prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const { createClient } = require('@libsql/client')

const url = 'file:///C:/Users/MADISHAR/gestao-buddha-spa/prisma/dev.db'
const libsql = createClient({ url })
const adapter = new PrismaLibSql(libsql)
const prisma = new PrismaClient({ adapter })

try {
  console.log('Testando clienteScore.findMany()...')
  const scores = await prisma.clienteScore.findMany({ take: 5 })
  console.log('✅ OK! Registros:', scores.length)

  console.log('Testando voucherCache.findMany()...')
  const vouchers = await prisma.voucherCache.findMany({ take: 5 })
  console.log('✅ OK! Registros:', vouchers.length)
} catch (err) {
  console.error('❌ Erro:', err.code, err.message, err.meta)
} finally {
  await prisma.$disconnect()
}
