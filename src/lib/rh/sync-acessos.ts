import { prisma } from '@/lib/prisma'
import { getStatusEmailsRH, normalizarEmail } from './acessos'

// ─── Desprovisionamento de acessos a partir do RH (Etapa 1) ──────────────────────
// Desativa (ativo=false, NÃO apaga) os usuários do ERP cujo e-mail casa com um
// colaborador DESLIGADO no RH. Nunca toca em:
//   - usuários DONA (proteção contra lockout do administrador);
//   - usuários sem correspondência no RH (contas manuais).
// Fail-safe: se o RH estiver indisponível, não desativa ninguém.

export interface AlvoDesativacao { id: string; nome: string; email: string; perfil: string }
export interface ResultadoSync {
  rhIndisponivel: boolean
  dryRun: boolean
  alvos: AlvoDesativacao[]  // quem foi (ou seria) desativado
  desativados: number
  protegidos: number        // DONA que casaram com desligado mas foram poupados
}

export async function sincronizarDesligamentosRH(
  opts: { dryRun?: boolean; atorId?: string } = {},
): Promise<ResultadoSync> {
  const dryRun = opts.dryRun === true
  const status = await getStatusEmailsRH()
  if (!status) {
    return { rhIndisponivel: true, dryRun, alvos: [], desativados: 0, protegidos: 0 }
  }

  const ativos = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, email: true, perfil: true },
  })

  const alvos: AlvoDesativacao[] = []
  let protegidos = 0
  for (const u of ativos) {
    const email = normalizarEmail(u.email)
    if (!email || !status.desligados.has(email)) continue // sem match ou ativo no RH → mantém
    if (u.perfil === 'DONA') { protegidos++; continue }    // nunca desativa a Dona
    alvos.push({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil })
  }

  if (dryRun) {
    return { rhIndisponivel: false, dryRun: true, alvos, desativados: 0, protegidos }
  }

  for (const a of alvos) {
    await prisma.usuario.update({ where: { id: a.id }, data: { ativo: false } })
    await prisma.logAuditoria.create({
      data: {
        usuarioId: opts.atorId || a.id,
        acao: 'ACESSO_RH_DESATIVAR',
        entidade: 'Usuario',
        dados: JSON.stringify({ alvoId: a.id, nome: a.nome, email: a.email, motivo: 'desligado no RH' }).slice(0, 2000),
      },
    }).catch(() => {})
  }
  if (opts.atorId) {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: opts.atorId,
        acao: 'RH_SYNC_ACESSOS',
        entidade: 'Usuario',
        dados: JSON.stringify({ desativados: alvos.length, protegidos }).slice(0, 2000),
      },
    }).catch(() => {})
  }

  return { rhIndisponivel: false, dryRun: false, alvos, desativados: alvos.length, protegidos }
}

// Última sincronização registrada (para exibir na tela).
export async function ultimaSyncRH(): Promise<{ quando: Date; quem: string; desativados: number } | null> {
  const log = await prisma.logAuditoria.findFirst({
    where: { acao: 'RH_SYNC_ACESSOS' },
    orderBy: { createdAt: 'desc' },
    include: { usuario: { select: { nome: true } } },
  })
  if (!log) return null
  let desativados = 0
  try { desativados = Number(JSON.parse(log.dados || '{}').desativados) || 0 } catch {}
  return { quando: log.createdAt, quem: log.usuario?.nome || log.usuarioId, desativados }
}
