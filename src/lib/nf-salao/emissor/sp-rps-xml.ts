// Montagem do XML do padrão PRÓPRIO de São Paulo (Nota do Milhão / PRODAM):
// PedidoEnvioLoteRPS v1 + a assinatura de RPS em string de 86 posições.
// Fonte: Manual WS NFS-e SP v3.3.9. FUNÇÕES PURAS (a assinatura em si vem de fora).
//
// ⚠️ Quirks de SP respeitados aqui:
//  - RPS <ValorServicos> = INTEIRO em CENTAVOS (R$205,00 → 20500); já o Cabecalho
//    <ValorTotalServicos> = DECIMAL em reais (205.00).
//  - <AliquotaServicos> = fração (5% → 0.05).
//  - String de 86 posições: campos de largura fixa (ver tabela abaixo).
//  - Tomador NÃO INFORMADO (NF de fim de mês do salão) → indicador 3 + 14 zeros.

import type { DpsDados } from "@/lib/nf-salao/emissor/types";
import { fmtData, fmtDataCompacta } from "@/lib/nf-salao/emissor/dps-xml";

const NS = "http://www.prefeitura.sp.gov.br/nfe";
const soDig = (s: string) => String(s ?? "").replace(/\D/g, "");

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** R$ → inteiro em centavos (string). Ex.: 205 → "20500". */
const centavos = (n: number) => String(Math.round((n + Number.EPSILON) * 100));
/** Decimal em reais, 2 casas (Cabecalho). */
const reais2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
/** Alíquota como fração: 5 (%) → "0.05". Trailing zeros aparados (mín. 2 casas). */
function aliqFracao(pct: number): string {
  let s = (pct / 100).toFixed(4);
  s = s.replace(/(\.\d\d)0+$/, "$1"); // 0.0500 → 0.05 ; 0.0239 fica
  return s;
}

/**
 * Assinatura do RPS: string ASCII de 86 posições (v1). O retorno é a string CRUA —
 * quem assina (SHA1+RSA → base64) é o módulo de assinatura.
 * [1]CCM(8,0-esq) [2]Série(5,esq+espaços) [3]Nº(12,0-esq) [4]Data(8,AAAAMMDD)
 * [5]TipoTrib(1) [6]Status(1) [7]ISSRetido(1,S/N) [8]VServ(15,centavos,0-esq)
 * [9]VDeduç(15) [10]CódServ(5,0-esq) [11]IndTomador(1) [12]DocTomador(14)
 */
export function montarString86(d: DpsDados): string {
  const ccm = soDig(d.prestadorIM).padStart(8, "0").slice(-8);
  const serie = (d.serie ?? "").padEnd(5, " ").slice(0, 5);
  const numero = String(d.numero).padStart(12, "0");
  const data = fmtDataCompacta(d.dhEmi);
  const tipoTrib = (d.tributacaoRps ?? "T").slice(0, 1);
  const status = (d.statusRps ?? "N").slice(0, 1);
  const issRet = d.issRetido ? "S" : "N";
  const vServ = centavos(d.valorServico).padStart(15, "0");
  const vDed = "0".padStart(15, "0");
  const cod = soDig(d.codigoServicoMunicipal ?? "").padStart(5, "0").slice(-5);
  // Tomador não informado (NF do salão agregada do mês) → indicador 3 + 14 zeros.
  const indTomador = "3";
  const docTomador = "".padStart(14, "0");
  return ccm + serie + numero + data + tipoTrib + status + issRet + vServ + vDed + cod + indTomador + docTomador;
}

/**
 * Monta o PedidoEnvioLoteRPS (v1) com 1 RPS, ainda SEM a ds:Signature do lote
 * (inserida depois pelo assinador). `assinatura86` = o <Assinatura> já assinado+base64.
 */
export function montarPedidoLoteRps(d: DpsDados, assinatura86: string): string {
  const cnpj = soDig(d.prestadorCnpj);
  const ccm = soDig(d.prestadorIM);
  const data = fmtData(d.dhEmi);
  const serie = d.serie ?? "1";

  const rps =
    `<RPS xmlns="">` +
    `<Assinatura>${assinatura86}</Assinatura>` +
    `<ChaveRPS>` +
    `<InscricaoPrestador>${ccm}</InscricaoPrestador>` +
    `<SerieRPS>${esc(serie)}</SerieRPS>` +
    `<NumeroRPS>${d.numero}</NumeroRPS>` +
    `</ChaveRPS>` +
    `<TipoRPS>${d.tipoRps ?? "RPS"}</TipoRPS>` +
    `<DataEmissao>${data}</DataEmissao>` +
    `<StatusRPS>${d.statusRps ?? "N"}</StatusRPS>` +
    `<TributacaoRPS>${d.tributacaoRps ?? "T"}</TributacaoRPS>` +
    `<ValorServicos>${reais2(d.valorServico)}</ValorServicos>` +
    `<ValorDeducoes>0.00</ValorDeducoes>` +
    `<CodigoServico>${soDig(d.codigoServicoMunicipal ?? "")}</CodigoServico>` +
    `<AliquotaServicos>${aliqFracao(d.aliquotaIssPct ?? 0)}</AliquotaServicos>` +
    `<ISSRetido>${d.issRetido ? "true" : "false"}</ISSRetido>` +
    `<Discriminacao>${esc(d.descricaoServico)}</Discriminacao>` +
    `</RPS>`;

  const cabecalho =
    `<Cabecalho Versao="1" xmlns="">` +
    `<CPFCNPJRemetente><CNPJ>${cnpj}</CNPJ></CPFCNPJRemetente>` +
    `<transacao>true</transacao>` +
    `<dtInicio>${data}</dtInicio>` +
    `<dtFim>${data}</dtFim>` +
    `<QtdRPS>1</QtdRPS>` +
    `<ValorTotalServicos>${reais2(d.valorServico)}</ValorTotalServicos>` +
    `<ValorTotalDeducoes>0.00</ValorTotalDeducoes>` +
    `</Cabecalho>`;

  return `<?xml version="1.0" encoding="UTF-8"?><PedidoEnvioLoteRPS xmlns="${NS}">${cabecalho}${rps}</PedidoEnvioLoteRPS>`;
}
