// Camada de leitura do módulo NF Salão Parceiro (server-side).
// Lê a competência persistida (NfSalaoMes + NfSalaoTerapeuta) e devolve já no formato
// que a tela consome. Piloto: Anália Franco (unidadeId 2).
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/nf-salao/motor";

export const UNIDADE_PILOTO = 2; // Anália Franco / Sol Central

export interface TerapeutaLinha {
  id: number;
  terapeutaNome: string;
  cnpjMei: string;
  comissao: number;
  diasCredito: number;
  valorTerapeuta: number;
  pct: number;
  valorNota: number;
  baseCalculo: number;
  rps: number | null;
  nfSalaoNumero: string | null;
  nfComissaoNumero: string | null;
  nfCreditoNumero: string | null;
  discriminacao: string;
  status: string;
}

export interface CompetenciaResumo {
  existe: boolean;
  unidadeId: number;
  ano: number;
  mes: number;
  status: string;
  aliquotaIss: number;
  aliquotaTributos: number;
  base: {
    faturamentoCaixa: number;
    reembolsoVoucher: number;
    reembolsoGympass: number;
    reembolsoTotalpass: number;
    notasAvulsas: number;
    valorBase: number;
    faturamentoFonte: string | null;
    reembolsoFonte: string | null;
  };
  terapeutas: TerapeutaLinha[];
  totais: {
    comissao: number;
    diasCredito: number;
    somaTerapeutas: number; // ΣP
    somaNotas: number; // ΣM
    somaBaseCalculo: number; // ΣO
    difBase: number; // ΣM − base
  };
  proximoRps: number | null;
}

/** Meses (ano/mes) que já têm competência lançada — pro seletor da tela. */
export async function listarCompetencias(
  unidadeId = UNIDADE_PILOTO,
): Promise<{ ano: number; mes: number; status: string }[]> {
  const rows = await prisma.nfSalaoMes.findMany({
    where: { unidadeId },
    orderBy: [{ ano: "desc" }, { mes: "desc" }],
    select: { ano: true, mes: true, status: true },
  });
  return rows;
}

export async function getCompetencia(
  ano: number,
  mes: number,
  unidadeId = UNIDADE_PILOTO,
): Promise<CompetenciaResumo> {
  const [mesRow, seq] = await Promise.all([
    prisma.nfSalaoMes.findUnique({
      where: { unidadeId_ano_mes: { unidadeId, ano, mes } },
    }),
    prisma.rpsSequencia.findUnique({ where: { unidadeId } }),
  ]);

  const base = {
    faturamentoCaixa: mesRow?.faturamentoCaixa ?? 0,
    reembolsoVoucher: mesRow?.reembolsoVoucher ?? 0,
    reembolsoGympass: mesRow?.reembolsoGympass ?? 0,
    reembolsoTotalpass: mesRow?.reembolsoTotalpass ?? 0,
    notasAvulsas: mesRow?.notasAvulsas ?? 0,
    valorBase: mesRow?.valorBase ?? 0,
    faturamentoFonte: mesRow?.faturamentoFonte ?? null,
    reembolsoFonte: mesRow?.reembolsoFonte ?? null,
  };

  const terapeutas: TerapeutaLinha[] = mesRow
    ? (
        await prisma.nfSalaoTerapeuta.findMany({
          where: { nfSalaoMesId: mesRow.id },
          orderBy: { terapeutaNome: "asc" },
        })
      ).map((t) => ({
        id: t.id,
        terapeutaNome: t.terapeutaNome,
        cnpjMei: t.cnpjMei,
        comissao: t.comissao,
        diasCredito: t.diasCredito,
        valorTerapeuta: t.valorTerapeuta,
        pct: t.pct,
        valorNota: t.valorNota,
        baseCalculo: t.baseCalculo,
        rps: t.rps,
        nfSalaoNumero: t.nfSalaoNumero,
        nfComissaoNumero: t.nfComissaoNumero,
        nfCreditoNumero: t.nfCreditoNumero,
        discriminacao: t.discriminacao,
        status: t.status,
      }))
    : [];

  const somaNotas = round2(terapeutas.reduce((s, t) => s + t.valorNota, 0));
  const totais = {
    comissao: round2(terapeutas.reduce((s, t) => s + t.comissao, 0)),
    diasCredito: round2(terapeutas.reduce((s, t) => s + t.diasCredito, 0)),
    somaTerapeutas: round2(terapeutas.reduce((s, t) => s + t.valorTerapeuta, 0)),
    somaNotas,
    somaBaseCalculo: round2(terapeutas.reduce((s, t) => s + t.baseCalculo, 0)),
    difBase: round2(somaNotas - base.valorBase),
  };

  return {
    existe: !!mesRow,
    unidadeId,
    ano,
    mes,
    status: mesRow?.status ?? "ABERTO",
    aliquotaIss: mesRow?.aliquotaIss ?? 0,
    aliquotaTributos: mesRow?.aliquotaTributos ?? 0,
    base,
    terapeutas,
    totais,
    proximoRps: seq?.proximoRps ?? null,
  };
}
