import { prisma } from '@/lib/prisma'

// ─── Mapa CARGO (do RH) → PERFIL (do ERP) ────────────────────────────────────────
// Define, para cada cargo do RH, qual perfil o colaborador recebe ao ser provisionado
// (Etapa 2). Fail-closed: cargo SEM mapeamento (ou mapeado para '') = SEM acesso.
// perfilChave '' significa explicitamente "sem acesso". Tabela criada on-the-fly
// (via SQL cru), fora do schema.prisma — mesmo padrão do store de permissões.

async function garantir(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "CargoPerfilMapa" (
       "cargo" TEXT NOT NULL PRIMARY KEY,
       "perfilChave" TEXT NOT NULL DEFAULT '',
       "atualizadoEm" DATETIME NOT NULL DEFAULT (datetime('now'))
     )`,
  )
}

// Mapa completo { cargo: perfilChave } — só cargos com perfil definido (não-vazio).
export async function getMapaCargoPerfil(): Promise<Record<string, string>> {
  await garantir()
  const rows = await prisma.$queryRawUnsafe<{ cargo: string; perfilChave: string }[]>(
    `SELECT "cargo","perfilChave" FROM "CargoPerfilMapa"`,
  )
  const mapa: Record<string, string> = {}
  for (const r of rows) if (r.perfilChave) mapa[r.cargo] = r.perfilChave
  return mapa
}

// Define (ou limpa, com perfilChave='') o perfil de um cargo.
export async function salvarCargoPerfil(cargo: string, perfilChave: string): Promise<void> {
  await garantir()
  const c = String(cargo || '').trim()
  if (!c) throw new Error('Cargo inválido')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CargoPerfilMapa" ("cargo","perfilChave","atualizadoEm") VALUES (?,?,datetime('now'))
     ON CONFLICT("cargo") DO UPDATE SET "perfilChave"=excluded."perfilChave", "atualizadoEm"=excluded."atualizadoEm"`,
    c, String(perfilChave || ''),
  )
}

// Perfil de um cargo para o provisionamento (Etapa 2). null = sem acesso (fail-closed).
export async function getPerfilDoCargo(cargo: string): Promise<string | null> {
  await garantir()
  const rows = await prisma.$queryRawUnsafe<{ perfilChave: string }[]>(
    `SELECT "perfilChave" FROM "CargoPerfilMapa" WHERE "cargo"=? LIMIT 1`,
    String(cargo || '').trim(),
  )
  const v = rows?.[0]?.perfilChave
  return v ? v : null
}
