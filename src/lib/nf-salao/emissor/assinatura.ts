// Assinatura digital XMLDSig da DPS — padrão exigido pelo SNNFS-e (Sefin Nacional).
// Assina o elemento <infDPS> (pelo atributo Id), inserindo <Signature> logo após ele,
// dentro de <DPS> (enveloped). Algoritmos obrigatórios do padrão nacional:
//   SignatureMethod = rsa-sha256 · DigestMethod = sha256 · Canonicalization = exclusive C14N.
// Gotchas que causam rejeição (todos tratados aqui):
//   (1) re-adicionar a declaração <?xml ...?> DEPOIS de assinar (xml-crypto a remove);
//   (2) usar SHA-256 (NÃO SHA-1, erro comum de copiar código da NF-e);
//   (3) Reference URI = "#<Id do infDPS>", assinando infDPS e não DPS.

import crypto from "node:crypto";
import { SignedXml } from "xml-crypto";
import forge from "node-forge";
import type { CredencialCertificado } from "@/lib/nf-salao/emissor/types";

const ALGO = {
  signature: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  digest: "http://www.w3.org/2001/04/xmlenc#sha256",
  c14n: "http://www.w3.org/2001/10/xml-exc-c14n#",
  enveloped: "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
} as const;

const DECL = '<?xml version="1.0" encoding="UTF-8"?>';

export interface CertificadoExtraido {
  privateKeyPem: string;
  certPem: string; // só o cert FOLHA (vai no KeyInfo, EndCertOnly)
  certChainPem: string; // folha + intermediários (p/ o handshake mTLS)
  /** Validade do certificado — útil p/ avisar antes de vencer. */
  notBefore: Date;
  notAfter: Date;
  titular: string; // CN do subject
}

/** Extrai a chave privada e o certificado (folha) de um A1 (.pfx/.p12 PKCS#12). */
export function extrairCertificado(pfx: Buffer, senha: string): CertificadoExtraido {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

  // chave privada (pode estar em bag cifrada ou não)
  let keyObj: forge.pki.PrivateKey | undefined;
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  keyObj = shrouded[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key ?? undefined;
  if (!keyObj) {
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });
    keyObj = plain[forge.pki.oids.keyBag]?.[0]?.key ?? undefined;
  }
  if (!keyObj) throw new Error("Certificado A1 sem chave privada legível (senha incorreta?).");

  // certificado FOLHA (o do titular): dentre os certBags, o que casa com a chave privada.
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certs = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
  if (certs.length === 0) throw new Error("Certificado A1 sem certificado legível.");
  const keyN = (keyObj as forge.pki.rsa.PrivateKey).n;
  const leaf =
    certs.find((c) => {
      const pub = c.publicKey as forge.pki.rsa.PublicKey;
      return pub?.n && keyN && pub.n.equals(keyN);
    }) ?? certs[0];

  const cn = leaf.subject.getField("CN");
  // cadeia: folha primeiro, depois os intermediários (p/ o handshake mTLS)
  const intermediarios = certs.filter((c) => c !== leaf);
  const certChainPem = [leaf, ...intermediarios].map((c) => forge.pki.certificateToPem(c)).join("");
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyObj),
    certPem: forge.pki.certificateToPem(leaf),
    certChainPem,
    notBefore: leaf.validity.notBefore,
    notAfter: leaf.validity.notAfter,
    titular: cn?.value ?? "",
  };
}

/**
 * Assina o XML da DPS. Recebe o XML (string) e a credencial (pfx+senha), devolve o XML
 * assinado com a declaração <?xml?> re-adicionada, pronto p/ GZip+Base64.
 */
export function assinarDps(xml: string, cred: CredencialCertificado): string {
  const { privateKeyPem, certPem } = extrairCertificado(cred.pfx, cred.senha);
  return assinarDpsComPem(xml, privateKeyPem, certPem);
}

/** Assina a DPS a partir da chave/cert já em PEM (evita reabrir o .pfx). */
export function assinarDpsComPem(xml: string, privateKeyPem: string, certPem: string): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: ALGO.signature,
    canonicalizationAlgorithm: ALGO.c14n,
  });
  // KeyInfo com <X509Data><X509Certificate> (só o cert do assinante).
  sig.getKeyInfoContent = SignedXml.getKeyInfoContent;

  sig.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    transforms: [ALGO.enveloped, ALGO.c14n],
    digestAlgorithm: ALGO.digest,
  });

  // insere <Signature> logo APÓS <infDPS> (irmão, dentro de <DPS>)
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='infDPS']", action: "after" },
  });

  let assinado = sig.getSignedXml();
  if (!assinado.startsWith("<?xml")) assinado = DECL + assinado;
  return assinado;
}

// ── PADRÃO MUNICIPAL DE SÃO PAULO (Nota do Milhão) ──────────────────────────────

/** Assinatura do RPS de SP: SHA1+RSA da string de 86 posições → Base64. */
export function assinarString86(texto: string, privateKeyPem: string): string {
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(Buffer.from(texto, "latin1")); // string ASCII de largura fixa
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

/**
 * Assinatura XMLDSig do LOTE de SP (PedidoEnvioLoteRPS): RSA-SHA1 + digest SHA1 +
 * C14N INCLUSIVA (REC-xml-c14n-20010315, NÃO exclusiva) + enveloped, Reference URI=""
 * (documento inteiro), KeyInfo só com X509Certificate (EndCertOnly). Signature ao final.
 */
export function assinarLoteSP(xml: string, privateKeyPem: string, certPem: string): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.getKeyInfoContent = SignedXml.getKeyInfoContent;
  sig.addReference({
    xpath: "//*[local-name(.)='PedidoEnvioLoteRPS']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    isEmptyUri: true,
  });
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='PedidoEnvioLoteRPS']", action: "append" },
  });
  let out = sig.getSignedXml();
  if (!out.startsWith("<?xml")) out = DECL + out;
  return out;
}

// ── PADRÃO GINFES / ABRASF (São Bernardo - Metrópole) ───────────────────────────

/**
 * Assina o EnviarLoteRpsEnvio do GINFES: XMLDSig no elemento `LoteRps` (pelo atributo Id),
 * RSA-SHA1 + digest SHA1 + C14N INCLUSIVA + enveloped; a ds:Signature fica logo após o
 * LoteRps, dentro de EnviarLoteRpsEnvio. (Padrão da lib nfephp/sped-nfse-ginfes.)
 */
export function assinarGinfes(xml: string, privateKeyPem: string, certPem: string): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.getKeyInfoContent = SignedXml.getKeyInfoContent;
  sig.addReference({
    xpath: "//*[local-name(.)='LoteRps']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='LoteRps']", action: "after" },
  });
  let out = sig.getSignedXml();
  if (!out.startsWith("<?xml")) out = DECL + out;
  return out;
}
