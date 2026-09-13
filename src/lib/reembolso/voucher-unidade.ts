import { prisma } from '@/lib/prisma'

// Voucher do site de uma unidade = valor de REEMBOLSO do mês (do módulo de reembolso),
// mapeado pela data do filtro (ano/mês). Mesma fonte usada no Radar Geral.
export async function getVoucherReembolso(slug: string, ano: number, mes: number): Promise<number> {
  try {
    const mesRow = await prisma.reembolsoMes.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true } })
    if (!mesRow) return 0
    const linha = await prisma.reembolsoUnidade.findFirst({
      where: { reembolsoMesId: mesRow.id, unidade: { slug } },
      select: { vouchers: true },
    })
    return linha?.vouchers ?? 0
  } catch (e) {
    console.error('[voucher-unidade] falha ao ler reembolso:', e)
    return 0
  }
}
