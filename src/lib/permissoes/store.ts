import { prisma } from '@/lib/prisma'
import { FUNCIONALIDADES, PERFIS_SISTEMA, GRUPOS, NIVEIS, type Nivel } from './catalogo'

// ─── Store das permissões (tabelas Perfil + PerfilPermissao via SQL cru) ──────────

const FUNC_VALIDAS = new Set(FUNCIONALIDADES.map(f => f.chave))
const NIVEL_VALIDO = new Set<string>(NIVEIS)

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
  const niveis: Record<string, Record<string, Nivel>> = {}
  for (const r of perms) {
    (niveis[r.perfilChave] ??= {})[r.funcionalidadeChave] = r.nivel as Nivel
  }
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

// Mapa completo { funcionalidade: nível } de um perfil (fail-closed = NENHUM).
// Superadmin (DONA) → tudo EDITAR. Usado pela UI (esconder/read-only) e pelo enforcement.
export async function getPermissoesDoPerfil(perfilChave: string): Promise<Record<string, Nivel>> {
  await garantirSeed()
  const map: Record<string, Nivel> = {}
  const su = PERFIS_SISTEMA.find(p => p.chave === perfilChave)?.superadmin
  if (su) { for (const f of FUNCIONALIDADES) map[f.chave] = 'EDITAR'; return map }
  for (const f of FUNCIONALIDADES) map[f.chave] = 'NENHUM' // padrão fail-closed
  const rows = await prisma.$queryRawUnsafe<{ funcionalidadeChave: string; nivel: string }[]>(
    `SELECT "funcionalidadeChave","nivel" FROM "PerfilPermissao" WHERE "perfilChave"=?`, perfilChave,
  )
  for (const r of rows) if (FUNC_VALIDAS.has(r.funcionalidadeChave)) map[r.funcionalidadeChave] = r.nivel as Nivel
  return map
}

async function existePerfil(chave: string): Promise<PerfilRow | null> {
  const rows = await prisma.$queryRawUnsafe<PerfilRow[]>(`SELECT * FROM "Perfil" WHERE "chave"=? LIMIT 1`, chave)
  return rows?.[0] ?? null
}

// Salva os níveis de UM perfil (mapa funcionalidade→nível). Ignora funcionalidades/níveis
// inválidos. Não permite mexer em superadmin (DONA é sempre total).
export async function salvarNiveis(perfilChave: string, niveis: Record<string, string>): Promise<void> {
  const perfil = await existePerfil(perfilChave)
  if (!perfil) throw new Error('Perfil não encontrado')
  if (perfil.superadmin) throw new Error('O perfil DONA tem acesso total e não é editável')
  for (const [func, nivel] of Object.entries(niveis)) {
    if (!FUNC_VALIDAS.has(func) || !NIVEL_VALIDO.has(nivel)) continue
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PerfilPermissao" ("perfilChave","funcionalidadeChave","nivel","atualizadoEm")
       VALUES (?,?,?,datetime('now'))
       ON CONFLICT("perfilChave","funcionalidadeChave") DO UPDATE SET "nivel"=excluded."nivel", "atualizadoEm"=excluded."atualizadoEm"`,
      perfilChave, func, nivel,
    )
  }
}

// Cria um perfil customizado, copiando os níveis de um perfil-base (opcional).
export async function criarPerfil(nome: string, descricao: string, copiarDe?: string): Promise<string> {
  const chave = 'p_' + nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  if (!chave) throw new Error('Nome inválido')
  if (await existePerfil(chave)) throw new Error('Já existe um perfil com esse nome')
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Perfil" ("chave","nome","descricao","sistema","superadmin") VALUES (?,?,?,0,0)`,
    chave, nome.trim(), (descricao || '').trim(),
  )
  if (copiarDe) {
    const base = await prisma.$queryRawUnsafe<{ funcionalidadeChave: string; nivel: string }[]>(
      `SELECT "funcionalidadeChave","nivel" FROM "PerfilPermissao" WHERE "perfilChave"=?`, copiarDe,
    )
    for (const r of base) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "PerfilPermissao" ("perfilChave","funcionalidadeChave","nivel") VALUES (?,?,?)`,
        chave, r.funcionalidadeChave, r.nivel,
      )
    }
  }
  return chave
}

// Renomeia / redescreve um perfil (não muda a chave). Bloqueia superadmin.
export async function editarPerfil(chave: string, nome: string, descricao: string): Promise<void> {
  const perfil = await existePerfil(chave)
  if (!perfil) throw new Error('Perfil não encontrado')
  if (perfil.superadmin) throw new Error('Perfil não editável')
  await prisma.$executeRawUnsafe(
    `UPDATE "Perfil" SET "nome"=?, "descricao"=?, "atualizadoEm"=datetime('now') WHERE "chave"=?`,
    nome.trim(), (descricao || '').trim(), chave,
  )
}

// Desativa um perfil CUSTOM (não de sistema) que não esteja em uso por usuários.
export async function desativarPerfil(chave: string): Promise<void> {
  const perfil = await existePerfil(chave)
  if (!perfil) throw new Error('Perfil não encontrado')
  if (perfil.sistema) throw new Error('Perfis de sistema não podem ser removidos')
  const emUso = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) as n FROM "Usuario" WHERE "perfil"=?`, chave)
  if (Number(emUso?.[0]?.n ?? 0) > 0) throw new Error('Há usuários com este perfil. Reatribua-os antes de remover.')
  await prisma.$executeRawUnsafe(`UPDATE "Perfil" SET "ativo"=0 WHERE "chave"=?`, chave)
}
