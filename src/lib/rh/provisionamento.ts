import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { hashSenha } from '@/lib/auth/password'
import { escopoDoPerfil } from '@/lib/auth/guard'
import { PERFIS_SISTEMA } from '@/lib/permissoes/catalogo'
import { getColaboradoresRHParaAcesso, normalizarEmail } from './acessos'
import { getMapaCargoPerfil } from './cargo-perfil'

// ─── Provisionamento de acessos a partir do RH (Etapa 2) ─────────────────────────
// Para cada colaborador ATIVO do RH SEM conta no ERP, cria o Usuario com o perfil
// mapeado do cargo (cargo "sem acesso" → ignora), a unidade do RH e uma SENHA
// TEMPORÁRIA (primeirAcesso=true força a troca no 1º login). Modo seguro: dryRun
// mostra o plano sem gravar. Só perfis de SISTEMA são criados automaticamente —
// perfis personalizados (ex.: Marketing/CEO) precisam do escopo por perfil (ainda
// não suportado no login) e são sinalizados p/ criação manual.

const SISTEMA = new Set(PERFIS_SISTEMA.map((p) => p.chave))
const PERFIL_NOME = Object.fromEntries(PERFIS_SISTEMA.map((p) => [p.chave, p.nome]))

function normNome(s: string): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
function senhaTemp(): string {
  const alfa = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem ambíguos
  let s = ''
  for (let i = 0; i < 10; i++) s += alfa[crypto.randomInt(alfa.length)]
  return s
}

export interface PlanoAcesso {
  email: string; nome: string; cargo: string; perfilChave: string; perfilNome: string
  escopo: 'total' | 'coord' | 'unidade'
  unidadeSlugs: string[]
  senhaTemp?: string // preenchida só no commit
}
export interface IgnoradoAcesso { email: string; nome: string; cargo: string; motivo: string }
export interface ResultadoProvisionamento {
  rhIndisponivel: boolean; dryRun: boolean
  criar: PlanoAcesso[]
  ignorados: IgnoradoAcesso[]
  criados: number
}

export async function sincronizarProvisionamento(
  opts: { dryRun?: boolean; atorId?: string } = {},
): Promise<ResultadoProvisionamento> {
  const dryRun = opts.dryRun === true
  const colaboradores = await getColaboradoresRHParaAcesso()
  if (!colaboradores) return { rhIndisponivel: true, dryRun, criar: [], ignorados: [], criados: 0 }

  const [usuarios, unidades, mapa] = await Promise.all([
    prisma.usuario.findMany({ select: { email: true } }),
    prisma.unidade.findMany({ where: { ativa: true }, select: { id: true, slug: true, nome: true } }),
    getMapaCargoPerfil(),
  ])
  const existentes = new Set(usuarios.map((u) => normalizarEmail(u.email)))
  const nomeParaUnidade = new Map(unidades.map((u) => [normNome(u.nome), u]))
  const slugParaId = new Map(unidades.map((u) => [u.slug, u.id]))

  const criar: PlanoAcesso[] = []
  const ignorados: IgnoradoAcesso[] = []
  const vistos = new Set<string>() // evita duplicar e-mail dentro do mesmo lote

  for (const c of colaboradores) {
    if (existentes.has(c.email) || vistos.has(c.email)) continue
    vistos.add(c.email)
    const perfilChave = mapa[c.cargo]
    if (!perfilChave) { ignorados.push({ email: c.email, nome: c.nome, cargo: c.cargo, motivo: 'cargo sem perfil (sem acesso)' }); continue }
    if (!SISTEMA.has(perfilChave)) { ignorados.push({ email: c.email, nome: c.nome, cargo: c.cargo, motivo: 'perfil personalizado — criar manualmente' }); continue }
    const escopo = escopoDoPerfil(perfilChave)
    let unidadeSlugs: string[] = []
    if (escopo !== 'total') {
      const resolvidas = c.unidades
        .map((n) => nomeParaUnidade.get(normNome(n)))
        .filter((u): u is { id: number; slug: string; nome: string } => !!u)
      if (!resolvidas.length) { ignorados.push({ email: c.email, nome: c.nome, cargo: c.cargo, motivo: 'sem unidade compatível no RH' }); continue }
      unidadeSlugs = escopo === 'unidade' ? [resolvidas[0].slug] : resolvidas.map((r) => r.slug)
    }
    criar.push({ email: c.email, nome: c.nome, cargo: c.cargo, perfilChave, perfilNome: PERFIL_NOME[perfilChave] || perfilChave, escopo, unidadeSlugs })
  }

  if (dryRun) return { rhIndisponivel: false, dryRun: true, criar, ignorados, criados: 0 }

  // COMMIT — cria cada acesso (falha isolada não aborta o lote).
  let criados = 0
  for (const plano of criar) {
    try {
      const senha = senhaTemp()
      const hash = await hashSenha(senha)
      const unidadeId = plano.escopo === 'unidade' ? (slugParaId.get(plano.unidadeSlugs[0]) ?? null) : null
      const novo = await prisma.usuario.create({
        data: { nome: plano.nome, email: plano.email, senha: hash, perfil: plano.perfilChave, unidadeId, ativo: true, primeirAcesso: true },
        select: { id: true },
      })
      if (plano.escopo === 'coord') {
        const ids = plano.unidadeSlugs.map((s) => slugParaId.get(s)).filter((x): x is number => !!x)
        if (ids.length) await prisma.usuarioUnidade.createMany({ data: ids.map((uid) => ({ usuarioId: novo.id, unidadeId: uid })) })
      }
      plano.senhaTemp = senha
      criados++
      await prisma.logAuditoria.create({
        data: { usuarioId: opts.atorId || novo.id, acao: 'ACESSO_RH_CRIAR', entidade: 'Usuario', dados: JSON.stringify({ email: plano.email, nome: plano.nome, perfil: plano.perfilChave, unidades: plano.unidadeSlugs }).slice(0, 2000) },
      }).catch(() => {})
    } catch (e) {
      ignorados.push({ email: plano.email, nome: plano.nome, cargo: plano.cargo, motivo: 'erro ao criar (e-mail já em uso?)' })
    }
  }
  return { rhIndisponivel: false, dryRun: false, criar: criar.filter((p) => p.senhaTemp), ignorados, criados }
}
