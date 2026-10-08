// Cliente da integração com a Folha p/ o módulo NF Salão Parceiro.
// A Folha expõe /api/integracao/notas-terapeutas (protegido por INTEGRACAO_KEY) com o
// bloco das terapeutas do fechamento: nome, CNPJ, comissão (bruta) e nº da NF de comissão.
// "Dias de crédito" NÃO existe na Folha — segue manual no controle do salão.

const FOLHA_BASE = process.env.FOLHA_BASE_URL || "http://localhost:3003";
const KEY = process.env.INTEGRACAO_KEY || "";

export interface TerapeutaFolha {
  folhaTerapeutaId: string;
  nome: string;
  cnpj: string;
  cpf: string;
  comissao: number; // = G (bruto, antes da DAS)
  diasCredito: number; // = F (crédito de dias PAGO no mês; 0 se não houve)
  nfCreditoNumero: string | null; // nº da NF de crédito (quando a Folha já tem)
  nfComissaoNumero: string | null;
  rescisao?: boolean; // true = terapeuta em rescisão (NF do acerto entra na base)
}

export interface NotasTerapeutasFolha {
  encontrado: boolean;
  unidade: string;
  ano: number;
  mes: number;
  terapeutas: TerapeutaFolha[];
}

/**
 * Busca no Folha (ao vivo) o bloco das terapeutas de um fechamento.
 * Lança erro em falha (a UI mostra pra ponta) — é uma ação explícita da Daniana.
 */
export async function getNotasTerapeutasFolha(
  unidadeSlug: string,
  ano: number,
  mes: number,
): Promise<NotasTerapeutasFolha> {
  if (!KEY) {
    throw new Error(
      "Integração com a Folha não configurada (defina INTEGRACAO_KEY e FOLHA_BASE_URL).",
    );
  }
  const url = `${FOLHA_BASE}/api/integracao/notas-terapeutas?unidade=${encodeURIComponent(unidadeSlug)}&ano=${ano}&mes=${mes}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { "x-integracao-key": KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Não consegui falar com a Folha. Verifique se o app está no ar.");
  }
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}));
    throw new Error(j.error || `Folha respondeu ${resp.status}.`);
  }
  return (await resp.json()) as NotasTerapeutasFolha;
}
