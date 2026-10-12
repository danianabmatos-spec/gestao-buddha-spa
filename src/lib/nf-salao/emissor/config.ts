// Carregamento de configuração e credencial (A1) do emissor — a partir de env/arquivo.
// 🔒 SEGURANÇA: o certificado A1 é a assinatura fiscal da empresa. NUNCA fica no git nem
// na pasta pública. Mora fora do web root (ex.: /var/www/secrets/nfse/<slug>.pfx) e o
// .env.local guarda só o CAMINHO e a SENHA. Uma CNPJ (unidade) = um A1.
//
// Env esperadas:
//   NFSE_AMBIENTE                     = "homologacao" | "producao"   (default homologacao)
//   NFSE_CERT_DIR                     = diretório base dos .pfx (ex.: /var/www/secrets/nfse)
//   NFSE_CERT_<SLUG>_PATH             = caminho do .pfx (sobrepõe NFSE_CERT_DIR/<slug>.pfx)
//   NFSE_CERT_<SLUG>_SENHA            = senha do .pfx  (obrigatória p/ usar aquela unidade)
// <SLUG> = slug da unidade em MAIÚSCULAS com '-' → '_'. Ex.: ANALIA_FRANCO.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Ambiente, CredencialCertificado } from "@/lib/nf-salao/emissor/types";

export function ambienteAtual(): Ambiente {
  return process.env.NFSE_AMBIENTE === "producao" ? "producao" : "homologacao";
}

const envKey = (slug: string) => slug.toUpperCase().replace(/-/g, "_");

/** Caminho do .pfx da unidade (env específico > NFSE_CERT_DIR/<slug>.pfx). */
export function caminhoCertificado(slug: string): string | null {
  const direto = process.env[`NFSE_CERT_${envKey(slug)}_PATH`];
  if (direto) return direto;
  const dir = process.env.NFSE_CERT_DIR;
  return dir ? path.join(dir, `${slug}.pfx`) : null;
}

/**
 * Carrega a credencial (pfx + senha) da unidade. Lança erro claro se não configurada —
 * NUNCA loga o conteúdo nem a senha. Retorna null-safe via exceção explícita.
 */
export function carregarCredencial(slug: string): CredencialCertificado {
  const caminho = caminhoCertificado(slug);
  if (!caminho) throw new Error(`Certificado A1 não configurado para '${slug}' (defina NFSE_CERT_DIR ou NFSE_CERT_${envKey(slug)}_PATH).`);
  const senha = process.env[`NFSE_CERT_${envKey(slug)}_SENHA`];
  if (!senha) throw new Error(`Senha do certificado A1 ausente para '${slug}' (defina NFSE_CERT_${envKey(slug)}_SENHA).`);
  let pfx: Buffer;
  try {
    pfx = readFileSync(caminho);
  } catch {
    throw new Error(`Certificado A1 não encontrado no caminho configurado para '${slug}'.`);
  }
  return { pfx, senha };
}

export function temCredencial(slug: string): boolean {
  const caminho = caminhoCertificado(slug);
  if (!caminho || !process.env[`NFSE_CERT_${envKey(slug)}_SENHA`]) return false;
  try { readFileSync(caminho); return true; } catch { return false; }
}
