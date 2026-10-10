// Parcerias (TotalPass / Gympass) — fonte única. Os valores FLAT (calculado = atendimentos
// × líquido) ficam aqui p/ a página /parcerias mostrar o "Calculado". Já o NF Salão Parceiro
// usa o RECEBIDO DE FATO (conciliação de parcerias, ParceriaConciliacao.recebido) — o que de
// fato caiu na conta, não o calculado.
import { prisma } from "@/lib/prisma";

export const PARCERIAS = [
  { chave: "totalpass", nome: "TotalPass", forma: "Parcerias Comerciais - TotalPass", bruto: 225, liquido: 207 },
  { chave: "gympass", nome: "Gympass", forma: "Parcerias Comerciais - Gympass", bruto: 86.4, liquido: 79.48 },
] as const;

/**
 * Valor RECEBIDO DE FATO de Gympass e TotalPass de uma unidade num mês — da conciliação de
 * parcerias (ParceriaConciliacao.recebido, o que de fato entrou na conta). 0 enquanto não
 * conciliado. É o que o NF Salão Parceiro soma na base.
 */
export async function getParceriasReembolso(
  unidadeId: number,
  ano: number,
  mes: number,
): Promise<{ gympass: number; totalpass: number }> {
  const out: { gympass: number; totalpass: number } = { gympass: 0, totalpass: 0 };
  const conc = await prisma.parceriaConciliacao.findMany({
    where: { unidadeId, ano, mes },
    select: { parceria: true, recebido: true },
  });
  for (const r of conc) {
    if (r.parceria === "gympass") out.gympass = r.recebido ?? 0;
    else if (r.parceria === "totalpass") out.totalpass = r.recebido ?? 0;
  }
  return out;
}
