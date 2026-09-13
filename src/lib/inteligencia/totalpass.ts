import { prisma } from '../prisma'
import { getUnidadeCredenciais } from '../belle/unidades-config'
import { getClientesTotalPass } from '../belle/movimentacao'
import { getSessoesMesPorCliente } from '../belle/client'

export function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Sincroniza a base TotalPass da unidade: quem usou TotalPass no ano (Report 103)
 * + quantas sessões tem na agenda do mês atual. NÃO sobrescreve os campos manuais
 * (planoCancelado, ultimoContato).
 */
export async function sincronizarTotalPass(unidadeSlug: string): Promise<number> {
  const config = getUnidadeCredenciais(unidadeSlug)
  if (!config) throw new Error(`Unidade não encontrada: ${unidadeSlug}`)

  const [base, sessoes] = await Promise.all([
    getClientesTotalPass(config.email, config.password, String(config.estab)),
    getSessoesMesPorCliente(config.email, config.password, config.estab),
  ])
  const mesRef = mesAtual()

  // Telefone não vem no Report 103 → busca no ClienteScore (por ID ou nome)
  const scores = await prisma.clienteScore.findMany({
    where: { unidadeSlug },
    select: { clienteId: true, nomeCliente: true, telefone: true },
  })
  const telById = new Map<number, string>()
  const telByNome = new Map<string, string>()
  for (const sc of scores) {
    if (!sc.telefone) continue
    if (sc.clienteId != null) telById.set(sc.clienteId, sc.telefone)
    telByNome.set(sc.nomeCliente.toLowerCase(), sc.telefone)
  }

  let salvos = 0
  for (const c of base) {
    const nomeLower = c.nome.trim().toLowerCase()
    const sessoesMes = sessoes.get(nomeLower) ?? 0
    const telefone = (c.clienteId != null ? telById.get(c.clienteId) : undefined) ?? telByNome.get(nomeLower) ?? null

    await prisma.clienteTotalPass.upsert({
      where: { unidadeSlug_nomeCliente: { unidadeSlug, nomeCliente: c.nome } },
      create: {
        unidadeSlug,
        clienteId: c.clienteId,
        nomeCliente: c.nome,
        telefone,
        usosAno: c.usos,
        ultimoUso: c.ultimoUso,
        mesRef,
        sessoesMes,
      },
      update: {
        clienteId: c.clienteId,
        telefone,
        usosAno: c.usos,
        ultimoUso: c.ultimoUso,
        mesRef,
        sessoesMes,
        // planoCancelado e ultimoContato NÃO são tocados (manuais)
      },
    })
    salvos++
  }
  return salvos
}
