// Backend do conector: API OFICIAL do padrão NACIONAL (SNNFS-e / Sefin Nacional).
// Fluxo de emissão: montar DPS → assinar → GZip → Base64 → POST /nfse (mTLS A1).
// Resposta síncrona 201: { chaveAcesso, nfseXmlGZipB64 } → GUnzip p/ ler nNFSe.
// Consulta: GET /nfse/{chaveAcesso}.

import https from "node:https";
import { gzipSync, gunzipSync } from "node:zlib";
import axios from "axios";
import type {
  Ambiente, DpsDados, CredencialCertificado, EmissorNfse, EmitirResultado, ConsultarResultado,
} from "@/lib/nf-salao/emissor/types";
import { montarDpsXml } from "@/lib/nf-salao/emissor/dps-xml";
import { assinarDpsComPem, extrairCertificado, type CertificadoExtraido } from "@/lib/nf-salao/emissor/assinatura";

const BASES: Record<Ambiente, string> = {
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
  producao: "https://sefin.nfse.gov.br/SefinNacional",
};

/** Extrai o conteúdo de uma tag (tolera prefixo de namespace). Primeira ocorrência. */
function campoXml(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([^<]*)</`, "i"));
  return m ? m[1] : null;
}

/** Normaliza a lista de erros do governo (as chaves vêm capitalizadas: Codigo/Descricao). */
function normalizarErros(body: Record<string, unknown> | undefined): { codigo: string; descricao: string; complemento?: string }[] | undefined {
  const arr = (body?.erros ?? body?.Erros) as Record<string, unknown>[] | undefined;
  if (!Array.isArray(arr)) return undefined;
  return arr.map((e) => ({
    codigo: String(e.codigo ?? e.Codigo ?? ""),
    descricao: String(e.descricao ?? e.Descricao ?? ""),
    complemento: (e.complemento ?? e.Complemento) as string | undefined,
  }));
}

// mTLS a partir do PEM (key+cadeia). Evita o PKCS#12 direto no OpenSSL 3 do Node, que
// recusa muitos A1 brasileiros (algoritmo legado) com "Unsupported PKCS12 PFX data".
function agenteMtls(cert: CertificadoExtraido): https.Agent {
  return new https.Agent({
    key: cert.privateKeyPem,
    cert: cert.certChainPem,
    minVersion: "TLSv1.2",
  });
}

export function criarEmissorOficialNacional(ambiente: Ambiente): EmissorNfse {
  const base = BASES[ambiente];

  return {
    nome: `oficial-nacional:${ambiente}`,

    async emitir(dados: DpsDados, cred: CredencialCertificado): Promise<EmitirResultado> {
      const cert = extrairCertificado(cred.pfx, cred.senha);
      // 1) XML DPS → 2) assinado → 3) gzip+base64
      const xml = montarDpsXml({ ...dados, ambiente });
      const assinado = assinarDpsComPem(xml, cert.privateKeyPem, cert.certPem);
      const dpsXmlGZipB64 = gzipSync(Buffer.from(assinado, "utf8")).toString("base64");

      const resp = await axios.post(
        `${base}/nfse`,
        { dpsXmlGZipB64 },
        {
          httpsAgent: agenteMtls(cert),
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          validateStatus: () => true,
          timeout: 60_000,
        },
      );

      const body = resp.data as Record<string, unknown>;
      if (resp.status === 201 || resp.status === 200) {
        const nfseB64 = body?.nfseXmlGZipB64 as string | undefined;
        const xmlNfse = nfseB64 ? gunzipSync(Buffer.from(nfseB64, "base64")).toString("utf8") : null;
        return {
          ok: true,
          chaveAcesso: body?.chaveAcesso as string | undefined,
          idDps: body?.idDps as string | undefined,
          numeroNfse: xmlNfse ? campoXml(xmlNfse, "nNFSe") : null,
          dataAutorizacao: xmlNfse ? campoXml(xmlNfse, "dhProc") : null,
          xmlNfse,
          httpStatus: resp.status,
          raw: body,
        };
      }
      return {
        ok: false,
        erros: normalizarErros(body) ?? [{ codigo: String(resp.status), descricao: "Falha na emissão." }],
        httpStatus: resp.status,
        raw: body,
      };
    },

    async consultar(chaveAcesso: string, cred: CredencialCertificado): Promise<ConsultarResultado> {
      const cert = extrairCertificado(cred.pfx, cred.senha);
      const resp = await axios.get(`${base}/nfse/${chaveAcesso}`, {
        httpsAgent: agenteMtls(cert),
        headers: { Accept: "application/json" },
        validateStatus: () => true,
        timeout: 60_000,
      });
      const body = resp.data as Record<string, unknown>;
      if (resp.status === 200) {
        const nfseB64 = body?.nfseXmlGZipB64 as string | undefined;
        const xmlNfse = nfseB64 ? gunzipSync(Buffer.from(nfseB64, "base64")).toString("utf8") : null;
        return {
          ok: true,
          chaveAcesso,
          numeroNfse: xmlNfse ? campoXml(xmlNfse, "nNFSe") : null,
          situacao: xmlNfse ? "AUTORIZADA" : undefined,
          xmlNfse,
          httpStatus: resp.status,
          raw: body,
        };
      }
      return {
        ok: false,
        chaveAcesso,
        erros: normalizarErros(body) ?? [{ codigo: String(resp.status), descricao: "Falha na consulta." }],
        httpStatus: resp.status,
        raw: body,
      };
    },
  };
}
