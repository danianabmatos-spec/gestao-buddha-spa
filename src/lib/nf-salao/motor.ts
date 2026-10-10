// Motor de cálculo do Controle Fiscal da Lei do Salão Parceiro.
// Funções PURAS (sem I/O) — a fonte da verdade é a planilha "AGOSTO 26" da Anália,
// validada 1:1 (ver scripts/validar-agosto.ts). Toda a lógica fiscal mora aqui.
//
// Mecânica (Lei do Salão Parceiro):
//   base a emitir = faturamento(caixa) + reembolso voucher(mês anterior) + gympass
//                   + totalpass − notas avulsas já emitidas
//   por terapeuta: P = comissão + dias de crédito   (o que ela emite de NF MEI)
//                  N = P ÷ ΣP                        (% de contribuição)
//                  M = base × N                      (valor da NF do salão)
//                  O = M − P                         (base de cálculo do ISS)

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface BaseInput {
  faturamentoCaixa: number;
  reembolsoVoucher: number;
  reembolsoGympass: number;
  reembolsoTotalpass: number;
  notasAvulsas: number;
}

/** Valor base a emitir no mês. */
export function calcularBase(b: BaseInput): number {
  return round2(
    b.faturamentoCaixa +
      b.reembolsoVoucher +
      b.reembolsoGympass +
      b.reembolsoTotalpass -
      b.notasAvulsas,
  );
}

export interface TerapeutaInput {
  nome: string;
  cnpjMei: string;
  comissao: number; // G — comissão do fechamento (Folha)
  diasCredito: number; // F — dias de crédito (Folha)
}

export interface TerapeutaCalculo extends TerapeutaInput {
  valorTerapeuta: number; // P = comissão + dias de crédito
  pct: number; // N = P ÷ ΣP (precisão cheia)
  valorNota: number; // M = base × N
  baseCalculo: number; // O = M − P
}

/**
 * Rateia a base entre as terapeutas proporcional à contribuição de cada uma.
 * pct usa precisão cheia (como a planilha: N = P/ΣP, M = base×N).
 */
export function calcularRateio(
  base: number,
  terapeutas: TerapeutaInput[],
): TerapeutaCalculo[] {
  const comP = terapeutas.map((t) => ({
    ...t,
    valorTerapeuta: round2(t.comissao + t.diasCredito),
  }));
  const somaP = comP.reduce((s, t) => s + t.valorTerapeuta, 0);
  return comP.map((t) => {
    const pct = somaP > 0 ? t.valorTerapeuta / somaP : 0;
    const valorNota = round2(base * pct);
    return {
      ...t,
      pct,
      valorNota,
      baseCalculo: round2(valorNota - t.valorTerapeuta),
    };
  });
}

/** Formata número como moeda BR: 4719 → "R$ 4.719,00". */
export function fmtBRL(n: number): string {
  const s = Math.abs(n)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}R$ ${s}`;
}

/** Formata alíquota: 2.39 → "2,39". */
export function fmtPct(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export interface DiscriminacaoInput {
  mesAno: string; // ex.: "AGOSTO/2026"
  terapeutaNome: string;
  cnpjMei: string;
  valorTerapeuta: number; // P
  aliquotaIss: number; // ex.: 2.39
  aliquotaTributos: number; // ex.: 3.67
  codigoServico?: string; // fixo p/ todas
}

const CODIGO_SERVICO_PADRAO =
  "06.02.01 - Esteticista, tratamento de pele, depilação e congêneres.";

/** Monta o corpo da discriminação da NF, pronto pra copiar/colar na prefeitura. */
export function montarDiscriminacao(d: DiscriminacaoInput): string {
  const codigo = d.codigoServico ?? CODIGO_SERVICO_PADRAO;
  return [
    `Serviços de Massagem e Estética Realizados no mês de ${d.mesAno}`,
    "",
    `Profissional Parceiro: ${d.terapeutaNome} - CNPJ ${d.cnpjMei} - ${fmtBRL(d.valorTerapeuta)}`,
    "",
    `Código do serviço prestado: ${codigo}`,
    "",
    `Alíquota de ISS ${fmtPct(d.aliquotaIss)} % e Alíquota dos tributos aproximados será de ${fmtPct(d.aliquotaTributos)}%`,
  ].join("\n");
}

// ── HIGIENÓPOLIS (Lucro Presumido) — formato próprio, SÓ para esta unidade. ─────────
// Alíquota de tributos aproximados fixa (NFS-e Nacional).
export const ALIQUOTA_TRIBUTOS_HIGIENOPOLIS = 8.65;

export interface DiscriminacaoHigienopolisInput {
  mesAno: string; // ex.: "Setembro/2026" (título)
  valorNota: number; // M = valor total dos serviços (= O + P)
  baseCalculo: number; // O = valor do salão parceiro (base do ISS)
  valorTerapeuta: number; // P = valor do profissional parceiro (valor dela)
  razaoSocialSalao: string; // ex.: "Higienópolis Wellness Center Ltda."
  cnpjSalao: string; // CNPJ do salão (empresa)
  terapeutaNome: string;
  cnpjMei: string;
  aliquotaTributos: number; // 8.65
}

/** Discriminação da NF do Higienópolis (Lucro Presumido). Formato distinto das demais. */
export function montarDiscriminacaoHigienopolis(d: DiscriminacaoHigienopolisInput): string {
  return [
    `Serviços de Massagem e Estética Realizados no mês de ${d.mesAno}`,
    `Valor total dos Serviços: ${fmtBRL(d.valorNota)}`,
    `Salão Parceiro: ${d.razaoSocialSalao} - CNPJ ${d.cnpjSalao} - ${fmtBRL(d.baseCalculo)} - Profissional Parceiro: ${d.terapeutaNome} - CNPJ - ${d.cnpjMei} - ${fmtBRL(d.valorTerapeuta)}`,
    `Alíquota dos tributos aproximados será de ${fmtPct(d.aliquotaTributos)}%`,
  ].join("\n");
}

export interface ConferenciaResultado {
  ok: boolean;
  somaNotas: number; // ΣM — deve bater com a base
  base: number;
  difBase: number;
  somaTerapeutas: number; // ΣP — soma das NFs das terapeutas
  problemas: string[];
}

/**
 * Trava de conferência ("sem ponta solta"): ΣM deve = base. Também devolve ΣP
 * (soma das NFs das terapeutas) pra bater com o total informado do fechamento.
 */
export function conferir(
  base: number,
  calc: TerapeutaCalculo[],
  tolerancia = 0.05,
): ConferenciaResultado {
  const somaNotas = round2(calc.reduce((s, t) => s + t.valorNota, 0));
  const somaTerapeutas = round2(calc.reduce((s, t) => s + t.valorTerapeuta, 0));
  const difBase = round2(somaNotas - base);
  const problemas: string[] = [];
  if (Math.abs(difBase) > tolerancia) {
    problemas.push(
      `Soma das notas (${fmtBRL(somaNotas)}) diverge da base (${fmtBRL(base)}) em ${fmtBRL(difBase)}.`,
    );
  }
  return {
    ok: problemas.length === 0,
    somaNotas,
    base,
    difBase,
    somaTerapeutas,
    problemas,
  };
}
