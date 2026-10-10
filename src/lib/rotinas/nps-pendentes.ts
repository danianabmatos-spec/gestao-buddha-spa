import { prisma } from '@/lib/prisma'

/** "YYYY-MM" do mês corrente (local). */
export function mesRefAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Conta os casos de NPS (detratores/neutros) do mês SEM tratativa e grava no cache
 * NpsPendentesCache (base do badge do menu lateral). `chavesCasos` = chaveCaso de cada
 * caso do mês (idAtendimento || `${cliente}|${data}`). Retorna o nº de pendentes.
 */
export async function atualizarNpsPendentes(unidadeId: number, mesRef: string, chavesCasos: string[]): Promise<number> {
  const total = chavesCasos.length
  let pendentes = 0
  if (total > 0) {
    const tratadas = await prisma.tratativaNps.findMany({
      where: { unidadeId, chaveCaso: { in: chavesCasos } },
      select: { chaveCaso: true },
    })
    const tratadasSet = new Set(tratadas.map((t) => t.chaveCaso))
    pendentes = chavesCasos.filter((c) => !tratadasSet.has(c)).length
  }
  await prisma.npsPendentesCache.upsert({
    where: { unidadeId_mesRef: { unidadeId, mesRef } },
    create: { unidadeId, mesRef, pendentes, totalMes: total },
    update: { pendentes, totalMes: total },
  })
  return pendentes
}
