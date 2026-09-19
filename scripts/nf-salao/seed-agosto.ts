// F2 — gera o payload de persistência da competência AGOSTO/2026 (Anália) usando o
// motor real. Emite JSON no stdout; um script SQL insere no dev.db. Agosto é o mês
// de referência (já emitido): status FECHADO, RPS/NF reais da planilha.
// Rodar: `node scripts/nf-salao/seed-agosto.ts > scripts/nf-salao/agosto-persist.json`
import { readFileSync } from "node:fs";
import {
  calcularBase,
  calcularRateio,
  montarDiscriminacao,
} from "../../src/lib/nf-salao/motor.ts";

const raw = JSON.parse(
  readFileSync(new URL("./agosto-real.json", import.meta.url), "utf-8"),
) as {
  ter: Array<{
    nome: string; cnpj: string; comissao: number; diasCredito: number;
    rps: number | null; nfSalao: number | null; nfComissao: number | null; nfCredito: number | null;
  }>;
  base: {
    faturamentoCaixa: number; reembolsoVoucher: number; gympass: number;
    totalpass: number; notasAvulsas: number; valorBase: number;
  };
};

const ALIQ_ISS = 2.39;
const ALIQ_TRIB = 3.67;
const MES_ANO = "AGOSTO/2026";

const baseInput = {
  faturamentoCaixa: raw.base.faturamentoCaixa,
  reembolsoVoucher: raw.base.reembolsoVoucher,
  reembolsoGympass: raw.base.gympass,
  reembolsoTotalpass: raw.base.totalpass,
  notasAvulsas: raw.base.notasAvulsas,
};
const base = calcularBase(baseInput);

const calc = calcularRateio(
  base,
  raw.ter.map((t) => ({
    nome: t.nome, cnpjMei: t.cnpj, comissao: t.comissao, diasCredito: t.diasCredito,
  })),
);

const terapeutas = calc.map((c, i) => {
  const src = raw.ter[i];
  return {
    terapeutaNome: c.nome,
    cnpjMei: c.cnpjMei,
    comissao: c.comissao,
    diasCredito: c.diasCredito,
    valorTerapeuta: c.valorTerapeuta,
    pct: c.pct,
    valorNota: c.valorNota,
    baseCalculo: c.baseCalculo,
    rps: src.rps,
    nfSalaoNumero: src.nfSalao != null ? String(src.nfSalao) : null,
    nfComissaoNumero: src.nfComissao != null ? String(src.nfComissao) : null,
    nfCreditoNumero: src.nfCredito != null ? String(src.nfCredito) : null,
    discriminacao: montarDiscriminacao({
      mesAno: MES_ANO,
      terapeutaNome: c.nome,
      cnpjMei: c.cnpjMei,
      valorTerapeuta: c.valorTerapeuta,
      aliquotaIss: ALIQ_ISS,
      aliquotaTributos: ALIQ_TRIB,
    }),
    status: "EMITIDA",
  };
});

const payload = {
  mes: {
    unidadeId: 2,
    ano: 2026,
    mes: 8,
    status: "FECHADO",
    aliquotaIss: ALIQ_ISS,
    aliquotaTributos: ALIQ_TRIB,
    faturamentoCaixa: baseInput.faturamentoCaixa,
    reembolsoVoucher: baseInput.reembolsoVoucher,
    reembolsoGympass: baseInput.reembolsoGympass,
    reembolsoTotalpass: baseInput.reembolsoTotalpass,
    notasAvulsas: baseInput.notasAvulsas,
    valorBase: base,
    faturamentoFonte: "gestao:caixa 2026-08",
    reembolsoFonte: "gestao:reembolso 2026-07 (mês anterior)",
  },
  terapeutas,
};

process.stdout.write(JSON.stringify(payload, null, 2));
