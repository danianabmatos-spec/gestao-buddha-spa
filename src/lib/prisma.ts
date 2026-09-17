// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../generated/prisma/client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaLibSql } = require('@prisma/adapter-libsql')
import path from 'path'

import type { PrismaClient as PrismaClientType } from '../generated/prisma/client'

function getDbUrl(): string {
  // Se DATABASE_URL for uma URL de arquivo SQLite, usa ela
  const envUrl = process.env.DATABASE_URL
  if (envUrl && envUrl.startsWith('file:')) return envUrl
  // Fallback: dev.db na raiz do projeto (funciona em dev local e em produção)
  return `file://${path.join(process.cwd(), 'dev.db')}`
}

function createPrisma(): PrismaClientType {
  // PrismaLibSql espera o config { url }, não um client já criado
  const adapter = new PrismaLibSql({ url: getDbUrl() })
  const client = new PrismaClient({ adapter })
  // WAL: leituras não bloqueiam escritas (evita "database is locked"/travamento sob
  // concorrência). busy_timeout: espera o lock em vez de falhar na hora. Idempotente
  // e persistente no arquivo — self-healing se o banco for recriado.
  client.$executeRawUnsafe('PRAGMA journal_mode=WAL').catch(() => {})
  client.$executeRawUnsafe('PRAGMA busy_timeout=5000').catch(() => {})
  return client
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType }
export const prisma: PrismaClientType = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
