// Backend do conector: padrão PRÓPRIO de São Paulo (Nota do Milhão / PRODAM), SOAP 1.2.
// Fluxo de emissão (1 RPS por chamada): string 86 pos → assina (SHA1+RSA) → monta
// PedidoEnvioLoteRPS → assina o lote (XMLDSig RSA-SHA1) → envelopa no SOAP (MensagemXML
// em CDATA) → POST mTLS em lotenfe.asmx. Homologação = método TesteEnvioLoteRPS (não grava).

import https from "node:https";
import axios from "axios";
import type {
  Ambiente, DpsDados, CredencialCertificado, EmissorNfse, EmitirResultado, ConsultarResultado,
} from "@/lib/nf-salao/emissor/types";
import { montarString86, montarPedidoLoteRps } from "@/lib/nf-salao/emissor/sp-rps-xml";
import { extrairCertificado, assinarString86, assinarLoteSP, type CertificadoExtraido } from "@/lib/nf-salao/emissor/assinatura";

const ENDPOINT = "https://nfews.prefeitura.sp.gov.br/lotenfe.asmx";
const NS = "http://www.prefeitura.sp.gov.br/nfe";

// A soapAction NÃO é {NS}/{Metodo} — é um nome próprio por operação (do WSDL de SP).
const SOAP_ACTION: Record<string, string> = {
  TesteEnvioLoteRPS: `${NS}/ws/testeenvio`,
  EnvioLoteRPS: `${NS}/ws/envioLoteRPS`,
  EnvioRPS: `${NS}/ws/envioRPS`,
  ConsultaNFeEmitidas: `${NS}/ws/consultaNFeEmitidas`,
  ConsultaNFe: `${NS}/ws/consultaNFe`,
  CancelamentoNFe: `${NS}/ws/cancelamentoNFe`,
};

function agenteMtls(cert: CertificadoExtraido): https.Agent {
  return new https.Agent({ key: cert.privateKeyPem, cert: cert.certChainPem, minVersion: "TLSv1.2" });
}

function desescapar(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function campo(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([^<]*)</`, "i"));
  return m ? m[1].trim() : null;
}
/** Coleta pares Codigo/Descricao de todos os blocos <Erro>/<Alerta> do retorno. */
function coletarErros(xml: string): { codigo: string; descricao: string }[] {
  const out: { codigo: string; descricao: string }[] = [];
  const re = /<(?:[\w.-]+:)?(?:Erro|Alerta)\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?(?:Erro|Alerta)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push({ codigo: campo(m[1], "Codigo") ?? "", descricao: campo(m[1], "Descricao") ?? "" });
  }
  return out;
}

export function criarEmissorMunicipalSP(ambiente: Ambiente): EmissorNfse {
  const metodo = ambiente === "producao" ? "EnvioLoteRPS" : "TesteEnvioLoteRPS";

  async function chamarSoap(metodoSoap: string, mensagemXml: string, cert: CertificadoExtraido) {
    // SP recusa o prólogo <?xml?> dentro do parâmetro MensagemXML (erro 1102).
    const corpo = mensagemXml.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
    // MensagemXML com os caracteres especiais escapados (forma do manual, item 3.4.5).
    const corpoEsc = corpo
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    const envelope =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap12:Body>` +
      `<${metodoSoap}Request xmlns="${NS}">` +
      `<VersaoSchema>1</VersaoSchema>` +
      `<MensagemXML>${corpoEsc}</MensagemXML>` +
      `</${metodoSoap}Request>` +
      `</soap12:Body></soap12:Envelope>`;
    const action = SOAP_ACTION[metodoSoap] ?? `${NS}/${metodoSoap}`;
    return axios.post(ENDPOINT, envelope, {
      httpsAgent: agenteMtls(cert),
      headers: { "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"` },
      validateStatus: () => true,
      timeout: 60_000,
    });
  }

  return {
    nome: `municipal-sp:${ambiente}`,

    async emitir(dados: DpsDados, cred: CredencialCertificado): Promise<EmitirResultado> {
      const cert = extrairCertificado(cred.pfx, cred.senha);
      // 1) assinatura do RPS (86 pos) → 2) XML do lote → 3) assinatura XMLDSig do lote
      const assinatura86 = assinarString86(montarString86(dados), cert.privateKeyPem);
      const pedido = montarPedidoLoteRps(dados, assinatura86);
      const assinado = assinarLoteSP(pedido, cert.privateKeyPem, cert.certPem);

      const resp = await chamarSoap(metodo, assinado, cert);
      const texto = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
      const ret = desescapar(texto);
      const sucesso = /<(?:[\w.-]+:)?Sucesso[^>]*>\s*true/i.test(ret);

      if (resp.status >= 200 && resp.status < 300 && sucesso) {
        // SP devolve NumeroNFe + CodigoVerificacao (sem chave de 50 díg do nacional).
        return {
          ok: true,
          numeroNfse: campo(ret, "NumeroNFe"),
          codVerificacao: campo(ret, "CodigoVerificacao"),
          dataAutorizacao: campo(ret, "DataEmissaoNFe"),
          httpStatus: resp.status,
          raw: ret.slice(0, 4000),
        };
      }
      const erros = coletarErros(ret);
      return {
        ok: false,
        erros: erros.length ? erros : [{ codigo: String(resp.status), descricao: "Falha na emissão (SP)." }],
        httpStatus: resp.status,
        raw: ret.slice(0, 4000),
      };
    },

    async consultar(chaveAcesso: string): Promise<ConsultarResultado> {
      // ConsultaNFe de SP (por nº da NF-e + CCM) será implementada quando necessário.
      return {
        ok: false,
        chaveAcesso,
        erros: [{ codigo: "N/I", descricao: "Consulta no padrão de SP ainda não implementada." }],
      };
    },
  };
}
