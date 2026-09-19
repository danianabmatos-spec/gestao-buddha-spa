// F1 — portão de qualidade: roda o motor real contra a planilha AGOSTO 26 (Anália)
// e prova, terapeuta a terapeuta, que os números batem antes de construir qualquer
// tela. Rodar: `node src/lib/nf-salao/validar-agosto.ts` (Node 24, type stripping).
import { readFileSync } from "node:fs";
import {
  calcularBase,
  calcularRateio,
  conferir,
  montarDiscriminacao,
  fmtBRL,
  type TerapeutaInput,
} from "../../src/lib/nf-salao/motor.ts";

interface EsperadoTerapeuta extends TerapeutaInput {
  expValorTerapeuta: number;
  expPct: number;
  expValorNota: number;
  expBaseCalculo: number;
}

const dados = JSON.parse(
  readFileSync(new URL("./agosto-esperado.json", import.meta.url), "utf-8"),
) as {
  base: {
    faturamentoCaixa: number;
    reembolsoVoucher: number;
    reembolsoGympass: number;
    reembolsoTotalpass: number;
    notasAvulsas: number;
    valorBaseEsperado: number;
  };
  terapeutas: EsperadoTerapeuta[];
};

const TOL = 0.01; // 1 centavo
let falhas = 0;
const check = (label: string, got: number, exp: number) => {
  const dif = Math.abs(got - exp);
  const ok = dif <= TOL;
  if (!ok) {
    falhas++;
    console.log(`  ✗ ${label}: motor=${got} planilha=${exp} (dif ${dif.toFixed(4)})`);
  }
  return ok;
};

// 1) Base
const base = calcularBase(dados.base);
console.log("── BASE A EMITIR ──");
check("valorBase", base, dados.base.valorBaseEsperado);
console.log(
  `  base motor = ${fmtBRL(base)}  |  planilha = ${fmtBRL(dados.base.valorBaseEsperado)}  ${base === dados.base.valorBaseEsperado ? "✓" : ""}`,
);

// 2) Rateio por terapeuta
const calc = calcularRateio(base, dados.terapeutas);
console.log("\n── POR TERAPEUTA (valorNota M / baseCálculo O / valorTerapeuta P) ──");
calc.forEach((t, i) => {
  const e = dados.terapeutas[i];
  const okP = check(`${t.nome} · P`, t.valorTerapeuta, e.expValorTerapeuta);
  const okM = check(`${t.nome} · M`, t.valorNota, e.expValorNota);
  const okO = check(`${t.nome} · O`, t.baseCalculo, e.expBaseCalculo);
  const flag = okP && okM && okO ? "✓" : "✗";
  console.log(
    `  ${flag} ${t.nome.padEnd(34)} P=${t.valorTerapeuta.toFixed(2).padStart(10)}  M=${t.valorNota.toFixed(2).padStart(10)}  O=${t.baseCalculo.toFixed(2).padStart(10)}  (${(t.pct * 100).toFixed(2)}%)`,
  );
});

// 3) Trava de conferência (ΣM == base)
const conf = conferir(base, calc);
console.log("\n── CONFERÊNCIA (trava sem ponta solta) ──");
console.log(
  `  ΣNotas = ${fmtBRL(conf.somaNotas)}  |  base = ${fmtBRL(conf.base)}  |  dif = ${fmtBRL(conf.difBase)}  ${conf.ok ? "✓" : "✗"}`,
);
console.log(`  ΣTerapeutas (soma das NFs delas) = ${fmtBRL(conf.somaTerapeutas)}`);
if (!conf.ok) falhas++;

// 4) Amostra da discriminação (Adriana) vs a NF real
console.log("\n── DISCRIMINAÇÃO (amostra: Adriana, ISS 2,39 / trib 3,67) ──");
console.log(
  montarDiscriminacao({
    mesAno: "AGOSTO/2026",
    terapeutaNome: calc[0].nome,
    cnpjMei: calc[0].cnpjMei,
    valorTerapeuta: calc[0].valorTerapeuta,
    aliquotaIss: 2.39,
    aliquotaTributos: 3.67,
  })
    .split("\n")
    .map((l) => "    " + l)
    .join("\n"),
);

console.log(
  `\n${falhas === 0 ? "✅ F1 OK — todos os números batem com a planilha." : `❌ F1 FALHOU — ${falhas} divergência(s).`}`,
);
process.exit(falhas === 0 ? 0 : 1);
