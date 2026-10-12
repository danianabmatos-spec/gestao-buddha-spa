// Montagem do XML da DPS (Declaração de Prestação de Serviços) — padrão NACIONAL v1.01.
// Fonte: XSD oficial NFSe-ESQUEMAS_XSD-v1.01-20260209 (DPS_v1.01 + tiposComplexos/Simples).
// FUNÇÃO PURA (sem I/O): recebe DpsDados, devolve a string XML (ainda NÃO assinada).
//
// Regras do leiaute respeitadas aqui:
//  - namespace http://www.sped.fazenda.gov.br/nfse no elemento raiz, sem prefixo;
//  - SEM espaços/quebras/comentários entre as tags (o assinador exige canonicalização limpa);
//  - ordem dos elementos EXATAMENTE como no XSD (schema valida a ordem);
//  - decimais com ponto e 2 casas; datas em America/Sao_Paulo (offset fixo -03:00, sem DST).

import type { DpsDados } from "@/lib/nf-salao/emissor/types";

const NS = "http://www.sped.fazenda.gov.br/nfse";
const VER_APLIC = "BuddhaNFSalao-1.0"; // máx 20 chars (TSVerAplic)

/** Escapa os 5 caracteres especiais de XML em conteúdo de texto. */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const soDig = (s: string) => String(s ?? "").replace(/\D/g, "");
const padEsq = (s: string | number, n: number) => String(s).padStart(n, "0");
/** Valor monetário/decimal no formato do schema: ponto, 2 casas. Ex.: 1500 → "1500.00". */
const dec2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);

/** Componentes de uma data no fuso America/Sao_Paulo (sem DST desde 2019 → offset -03:00). */
function partesSP(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) if (part.type !== "literal") p[part.type] = part.value;
  // en-CA + hour12:false pode devolver "24" à meia-noite — normaliza p/ "00".
  if (p.hour === "24") p.hour = "00";
  return p; // {year, month, day, hour, minute, second}
}

/** dhEmi no formato TSDateTimeUTC: AAAA-MM-DDThh:mm:ss-03:00. */
export function fmtDhEmi(d: Date): string {
  const p = partesSP(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-03:00`;
}

/** dCompet no formato TSData: AAAA-MM-DD. */
export function fmtData(d: Date): string {
  const p = partesSP(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Data compacta AAAAMMDD (usada na assinatura de 86 posições de SP). */
export function fmtDataCompacta(d: Date): string {
  const p = partesSP(d);
  return `${p.year}${p.month}${p.day}`;
}

/**
 * Id da DPS (TSIdDPS, 45 pos): "DPS" + Cód.Mun(7) + TipoInscFed(1) + InscFed(14) + Série(5) + nDPS(15).
 * TipoInscFed: 1=CPF, 2=CNPJ. Prestador do salão é sempre CNPJ → 2.
 */
export function montarIdDps(d: DpsDados): string {
  const cnpj = padEsq(soDig(d.prestadorCnpj), 14);
  const mun = padEsq(soDig(d.codMunicipioPrestacaoIbge || d.prestadorEndereco.codMunicipioIbge), 7);
  return `DPS${mun}2${cnpj}${padEsq(soDig(d.serie), 5)}${padEsq(d.numero, 15)}`;
}

/** Monta o XML completo da DPS (não assinado). O <Signature> é inserido depois, no assinador. */
export function montarDpsXml(d: DpsDados): string {
  const id = montarIdDps(d);
  const tpAmb = d.ambiente === "producao" ? "1" : "2";
  const e = d.prestadorEndereco;

  // regTrib
  const regApTrib = d.opSimpNac === 3 && d.regApTribSN != null
    ? `<regApTribSN>${d.regApTribSN}</regApTribSN>` : "";
  const regTrib =
    `<regTrib>` +
    `<opSimpNac>${d.opSimpNac}</opSimpNac>` +
    regApTrib +
    `<regEspTrib>${d.regEspTrib}</regEspTrib>` +
    `</regTrib>`;

  // prestador
  const prest =
    `<prest>` +
    `<CNPJ>${soDig(d.prestadorCnpj)}</CNPJ>` +
    (d.prestadorIM ? `<IM>${esc(d.prestadorIM)}</IM>` : "") +
    `<xNome>${esc(d.prestadorRazaoSocial)}</xNome>` +
    `<end>` +
    `<endNac><cMun>${soDig(e.codMunicipioIbge)}</cMun><CEP>${soDig(e.cep)}</CEP></endNac>` +
    `<xLgr>${esc(e.logradouro)}</xLgr>` +
    `<nro>${esc(e.numero)}</nro>` +
    (e.complemento ? `<xCpl>${esc(e.complemento)}</xCpl>` : "") +
    `<xBairro>${esc(e.bairro)}</xBairro>` +
    `</end>` +
    regTrib +
    `</prest>`;

  // serviço
  const cServ =
    `<cServ>` +
    `<cTribNac>${soDig(d.cTribNac)}</cTribNac>` +
    `<xDescServ>${esc(d.descricaoServico)}</xDescServ>` +
    (d.cNBS ? `<cNBS>${soDig(d.cNBS)}</cNBS>` : "") +
    `</cServ>`;
  const serv =
    `<serv>` +
    `<locPrest><cLocPrestacao>${soDig(d.codMunicipioPrestacaoIbge)}</cLocPrestacao></locPrest>` +
    cServ +
    `</serv>`;

  // tribMun
  const tribMun =
    `<tribMun>` +
    `<tribISSQN>${d.tribISSQN}</tribISSQN>` +
    `<tpRetISSQN>${d.tpRetISSQN}</tpRetISSQN>` +
    (d.aliquotaIssPct != null ? `<pAliq>${dec2(d.aliquotaIssPct)}</pAliq>` : "") +
    `</tribMun>`;

  // totTrib: Simples ME/EPP → pTotTribSN; senão indica indTotTrib=0 (sem estimativa).
  const totTrib =
    `<totTrib>` +
    (d.opSimpNac === 3 && d.pTotTribSNPct != null
      ? `<pTotTribSN>${dec2(d.pTotTribSNPct)}</pTotTribSN>`
      : `<indTotTrib>0</indTotTrib>`) +
    `</totTrib>`;

  const valores =
    `<valores>` +
    `<vServPrest><vServ>${dec2(d.valorServico)}</vServ></vServPrest>` +
    `<trib>${tribMun}${totTrib}</trib>` +
    `</valores>`;

  const infDPS =
    `<infDPS Id="${id}">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<dhEmi>${fmtDhEmi(d.dhEmi)}</dhEmi>` +
    `<verAplic>${VER_APLIC}</verAplic>` +
    `<serie>${esc(d.serie)}</serie>` +
    `<nDPS>${d.numero}</nDPS>` +
    `<dCompet>${fmtData(d.competencia)}</dCompet>` +
    `<tpEmit>1</tpEmit>` +
    `<cLocEmi>${soDig(d.prestadorEndereco.codMunicipioIbge)}</cLocEmi>` +
    prest +
    serv +
    valores +
    `</infDPS>`;

  return `<?xml version="1.0" encoding="UTF-8"?><DPS versao="1.00" xmlns="${NS}">${infDPS}</DPS>`;
}
