// Montagem do XML do padrão GINFES v03 (ABRASF-derivado) — São Bernardo (Metrópole).
// EnviarLoteRpsEnvio + cabeçalho. FUNÇÕES PURAS. A assinatura (LoteRps por Id) vem de fora.
// ⚠️ NÃO testado ao vivo (falta o A1 da Metrópole). Estrutura conforme lib de referência
// nfephp/sped-nfse-ginfes + manual GINFES. Validar na homologação quando tiver o certificado.

import type { DpsDados } from "@/lib/nf-salao/emissor/types";

const NS_ENVIO = "http://www.ginfes.com.br/servico_enviar_lote_rps_envio_v03.xsd";
const NS_TIPOS = "http://www.ginfes.com.br/tipos_v03.xsd";
const NS_CABEC = "http://www.ginfes.com.br/cabecalho_v03.xsd";
const NS_CONSULTA = "http://www.ginfes.com.br/servico_consultar_nfse_rps_envio_v03.xsd";

const soDig = (s: string) => String(s ?? "").replace(/\D/g, "");
const reais2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** DataEmissao ABRASF: AAAA-MM-DDTHH:MM:SS (horário de São Paulo, sem offset). */
function fmtDataHora(d: Date): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(d)) if (part.type !== "literal") p[part.type] = part.value;
  if (p.hour === "24") p.hour = "00";
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** Cabeçalho (arg0). Prefixo ns2 no cabecalho; versaoDados SEM namespace (como a lib ref). */
export function montarCabecalhoGinfes(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ns2:cabecalho versao="3" xmlns:ns2="${NS_CABEC}"><versaoDados>3</versaoDados></ns2:cabecalho>`;
}

export const loteIdDe = (d: DpsDados) => `lote${d.numero}`;
export const rpsIdDe = (d: DpsDados) => `rps${d.numero}`;

/** EnviarLoteRpsEnvio v03 com 1 RPS, SEM assinatura (a ds:Signature do LoteRps vem depois). */
export function montarEnviarLoteRps(d: DpsDados): string {
  const cnpj = soDig(d.prestadorCnpj);
  const im = soDig(d.prestadorIM);
  const aliqFrac = (d.aliquotaIssPct ?? 0) / 100;
  const valorIss = Math.round((d.valorServico * aliqFrac + Number.EPSILON) * 100) / 100;
  const issRetidoAbrasf = d.issRetido ? 1 : 2; // ABRASF: 1=Sim, 2=Não

  const valores =
    `<tipos:Valores>` +
    `<tipos:ValorServicos>${reais2(d.valorServico)}</tipos:ValorServicos>` +
    `<tipos:ValorDeducoes>0.00</tipos:ValorDeducoes>` +
    `<tipos:IssRetido>${issRetidoAbrasf}</tipos:IssRetido>` +
    `<tipos:ValorIss>${reais2(valorIss)}</tipos:ValorIss>` +
    `<tipos:BaseCalculo>${reais2(d.valorServico)}</tipos:BaseCalculo>` +
    `<tipos:Aliquota>${aliqFrac.toFixed(4).replace(/(\.\d\d)0+$/, "$1")}</tipos:Aliquota>` +
    `<tipos:ValorLiquidoNfse>${reais2(d.valorServico)}</tipos:ValorLiquidoNfse>` +
    `</tipos:Valores>`;

  const servico =
    `<tipos:Servico>` +
    valores +
    `<tipos:ItemListaServico>${esc(d.itemListaServico ?? "")}</tipos:ItemListaServico>` +
    (d.codigoTributacaoMunicipio ? `<tipos:CodigoTributacaoMunicipio>${esc(d.codigoTributacaoMunicipio)}</tipos:CodigoTributacaoMunicipio>` : "") +
    `<tipos:Discriminacao>${esc(d.descricaoServico)}</tipos:Discriminacao>` +
    `<tipos:CodigoMunicipio>${soDig(d.codMunicipioPrestacaoIbge)}</tipos:CodigoMunicipio>` +
    `</tipos:Servico>`;

  const infRps =
    `<tipos:InfRps Id="${rpsIdDe(d)}">` +
    `<tipos:IdentificacaoRps>` +
    `<tipos:Numero>${d.numero}</tipos:Numero>` +
    `<tipos:Serie>${esc(d.serie ?? "1")}</tipos:Serie>` +
    `<tipos:Tipo>1</tipos:Tipo>` +
    `</tipos:IdentificacaoRps>` +
    `<tipos:DataEmissao>${fmtDataHora(d.dhEmi)}</tipos:DataEmissao>` +
    `<tipos:NaturezaOperacao>${d.naturezaOperacao ?? "1"}</tipos:NaturezaOperacao>` +
    `<tipos:OptanteSimplesNacional>${d.optanteSimplesNacional ?? 1}</tipos:OptanteSimplesNacional>` +
    `<tipos:IncentivadorCultural>${d.incentivadorCultural ?? 2}</tipos:IncentivadorCultural>` +
    `<tipos:Status>1</tipos:Status>` +
    servico +
    `<tipos:Prestador>` +
    `<tipos:Cnpj>${cnpj}</tipos:Cnpj>` +
    `<tipos:InscricaoMunicipal>${im}</tipos:InscricaoMunicipal>` +
    `</tipos:Prestador>` +
    // Tomador é obrigatório no schema; NF do salão é agregada (tomador não identificado).
    `<tipos:Tomador></tipos:Tomador>` +
    `</tipos:InfRps>`;

  const loteRps =
    `<LoteRps Id="${loteIdDe(d)}">` +
    `<tipos:NumeroLote>${d.numero}</tipos:NumeroLote>` +
    `<tipos:Cnpj>${cnpj}</tipos:Cnpj>` +
    `<tipos:InscricaoMunicipal>${im}</tipos:InscricaoMunicipal>` +
    `<tipos:QuantidadeRps>1</tipos:QuantidadeRps>` +
    `<tipos:ListaRps><tipos:Rps>${infRps}</tipos:Rps></tipos:ListaRps>` +
    `</LoteRps>`;

  return `<?xml version="1.0" encoding="UTF-8"?><EnviarLoteRpsEnvio xmlns="${NS_ENVIO}" xmlns:tipos="${NS_TIPOS}">${loteRps}</EnviarLoteRpsEnvio>`;
}

/** ConsultarNfseRpsEnvio (arg0 do ConsultarNfsePorRpsV3). */
export function montarConsultarNfsePorRps(d: DpsDados): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ConsultarNfseRpsEnvio xmlns="${NS_CONSULTA}" xmlns:tipos="${NS_TIPOS}">` +
    `<IdentificacaoRps><tipos:Numero>${d.numero}</tipos:Numero><tipos:Serie>${esc(d.serie ?? "1")}</tipos:Serie><tipos:Tipo>1</tipos:Tipo></IdentificacaoRps>` +
    `<Prestador><tipos:Cnpj>${soDig(d.prestadorCnpj)}</tipos:Cnpj><tipos:InscricaoMunicipal>${soDig(d.prestadorIM)}</tipos:InscricaoMunicipal></Prestador>` +
    `</ConsultarNfseRpsEnvio>`;
}
