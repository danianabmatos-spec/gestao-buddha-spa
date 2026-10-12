// Mapeia uma nota do salão (NfSalaoTerapeuta) + competência (NfSalaoMes) + empresa da
// unidade (Empresa) → DpsDados (entrada do conector). Separa a parte PURA (montarDpsDaNota,
// testável sem banco) da que lê o Prisma (montarDpsDaCompetencia).
//
// Regra fiscal (ver defaults.ts): cTribNac=060201 (estética); 6 unidades Simples ME/EPP
// (opSimpNac=3) e Higienópolis Lucro Presumido (opSimpNac=1). A discriminação vem pronta
// da nota (a MESMA que a tela mostra). valorServico = M (valorNota).

import { prisma } from "@/lib/prisma";
import { slugPorId } from "@/lib/nf-salao/unidades";
import { ambienteAtual } from "@/lib/nf-salao/emissor/config";
import {
  CTRIB_NAC_SALAO, CNBS_SALAO, OP_SIMP_NAC_SALAO, REG_AP_TRIB_SN_SALAO,
  REG_ESP_TRIB_SALAO, codMunicipioIbge, CODIGO_SERVICO_SP, ALIQUOTA_ISS_SP,
  ITEM_LISTA_SERVICO_GINFES, ALIQUOTA_ISS_SBC,
} from "@/lib/nf-salao/emissor/defaults";
import type { DpsDados } from "@/lib/nf-salao/emissor/types";

// ── Entradas mínimas (desacopladas do Prisma, p/ a função pura ser testável) ────
export interface NotaParaDps {
  valorNota: number; // M
  discriminacao: string; // bloco pronto
}
export interface CompetenciaParaDps {
  ano: number;
  mes: number;
  aliquotaIss: number;
  aliquotaTributos: number;
}
export interface EmpresaParaDps {
  cnpj: string;
  inscricaoMunicipal: string;
  razaoSocial: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
}

/** Parâmetros de emissão (atribuídos no fluxo de emissão, não são fiscais). */
export interface ParamsEmissaoDps {
  serie?: string; // default "1"
  numero: number; // nDPS — sequencial por CNPJ/série
  dhEmi?: Date; // default agora
  incluirIM?: boolean; // default true; false quando o município não tem CNC (ex. homolog SP)
}

/** 1º dia do mês da competência, no fuso de São Paulo (dCompet é só data). */
function dataCompetencia(ano: number, mes: number): Date {
  return new Date(`${ano}-${String(mes).padStart(2, "0")}-01T00:00:00-03:00`);
}

/** PURA: monta DpsDados a partir dos dados já carregados. */
export function montarDpsDaNota(
  nota: NotaParaDps,
  competencia: CompetenciaParaDps,
  empresa: EmpresaParaDps,
  slug: string,
  params: ParamsEmissaoDps,
): DpsDados {
  const ehSimples = slug !== "higienopolis"; // Higienópolis = Lucro Presumido
  const ehMetropole = slug === "shopping-metropole"; // GINFES / São Bernardo
  const ibge = codMunicipioIbge(slug);
  const incluirIM = params.incluirIM ?? true;

  return {
    ambiente: ambienteAtual(),
    serie: params.serie ?? "1",
    numero: params.numero,
    dhEmi: params.dhEmi ?? new Date(),
    competencia: dataCompetencia(competencia.ano, competencia.mes),

    prestadorCnpj: empresa.cnpj,
    prestadorIM: incluirIM ? empresa.inscricaoMunicipal : "",
    prestadorRazaoSocial: empresa.razaoSocial,
    prestadorEndereco: {
      logradouro: empresa.logradouro,
      numero: empresa.numero,
      complemento: empresa.complemento || undefined,
      bairro: empresa.bairro,
      codMunicipioIbge: ibge,
      uf: empresa.uf,
      cep: empresa.cep,
    },

    opSimpNac: ehSimples ? OP_SIMP_NAC_SALAO : 1,
    regApTribSN: ehSimples ? REG_AP_TRIB_SN_SALAO : undefined,
    regEspTrib: REG_ESP_TRIB_SALAO,

    codMunicipioPrestacaoIbge: ibge,
    cTribNac: CTRIB_NAC_SALAO,
    cNBS: CNBS_SALAO,
    descricaoServico: nota.discriminacao,
    valorServico: nota.valorNota,

    tribISSQN: 1, // tributável
    tpRetISSQN: 1, // não retido (consumidor final)
    // Alíquota ISS do serviço: SBC (Metrópole) vs SP capital. Nacional ignora.
    aliquotaIssPct: ehMetropole ? ALIQUOTA_ISS_SBC : ALIQUOTA_ISS_SP,
    pTotTribSNPct: ehSimples ? competencia.aliquotaTributos : undefined,

    // Campos do padrão de SP (lidos só pelo backend municipal-sp):
    codigoServicoMunicipal: CODIGO_SERVICO_SP,
    tipoRps: "RPS",
    statusRps: "N",
    tributacaoRps: "T",
    issRetido: false,

    // Campos do GINFES/ABRASF (lidos só pelo backend municipal-ginfes — Metrópole):
    itemListaServico: ITEM_LISTA_SERVICO_GINFES,
    optanteSimplesNacional: ehSimples ? 1 : 2,
    incentivadorCultural: 2,
    naturezaOperacao: "1",
  };
}

export interface DpsDaCompetencia {
  notaId: number;
  terapeutaNome: string;
  jaEmitida: boolean; // status EMITIDA / já tem nfSalaoNumero
  dps: DpsDados;
}

/**
 * Carrega a competência do banco e monta as DPS de todas as notas (uma por terapeuta).
 * `numeroInicial` = primeiro nDPS a usar; incrementa por nota (ordem alfabética do nome).
 * NÃO emite — só prepara os dados. (A atribuição definitiva de nDPS acontece na emissão.)
 */
export async function montarDpsDaCompetencia(
  ano: number,
  mes: number,
  unidadeId: number,
  numeroInicial = 1,
  dhEmi?: Date,
): Promise<DpsDaCompetencia[]> {
  const slug = slugPorId(unidadeId);
  if (!slug) throw new Error(`Unidade ${unidadeId} sem slug.`);

  const mesRow = await prisma.nfSalaoMes.findUnique({
    where: { unidadeId_ano_mes: { unidadeId, ano, mes } },
  });
  if (!mesRow) throw new Error(`Competência ${mes}/${ano} não encontrada para a unidade.`);

  const empresa = await prisma.empresa.findFirst({ where: { unidadeSlug: slug } });
  if (!empresa) throw new Error(`Empresa não cadastrada para '${slug}' (cadastre em /empresas).`);

  const notas = await prisma.nfSalaoTerapeuta.findMany({
    where: { nfSalaoMesId: mesRow.id },
    orderBy: { terapeutaNome: "asc" },
  });

  const comp: CompetenciaParaDps = {
    ano: mesRow.ano, mes: mesRow.mes,
    aliquotaIss: mesRow.aliquotaIss, aliquotaTributos: mesRow.aliquotaTributos,
  };
  const emp: EmpresaParaDps = {
    cnpj: empresa.cnpj, inscricaoMunicipal: empresa.inscricaoMunicipal, razaoSocial: empresa.razaoSocial,
    logradouro: empresa.logradouro, numero: empresa.numero, complemento: empresa.complemento,
    bairro: empresa.bairro, cep: empresa.cep, uf: empresa.uf,
  };

  return notas.map((n, i) => ({
    notaId: n.id,
    terapeutaNome: n.terapeutaNome,
    jaEmitida: n.status === "EMITIDA" || !!n.nfSalaoNumero,
    dps: montarDpsDaNota(
      { valorNota: n.valorNota, discriminacao: n.discriminacao },
      comp, emp, slug,
      { numero: numeroInicial + i, dhEmi },
    ),
  }));
}
