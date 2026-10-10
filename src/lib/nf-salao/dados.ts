// Camada de leitura do módulo NF Salão Parceiro (server-side).
// Lê a competência persistida (NfSalaoMes + NfSalaoTerapeuta) e devolve já no formato
// que a tela consome. Piloto: Anália Franco (unidadeId 2).
import { prisma } from "@/lib/prisma";
import { round2, fmtBRL } from "@/lib/nf-salao/motor";
import { unidadeUsaRps } from "@/lib/nf-salao/unidades";

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
  codVerificacao: string | null;
  discriminacao: string;
  status: string;
}

export interface Pendencia {
  nivel: "erro" | "aviso";
  codigo: string; // 'aliquota'|'base_zero'|'base_diverge'|'sem_terapeutas'|'cnpj'|'nf_comissao'|'nf_credito'|'rps'
  escopo: "competencia" | "terapeuta";
  terapeutaId?: number;
  terapeutaNome?: string;
  mensagem: string;
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
  pendencias: Pendencia[];
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

export interface EmpresaResumo {
  razaoSocial: string;
  cnpj: string;
  inscricaoMunicipal: string;
  nomeFantasia: string;
}

/** Dados fiscais da empresa vinculada à unidade (cabeçalho da tela). Null se não cadastrada
 *  ou indisponível — resiliente: nunca derruba a competência por causa do cabeçalho. */
export async function getEmpresaDaUnidade(unidadeSlug: string): Promise<EmpresaResumo | null> {
  try {
    const e = await prisma.empresa.findFirst({ where: { unidadeSlug, ativa: true } });
    if (!e) return null;
    return {
      razaoSocial: e.razaoSocial,
      cnpj: e.cnpj,
      inscricaoMunicipal: e.inscricaoMunicipal,
      nomeFantasia: e.nomeFantasia,
    };
  } catch {
    return null;
  }
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
        codVerificacao: t.codVerificacao,
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

  // Pendências: o que falta pra fechar/emitir com segurança. Erros pesam mais que avisos.
  const usaRps = unidadeUsaRps(unidadeId); // Metrópole emite NFS-e direto, sem RPS.
  const pendencias: Pendencia[] = [];
  if (mesRow) {
    if ((mesRow.aliquotaIss ?? 0) <= 0 || (mesRow.aliquotaTributos ?? 0) <= 0) {
      pendencias.push({ nivel: "erro", codigo: "aliquota", escopo: "competencia", mensagem: "Alíquotas do mês (ISS / tributos) não preenchidas." });
    }
    if ((base.valorBase ?? 0) <= 0) {
      pendencias.push({ nivel: "erro", codigo: "base_zero", escopo: "competencia", mensagem: "Base ainda não calculada — puxe a base da Gestão." });
    } else if (Math.abs(totais.difBase) > 0.05) {
      pendencias.push({ nivel: "erro", codigo: "base_diverge", escopo: "competencia", mensagem: `Soma das notas não bate com a base (diferença de ${fmtBRL(totais.difBase)}).` });
    }
    if (terapeutas.length === 0) {
      pendencias.push({ nivel: "erro", codigo: "sem_terapeutas", escopo: "competencia", mensagem: "Nenhuma terapeuta na competência — puxe da Folha ou adicione." });
    }
    for (const t of terapeutas) {
      const nome = t.terapeutaNome;
      if (!t.cnpjMei?.trim()) {
        pendencias.push({ nivel: "erro", codigo: "cnpj", escopo: "terapeuta", terapeutaId: t.id, terapeutaNome: nome, mensagem: "CNPJ da terapeuta ausente." });
      }
      if (!t.nfComissaoNumero) {
        pendencias.push({ nivel: "aviso", codigo: "nf_comissao", escopo: "terapeuta", terapeutaId: t.id, terapeutaNome: nome, mensagem: "Nº da NF de comissão ainda não veio da Folha." });
      }
      if (t.diasCredito > 0 && !t.nfCreditoNumero) {
        pendencias.push({ nivel: "aviso", codigo: "nf_credito", escopo: "terapeuta", terapeutaId: t.id, terapeutaNome: nome, mensagem: "Nº da NF de dias de crédito ainda não veio da Folha." });
      }
      if (usaRps && t.rps == null) {
        pendencias.push({ nivel: "aviso", codigo: "rps", escopo: "terapeuta", terapeutaId: t.id, terapeutaNome: nome, mensagem: "RPS ainda não atribuído." });
      }
    }
  }

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
    proximoRps: usaRps ? (seq?.proximoRps ?? null) : null,
    pendencias,
  };
}
