// Parâmetros fiscais padrão da NF do salão (padrão NACIONAL). Decisões da Daniana/contador.
// Usados pelo mapeador (NfSalaoTerapeuta → DpsDados) quando for construído.

// Código de Tributação Nacional do serviço do salão.
// DECISÃO Daniana (10/10/26): usar o mesmo item de hoje em SP →
// 06.02.01 "Esteticista, tratamento de pele, depilação e congêneres" → "060201".
// (NÃO usar 060301 massagem; mantém alinhado ao código de serviço atual.)
export const CTRIB_NAC_SALAO = "060201";

// Descrição textual do código (p/ discriminação / referência).
export const CODIGO_SERVICO_SALAO =
  "06.02.01 - Esteticista, tratamento de pele, depilação e congêneres.";

// NBS (opcional na DPS) — família 1.2602 (tratamento de beleza/bem-estar).
// ⚠️ A confirmar com o contador se será informado e qual subitem; por ora não enviar.
export const CNBS_SALAO: string | undefined = undefined;

// Regime: 6 unidades são Simples ME/EPP; Higienópolis é LUCRO PRESUMIDO (não optante).
export const OP_SIMP_NAC_SALAO = 3 as const; // ME/EPP (Simples)
// regApTribSN: 1 (ISS dentro do DAS) — ⚠️ a confirmar com o contador por município.
export const REG_AP_TRIB_SN_SALAO = 1 as const;
export const REG_ESP_TRIB_SALAO = 0; // nenhum

// Código IBGE do município de cada unidade (prestação = local da unidade). As 7 ficam só
// em São Paulo capital (3550308) e São Bernardo do Campo (3548708 — Metrópole).
export const COD_MUNICIPIO_IBGE_DEFAULT = "3550308"; // São Paulo
const COD_MUNICIPIO_IBGE: Record<string, string> = {
  "shopping-metropole": "3548708", // São Bernardo do Campo
};
export const codMunicipioIbge = (slug: string): string =>
  COD_MUNICIPIO_IBGE[slug] ?? COD_MUNICIPIO_IBGE_DEFAULT;

// Código de serviço de SP (lista própria, IN SF/SUREM 08/2011): 08516 = estética,
// ISS 5%. É o equivalente ao 06.02.01 escolhido. ⚠️ alíquota a confirmar c/ contador.
export const CODIGO_SERVICO_SP = "08516";
export const ALIQUOTA_ISS_SP = 5;

// GINFES / São Bernardo (Metrópole). ABRASF ItemListaServico = item LC116 (6.02 → "0602").
// ⚠️ A CONFIRMAR c/ contador: item da lista de SBC, código de tributação municipal e a
// alíquota ISS de estética em São Bernardo (placeholder 5%).
export const ITEM_LISTA_SERVICO_GINFES = "0602";
export const ALIQUOTA_ISS_SBC = 5;
