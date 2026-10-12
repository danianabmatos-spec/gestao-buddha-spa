// Backend do conector: GINFES v03 (ABRASF) — São Bernardo do Campo (Metrópole).
// SOAP 1.1 JAX-WS (RPC, params string arg0/arg1). Fluxo assíncrono:
//   RecepcionarLoteRpsV3(cabecalho, loteAssinado) → Protocolo → ConsultarNfsePorRpsV3 → NFS-e.
// ⚠️ NÃO testado ao vivo (falta o A1 da Metrópole). Estrutura conforme WSDL + lib de
// referência; validar na homologação (homologacao.ginfes.com.br) quando tiver o certificado.

import https from "node:https";
import axios from "axios";
import type {
  Ambiente, DpsDados, CredencialCertificado, EmissorNfse, EmitirResultado, ConsultarResultado,
} from "@/lib/nf-salao/emissor/types";
import { montarCabecalhoGinfes, montarEnviarLoteRps, montarConsultarNfsePorRps } from "@/lib/nf-salao/emissor/ginfes-xml";
import { extrairCertificado, assinarGinfes, type CertificadoExtraido } from "@/lib/nf-salao/emissor/assinatura";

const ENDPOINT: Record<Ambiente, string> = {
  homologacao: "https://homologacao.ginfes.com.br/ServiceGinfesImpl",
  producao: "https://producao.ginfes.com.br/ServiceGinfesImpl",
};
const METODO_NS: Record<Ambiente, string> = {
  homologacao: "http://homologacao.ginfes.com.br",
  producao: "http://producao.ginfes.com.br",
};

function agenteMtls(cert: CertificadoExtraido): https.Agent {
  return new https.Agent({ key: cert.privateKeyPem, cert: cert.certChainPem, minVersion: "TLSv1.2" });
}
const semPrologo = (s: string) => s.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
const desescapar = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function campo(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([^<]*)</`, "i"));
  return m ? m[1].trim() : null;
}
/** Mensagens de retorno ABRASF: <MensagemRetorno><Codigo/><Mensagem/><Correcao/>. */
function coletarErros(xml: string): { codigo: string; descricao: string }[] {
  const out: { codigo: string; descricao: string }[] = [];
  const re = /<(?:[\w.-]+:)?MensagemRetorno\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?MensagemRetorno>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push({ codigo: campo(m[1], "Codigo") ?? "", descricao: campo(m[1], "Mensagem") ?? "" });
  }
  return out;
}

export function criarEmissorMunicipalGinfes(ambiente: Ambiente): EmissorNfse {
  const url = ENDPOINT[ambiente];
  const ns = METODO_NS[ambiente];

  async function chamar(metodo: string, args: string[], cert: CertificadoExtraido) {
    // Args vão CRUS (sem escape/CDATA), prólogo removido — como a lib de referência.
    const corpoArgs = args.map((a, i) => `<arg${i}>${semPrologo(a)}</arg${i}>`).join("");
    const envelope =
      `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap:Body><ns1:${metodo} xmlns:ns1="${ns}">${corpoArgs}</ns1:${metodo}></soap:Body>` +
      `</soap:Envelope>`;
    return axios.post(url, envelope, {
      httpsAgent: agenteMtls(cert),
      headers: { "Content-Type": "application/soap+xml; charset=utf-8", SOAPAction: `"${metodo}"` },
      validateStatus: () => true,
      timeout: 60_000,
    });
  }

  /** Extrai o XML de retorno (dentro de <return>) e desescapa. */
  function retornoXml(texto: string): string {
    const m = texto.match(/<return>([\s\S]*?)<\/return>/i);
    return desescapar(m ? m[1] : texto);
  }

  return {
    nome: `municipal-ginfes:${ambiente}`,

    async emitir(dados: DpsDados, cred: CredencialCertificado): Promise<EmitirResultado> {
      const cert = extrairCertificado(cred.pfx, cred.senha);
      const cabecalho = montarCabecalhoGinfes();
      const loteAssinado = assinarGinfes(montarEnviarLoteRps(dados), cert.privateKeyPem, cert.certPem);

      const resp = await chamar("RecepcionarLoteRpsV3", [cabecalho, loteAssinado], cert);
      const ret = retornoXml(typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data));
      const erros = coletarErros(ret);
      const protocolo = campo(ret, "Protocolo");

      if (!protocolo || erros.length) {
        return {
          ok: false,
          erros: erros.length ? erros : [{ codigo: String(resp.status), descricao: "Falha no envio do lote (GINFES)." }],
          httpStatus: resp.status,
          raw: ret.slice(0, 4000),
        };
      }

      // Lote aceito → tenta a consulta por RPS p/ obter o nº da NFS-e (processamento é rápido).
      const cons = await chamar("ConsultarNfsePorRpsV3", [cabecalho, montarConsultarNfsePorRps(dados)], cert);
      const retc = retornoXml(typeof cons.data === "string" ? cons.data : JSON.stringify(cons.data));
      const numero = campo(retc, "Numero");
      const cod = campo(retc, "CodigoVerificacao");
      return {
        ok: true,
        numeroNfse: numero,
        chaveAcesso: cod ?? undefined, // GINFES usa Número + Código de Verificação (não chave de 50)
        httpStatus: resp.status,
        raw: `protocolo=${protocolo}\n${retc.slice(0, 3500)}`,
      };
    },

    async consultar(chaveAcesso: string): Promise<ConsultarResultado> {
      return {
        ok: false,
        chaveAcesso,
        erros: [{ codigo: "N/I", descricao: "Consulta GINFES por RPS feita na emissão; consulta avulsa não implementada." }],
      };
    },
  };
}
