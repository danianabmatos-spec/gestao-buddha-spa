import { prisma } from '@/lib/prisma'
import { FUNCIONALIDADES, PERFIS_SISTEMA, GRUPOS, type Nivel } from './catalogo'

// ─── Store das permissões (tabelas Perfil + PerfilPermissao via SQL cru) ──────────

// Garante os perfis de sistema e a matriz-PADRÃO no banco. Idempotente:
// - não sobrescreve edições já feitas (INSERT OR IGNORE);
// - funcionalidades NOVAS (adicionadas ao catálogo) ganham o padrão na próxima chamada.
export async function garantirSeed(): Promise<void> {
  for (const perfil of PERFIS_SISTEMA) {
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "Perfil" ("chave","nome","descricao","sistema","superadmin") VALUES (?,?,?,1,?)`,
      perfil.chave, perfil.nome, perfil.descricao, perfil.superadmin ? 1 : 0,
    )
  }
  for (const f of FUNCIONALIDADES) {
    for (const perfil of PERFIS_SISTEMA) {
      const nivel = f.padrao[perfil.chave] ?? 'NENHUM'
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "PerfilPermissao" ("perfilChave","funcionalidadeChave","nivel") VALUES (?,?,?)`,
        perfil.chave, f.chave, nivel,
      )
    }
  }
}

export interface PerfilRow { chave: string; nome: string; descricao: string; sistema: number; superadmin: number; ativo: number }

// Matriz completa para a tela de gestão: perfis, funcionalidades (agrupadas) e níveis atuais.
export async function getMatriz() {
  await garantirSeed()
  const perfis = await prisma.$queryRawUnsafe<PerfilRow[]>(
    `SELECT "chave","nome","descricao","sistema","superadmin","ativo" FROM "Perfil" WHERE "ativo"=1 ORDER BY "sistema" DESC, "nome"`,
  )
  const perms = await prisma.$queryRawUnsafe<{ perfilChave: string; funcionalidadeChave: string; nivel: string }[]>(
    `SELECT "perfilChave","funcionalidadeChave","nivel" FROM "PerfilPermissao"`,
  )
  // niveis[perfilChave][funcChave] = nivel
  const niveis: Record<string, Record<string, Nivel>> = {}
  for (const r of perms) {
    (niveis[r.perfilChave] ??= {})[r.funcionalidadeChave] = r.nivel as Nivel
  }
  // superadmin sempre EDITAR (mesmo que a linha diga outra coisa)
  for (const perfil of perfis) {
    if (perfil.superadmin) {
      niveis[perfil.chave] ??= {}
      for (const f of FUNCIONALIDADES) niveis[perfil.chave][f.chave] = 'EDITAR'
    }
  }
  return {
    grupos: GRUPOS,
    funcionalidades: FUNCIONALIDADES.map(f => ({ chave: f.chave, label: f.label, grupo: f.grupo })),
    perfis: perfis.map(pr => ({ chave: pr.chave, nome: pr.nome, descricao: pr.descricao, sistema: !!pr.sistema, superadmin: !!pr.superadmin })),
    niveis,
  }
}

// Nível efetivo de um perfil numa funcionalidade (fail-closed = NENHUM se não definido).
// Superadmin (DONA) → sempre EDITAR. Usado no enforcement (Fases seguintes).
export async function getNivel(perfilChave: string, funcionalidadeChave: string): Promise<Nivel> {
  const su = PERFIS_SISTEMA.find(p => p.chave === perfilChave)?.superadmin
  if (su) return 'EDITAR'
  const rows = await prisma.$queryRawUnsafe<{ nivel: string }[]>(
    `SELECT "nivel" FROM "PerfilPermissao" WHERE "perfilChave"=? AND "funcionalidadeChave"=? LIMIT 1`,
    perfilChave, funcionalidadeChave,
  )
  return (rows?.[0]?.nivel as Nivel) ?? 'NENHUM'
}
