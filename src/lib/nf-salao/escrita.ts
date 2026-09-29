// Camada de ESCRITA do módulo NF Salão Parceiro (server-side).
// Toda mudança que afeta valores recomputa o rateio (M/O) e a discriminação, pra que
// o estado no banco esteja sempre coerente com o motor. Piloto: Anália (unidadeId 2).
import { prisma } from "@/lib/prisma";
import {
  calcularBase,
  calcularRateio,
  montarDiscriminacao,
  type BaseInput,
} from "@/lib/nf-salao/motor";
import { UNIDADE_PILOTO, getCompetencia } from "@/lib/nf-salao/dados";
import { getNotasTerapeutasFolha } from "@/lib/folha/notas-terapeutas";
import { getFaturamentoCaixaMes } from "@/lib/reembolso/belle-faturamento";
import { getVoucherReembolso } from "@/lib/reembolso/voucher-unidade";
import { slugPorId } from "@/lib/nf-salao/unidades";

const normNome = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const soDigitos = (s: string) => (s || "").replace(/\D/g, "");

const MESES_LONGO = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];
const mesAnoLabel = (ano: number, mes: number) => `${MESES_LONGO[mes - 1]}/${ano}`;

async function getMesRow(ano: number, mes: number, unidadeId = UNIDADE_PILOTO) {
  return prisma.nfSalaoMes.findUnique({
    where: { unidadeId_ano_mes: { unidadeId, ano, mes } },
  });
}

function assertAberto(status: string) {
  if (status === "FECHADO") {
    throw new Error("Competência fechada. Reabra o mês para editar.");
  }
}

/** Recomputa % / valor da nota / base de cálculo / discriminação de todas as terapeutas. */
async function recomputar(mesId: number) {
  const mesRow = await prisma.nfSalaoMes.findUnique({ where: { id: mesId } });
  if (!mesRow) return;
  const ter = await prisma.nfSalaoTerapeuta.findMany({ where: { nfSalaoMesId: mesId } });
  const calc = calcularRateio(
    mesRow.valorBase,
    ter.map((t) => ({
      nome: t.terapeutaNome,
      cnpjMei: t.cnpjMei,
      comissao: t.comissao,
      diasCredito: t.diasCredito,
    })),
  );
  const label = mesAnoLabel(mesRow.ano, mesRow.mes);
  await prisma.$transaction(
    ter.map((t, i) =>
      prisma.nfSalaoTerapeuta.update({
        where: { id: t.id },
        data: {
          valorTerapeuta: calc[i].valorTerapeuta,
          pct: calc[i].pct,
          valorNota: calc[i].valorNota,
          baseCalculo: calc[i].baseCalculo,
          discriminacao: montarDiscriminacao({
            mesAno: label,
            terapeutaNome: t.terapeutaNome,
            cnpjMei: t.cnpjMei,
            valorTerapeuta: calc[i].valorTerapeuta,
            aliquotaIss: mesRow.aliquotaIss,
            aliquotaTributos: mesRow.aliquotaTributos,
          }),
        },
      }),
    ),
  );
}

/** Cria (abre) uma competência vazia para a unidade/mês, se ainda não existir. */
export async function abrirCompetencia(ano: number, mes: number, unidadeId = UNIDADE_PILOTO) {
  const existente = await getMesRow(ano, mes, unidadeId);
  if (existente) return getCompetencia(ano, mes, unidadeId);
  await prisma.nfSalaoMes.create({
    data: { unidadeId, ano, mes, status: "ABERTO" },
  });
  // garante o sequenciador de RPS da unidade
  await prisma.rpsSequencia.upsert({
    where: { unidadeId },
    update: {},
    create: { unidadeId, proximoRps: 1 },
  });
  return getCompetencia(ano, mes, unidadeId);
}

export interface BaseEdicao extends Partial<BaseInput> {
  aliquotaIss?: number;
  aliquotaTributos?: number;
  // De onde veio cada valor (transparência na tela). Só é gravado quando enviado.
  faturamentoFonte?: string | null;
  reembolsoFonte?: string | null;
}

/** Salva os campos da base + alíquotas e recomputa o rateio. */
export async function salvarBase(ano: number, mes: number, campos: BaseEdicao, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada. Abra o mês primeiro.");
  assertAberto(mesRow.status);

  const base: BaseInput = {
    faturamentoCaixa: campos.faturamentoCaixa ?? mesRow.faturamentoCaixa,
    reembolsoVoucher: campos.reembolsoVoucher ?? mesRow.reembolsoVoucher,
    reembolsoGympass: campos.reembolsoGympass ?? mesRow.reembolsoGympass,
    reembolsoTotalpass: campos.reembolsoTotalpass ?? mesRow.reembolsoTotalpass,
    notasAvulsas: campos.notasAvulsas ?? mesRow.notasAvulsas,
  };
  const valorBase = calcularBase(base);
  await prisma.nfSalaoMes.update({
    where: { id: mesRow.id },
    data: {
      ...base,
      valorBase,
      aliquotaIss: campos.aliquotaIss ?? mesRow.aliquotaIss,
      aliquotaTributos: campos.aliquotaTributos ?? mesRow.aliquotaTributos,
      ...(campos.faturamentoFonte !== undefined ? { faturamentoFonte: campos.faturamentoFonte } : {}),
      ...(campos.reembolsoFonte !== undefined ? { reembolsoFonte: campos.reembolsoFonte } : {}),
    },
  });
  await recomputar(mesRow.id);
  return getCompetencia(ano, mes, unidadeId);
}

export interface ResumoBaseGestao {
  faturamentoCaixa: number;
  reembolsoVoucher: number;
  competLabel: string; // mês da competência (caixa)
  reembolsoLabel: string; // mês anterior (reembolso de voucher)
  reembolsoZerado: boolean; // não achou reembolso do mês anterior → veio 0
}

/**
 * Puxa automaticamente do gestão os dois campos "de origem" da base:
 *  - Faturamento em caixa do MÊS DA COMPETÊNCIA (Belle);
 *  - Reembolso de voucher do MÊS CIVIL ANTERIOR (módulo de reembolso) — regra fixa por
 *    causa do fechamento no dia 05, quando o voucher da própria competência ainda não chegou.
 * Gympass/TotalPass/notas avulsas continuam manuais. Grava a fonte de cada valor,
 * recalcula a base e o rateio via salvarBase. Não toca em nada quando o mês está FECHADO.
 */
export async function puxarBaseGestao(ano: number, mes: number, unidadeId = UNIDADE_PILOTO): Promise<{ competencia: Awaited<ReturnType<typeof getCompetencia>>; resumo: ResumoBaseGestao }> {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Abra a competência antes de puxar a base.");
  assertAberto(mesRow.status);
  const slug = slugPorId(unidadeId);
  if (!slug) throw new Error("Unidade sem slug configurado para o gestão.");

  const mesAnt = mes === 1 ? 12 : mes - 1;
  const anoAnt = mes === 1 ? ano - 1 : ano;

  let faturamentoCaixa: number;
  try {
    faturamentoCaixa = await getFaturamentoCaixaMes(slug, ano, mes);
  } catch (e) {
    throw new Error(`Não consegui puxar o faturamento em caixa do Belle: ${e instanceof Error ? e.message : "erro"}`);
  }
  const reembolsoVoucher = await getVoucherReembolso(slug, anoAnt, mesAnt);

  const competLabel = mesAnoLabel(ano, mes);
  const reembolsoLabel = mesAnoLabel(anoAnt, mesAnt);
  const competencia = await salvarBase(
    ano,
    mes,
    {
      faturamentoCaixa,
      reembolsoVoucher,
      faturamentoFonte: `Belle · caixa ${competLabel}`,
      reembolsoFonte: `voucher líq. · ${reembolsoLabel}`,
    },
    unidadeId,
  );

  return {
    competencia,
    resumo: {
      faturamentoCaixa,
      reembolsoVoucher,
      competLabel,
      reembolsoLabel,
      reembolsoZerado: reembolsoVoucher === 0,
    },
  };
}

export interface TerapeutaEdicao {
  terapeutaNome?: string;
  cnpjMei?: string;
  comissao?: number;
  diasCredito?: number;
  nfComissaoNumero?: string | null;
  nfCreditoNumero?: string | null;
}

export async function addTerapeuta(ano: number, mes: number, dados: TerapeutaEdicao, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  assertAberto(mesRow.status);
  if (!dados.terapeutaNome?.trim()) throw new Error("Informe o nome da terapeuta.");
  await prisma.nfSalaoTerapeuta.create({
    data: {
      nfSalaoMesId: mesRow.id,
      unidadeId,
      terapeutaNome: dados.terapeutaNome.trim(),
      cnpjMei: dados.cnpjMei?.trim() ?? "",
      comissao: dados.comissao ?? 0,
      diasCredito: dados.diasCredito ?? 0,
      nfComissaoNumero: dados.nfComissaoNumero ?? null,
      nfCreditoNumero: dados.nfCreditoNumero ?? null,
    },
  });
  await recomputar(mesRow.id);
  return getCompetencia(ano, mes, unidadeId);
}

export async function editTerapeuta(ano: number, mes: number, id: number, dados: TerapeutaEdicao, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  assertAberto(mesRow.status);
  await prisma.nfSalaoTerapeuta.update({
    where: { id },
    data: {
      ...(dados.terapeutaNome !== undefined ? { terapeutaNome: dados.terapeutaNome.trim() } : {}),
      ...(dados.cnpjMei !== undefined ? { cnpjMei: dados.cnpjMei.trim() } : {}),
      ...(dados.comissao !== undefined ? { comissao: dados.comissao } : {}),
      ...(dados.diasCredito !== undefined ? { diasCredito: dados.diasCredito } : {}),
      ...(dados.nfComissaoNumero !== undefined ? { nfComissaoNumero: dados.nfComissaoNumero } : {}),
      ...(dados.nfCreditoNumero !== undefined ? { nfCreditoNumero: dados.nfCreditoNumero } : {}),
    },
  });
  await recomputar(mesRow.id);
  return getCompetencia(ano, mes, unidadeId);
}

export async function removerTerapeuta(ano: number, mes: number, id: number, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  assertAberto(mesRow.status);
  await prisma.nfSalaoTerapeuta.delete({ where: { id } });
  await recomputar(mesRow.id);
  return getCompetencia(ano, mes, unidadeId);
}

/**
 * Registra a emissão de uma nota: atribui o próximo RPS da unidade (avança o
 * sequenciador de forma atômica — nunca repete/pula), grava nº da NF e código de
 * verificação, e marca EMITIDA. Se a nota já tinha RPS, mantém o mesmo.
 */
export async function emitirNota(
  ano: number, mes: number, terapeutaId: number,
  dados: { nfSalaoNumero?: string; codVerificacao?: string },
  unidadeId = UNIDADE_PILOTO,
) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  const ter = await prisma.nfSalaoTerapeuta.findUnique({ where: { id: terapeutaId } });
  if (!ter || ter.nfSalaoMesId !== mesRow.id) throw new Error("Nota não encontrada nesta competência.");

  await prisma.$transaction(async (tx) => {
    let rps = ter.rps;
    if (rps == null) {
      const seq = await tx.rpsSequencia.upsert({
        where: { unidadeId },
        update: {},
        create: { unidadeId, proximoRps: 1 },
      });
      rps = seq.proximoRps;
      await tx.rpsSequencia.update({
        where: { unidadeId },
        data: { proximoRps: rps + 1 },
      });
    }
    await tx.nfSalaoTerapeuta.update({
      where: { id: terapeutaId },
      data: {
        rps,
        nfSalaoNumero: dados.nfSalaoNumero?.trim() || ter.nfSalaoNumero,
        codVerificacao: dados.codVerificacao?.trim() || ter.codVerificacao,
        status: "EMITIDA",
        emitidaEm: new Date(),
      },
    });
  });
  return getCompetencia(ano, mes, unidadeId);
}

export interface ResumoFolha {
  encontrado: boolean;
  criados: number;
  atualizados: number;
  total: number;
  creditos: number; // quantas terapeutas vieram com dias de crédito pago neste mês
  cnpjCorrigidos: { nome: string; de: string; para: string }[];
}

/**
 * Puxa o bloco das terapeutas da Folha e concilia com a competência:
 * atualiza comissão, CNPJ (autoritativo), nome e nº da NF de comissão; cria quem não
 * existe; e PRESERVA o que é manual (dias de crédito, NF de crédito, RPS/NF emitida).
 * Casa por nome normalizado; se não achar, por CNPJ. Depois recomputa o rateio.
 */
export async function puxarDaFolha(ano: number, mes: number, unidadeId = UNIDADE_PILOTO): Promise<{ competencia: Awaited<ReturnType<typeof getCompetencia>>; resumo: ResumoFolha }> {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Abra a competência antes de puxar da Folha.");
  assertAberto(mesRow.status);
  const slug = slugPorId(unidadeId);
  if (!slug) throw new Error("Unidade sem slug configurado para a Folha.");

  const folha = await getNotasTerapeutasFolha(slug, ano, mes);
  const resumo: ResumoFolha = { encontrado: folha.encontrado, criados: 0, atualizados: 0, total: folha.terapeutas.length, creditos: 0, cnpjCorrigidos: [] };
  if (!folha.encontrado) return { competencia: await getCompetencia(ano, mes, unidadeId), resumo };

  const existentes = await prisma.nfSalaoTerapeuta.findMany({ where: { nfSalaoMesId: mesRow.id } });
  for (const f of folha.terapeutas) {
    const alvoNome = normNome(f.nome);
    const alvoCnpj = soDigitos(f.cnpj);
    const match = existentes.find((e) => normNome(e.terapeutaNome) === alvoNome)
      ?? (alvoCnpj ? existentes.find((e) => soDigitos(e.cnpjMei) === alvoCnpj) : undefined);
    if (f.diasCredito > 0) resumo.creditos++;

    if (match) {
      if (alvoCnpj && soDigitos(match.cnpjMei) && soDigitos(match.cnpjMei) !== alvoCnpj) {
        resumo.cnpjCorrigidos.push({ nome: f.nome, de: match.cnpjMei, para: f.cnpj });
      }
      await prisma.nfSalaoTerapeuta.update({
        where: { id: match.id },
        data: {
          terapeutaNome: f.nome || match.terapeutaNome,
          cnpjMei: f.cnpj || match.cnpjMei,
          comissao: f.comissao,
          folhaTerapeutaId: f.folhaTerapeutaId,
          // Dias de crédito: a Folha é autoritativa quando há crédito PAGO no mês (>0);
          // se não houver, PRESERVA o que estiver lançado manualmente (não zera).
          ...(f.diasCredito > 0 ? { diasCredito: f.diasCredito } : {}),
          ...(f.nfCreditoNumero ? { nfCreditoNumero: f.nfCreditoNumero } : {}),
          ...(f.nfComissaoNumero ? { nfComissaoNumero: f.nfComissaoNumero } : {}),
        },
      });
      resumo.atualizados++;
    } else {
      await prisma.nfSalaoTerapeuta.create({
        data: {
          nfSalaoMesId: mesRow.id,
          unidadeId,
          terapeutaNome: f.nome,
          cnpjMei: f.cnpj,
          comissao: f.comissao,
          diasCredito: f.diasCredito,
          folhaTerapeutaId: f.folhaTerapeutaId,
          nfCreditoNumero: f.nfCreditoNumero,
          nfComissaoNumero: f.nfComissaoNumero,
        },
      });
      resumo.criados++;
    }
  }
  await recomputar(mesRow.id);
  return { competencia: await getCompetencia(ano, mes, unidadeId), resumo };
}

/**
 * Atribui o próximo RPS (sequencial, atômico) a todas as terapeutas que ainda não têm,
 * em ORDEM ALFABÉTICA (mesma da tabela). NÃO marca EMITIDA — o nº da NF vem depois da
 * prefeitura. Devolve quantas receberam RPS.
 */
async function _atribuirRpsPendentes(mesId: number, unidadeId: number): Promise<number> {
  const ter = await prisma.nfSalaoTerapeuta.findMany({
    where: { nfSalaoMesId: mesId, rps: null },
    orderBy: { terapeutaNome: "asc" },
  });
  if (ter.length === 0) return 0;
  await prisma.$transaction(async (tx) => {
    const seq = await tx.rpsSequencia.upsert({
      where: { unidadeId },
      update: {},
      create: { unidadeId, proximoRps: 1 },
    });
    let prox = seq.proximoRps;
    for (const t of ter) {
      await tx.nfSalaoTerapeuta.update({ where: { id: t.id }, data: { rps: prox } });
      prox++;
    }
    await tx.rpsSequencia.update({ where: { unidadeId }, data: { proximoRps: prox } });
  });
  return ter.length;
}

/** Botão "Atribuir RPS a todas": dá RPS às pendentes (o mês precisa estar aberto). */
export async function atribuirRpsTodas(ano: number, mes: number, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  assertAberto(mesRow.status);
  const n = await _atribuirRpsPendentes(mesRow.id, unidadeId);
  return { competencia: await getCompetencia(ano, mes, unidadeId), atribuidos: n };
}

/**
 * Define o "próximo RPS" da unidade (para semear a numeração inicial de cada unidade).
 * Trava anti-reuso: não aceita valor menor ou igual ao maior RPS já atribuído na unidade.
 */
export async function definirProximoRps(valor: number, unidadeId = UNIDADE_PILOTO) {
  if (!Number.isInteger(valor) || valor < 1) {
    throw new Error("Informe um número de RPS válido (inteiro ≥ 1).");
  }
  const maxRow = await prisma.nfSalaoTerapeuta.aggregate({
    where: { unidadeId, rps: { not: null } },
    _max: { rps: true },
  });
  const maiorUsado = maxRow._max.rps ?? 0;
  if (valor <= maiorUsado) {
    throw new Error(`O próximo RPS deve ser maior que ${maiorUsado} (já usado nesta unidade).`);
  }
  await prisma.rpsSequencia.upsert({
    where: { unidadeId },
    update: { proximoRps: valor },
    create: { unidadeId, proximoRps: valor },
  });
  return valor;
}

export async function fecharMes(ano: number, mes: number, porNome: string | null, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  // TRAVA: não fecha com pendências. Exceção: "RPS não atribuído", que o próprio
  // fechamento resolve logo abaixo. Motivo: como M = base × P/ΣP, uma terapeuta
  // incompleta desequilibra o cálculo de TODAS — o mês só fecha completo.
  const atual = await getCompetencia(ano, mes, unidadeId);
  const bloqueantes = atual.pendencias.filter((p) => p.codigo !== "rps");
  if (bloqueantes.length > 0) {
    const ex = bloqueantes
      .slice(0, 3)
      .map((p) => (p.terapeutaNome ? `${p.terapeutaNome} — ${p.mensagem}` : p.mensagem));
    throw new Error(
      `Não dá pra fechar: ${bloqueantes.length} pendência(s) a resolver. Ex.: ${ex.join(" · ")}${bloqueantes.length > 3 ? " …" : ""}`,
    );
  }
  // Tudo certo → atribui RPS pra todas (ordem alfabética) e trava o mês.
  await _atribuirRpsPendentes(mesRow.id, unidadeId);
  await prisma.nfSalaoMes.update({
    where: { id: mesRow.id },
    data: { status: "FECHADO", fechadoEm: new Date(), fechadoPorNome: porNome },
  });
  return getCompetencia(ano, mes, unidadeId);
}

export async function reabrirMes(ano: number, mes: number, unidadeId = UNIDADE_PILOTO) {
  const mesRow = await getMesRow(ano, mes, unidadeId);
  if (!mesRow) throw new Error("Competência não encontrada.");
  await prisma.nfSalaoMes.update({
    where: { id: mesRow.id },
    data: { status: "ABERTO", fechadoEm: null, fechadoPorNome: null },
  });
  return getCompetencia(ano, mes, unidadeId);
}
