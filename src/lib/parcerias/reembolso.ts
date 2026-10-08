// Reembolso de parcerias (TotalPass / Gympass) — fonte única dos valores líquidos.
// Cada ATENDIMENTO do mês (1 por belleMovId, excluindo estornos 'S') vale um valor FLAT
// líquido (já sem royalties+mkt), pago no dia 20 do mês seguinte. A página /parcerias e o
// módulo NF Salão Parceiro consomem daqui, pra não divergir os valores.
import { prisma } from "@/lib/prisma";

export const PARCERIAS = [
  { chave: "totalpass", nome: "TotalPass", forma: "Parcerias Comerciais - TotalPass", bruto: 225, liquido: 207 },
  { chave: "gympass", nome: "Gympass", forma: "Parcerias Comerciais - Gympass", bruto: 86.4, liquido: 79.48 },
] as const;

const cent = (n: number) => Math.round(n * 100) / 100;

/**
 * Valor LÍQUIDO de reembolso de Gympass e TotalPass de uma unidade num mês (por data de
 * confirmação na MovimentacaoBelle). Conta atendimentos distintos × valor líquido flat.
 */
export async function getParceriasReembolso(
  unidadeId: number,
  ano: number,
  mes: number,
): Promise<{ gympass: number; totalpass: number }> {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const out: { gympass: number; totalpass: number } = { gympass: 0, totalpass: 0 };
  for (const p of PARCERIAS) {
    const movs = await prisma.movimentacaoBelle.findMany({
      where: { unidadeId, formaPagamento: p.forma, data: { startsWith: prefixo } },
      select: { belleMovId: true, tipoMovimento: true },
    });
    const ids = new Set<string>();
    for (const m of movs) {
      if ((m.tipoMovimento ?? "E").toUpperCase() === "S") continue; // ignora estorno
      ids.add(m.belleMovId);
    }
    out[p.chave as "gympass" | "totalpass"] = cent(ids.size * p.liquido);
  }
  return out;
}
