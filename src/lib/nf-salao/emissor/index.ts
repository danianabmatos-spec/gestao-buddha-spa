// Fábrica do conector de NFS-e. Hoje só o backend oficial nacional (6 unidades Simples).
// Futuramente: backend municipal-sp p/ o Higienópolis (Lucro Presumido). A tela/motor
// chamam SEMPRE por aqui — nunca importam um backend direto.

import type { Ambiente, EmissorNfse } from "@/lib/nf-salao/emissor/types";
import { criarEmissorOficialNacional } from "@/lib/nf-salao/emissor/oficial-nacional";
import { criarEmissorMunicipalSP } from "@/lib/nf-salao/emissor/municipal-sp";
import { criarEmissorMunicipalGinfes } from "@/lib/nf-salao/emissor/municipal-ginfes";
import { ambienteAtual } from "@/lib/nf-salao/emissor/config";

// Backends. 6 unidades da capital = municipal-sp (Nota do Milhão); Metrópole = municipal-ginfes
// (São Bernardo); oficial-nacional fica de reserva (caso algum município migre p/ o nacional).
export type ModoEmissor = "oficial-nacional" | "municipal-sp" | "municipal-ginfes";

export function getEmissor(modo: ModoEmissor, ambiente?: Ambiente): EmissorNfse {
  const amb = ambiente ?? ambienteAtual();
  switch (modo) {
    case "oficial-nacional":
      return criarEmissorOficialNacional(amb);
    case "municipal-sp":
      return criarEmissorMunicipalSP(amb);
    case "municipal-ginfes":
      return criarEmissorMunicipalGinfes(amb);
    default:
      throw new Error(`Modo de emissor desconhecido: ${modo}`);
  }
}

export * from "@/lib/nf-salao/emissor/types";
