// Verificação da camada de dados F3: usa o Prisma client real (mesmo setup do app)
// pra ler a competência de agosto e conferir os totais. Rodar:
//   DATABASE_URL="file:./dev.db" node scripts/nf-salao/check-dados.ts
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../src/generated/prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");

const url = process.env.DATABASE_URL || "file:./dev.db";
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });

const mes = await prisma.nfSalaoMes.findUnique({
  where: { unidadeId_ano_mes: { unidadeId: 2, ano: 2026, mes: 8 } },
});
if (!mes) {
  console.log("❌ competência não encontrada");
  process.exit(1);
}
const ter = await prisma.nfSalaoTerapeuta.findMany({
  where: { nfSalaoMesId: mes.id },
  orderBy: { terapeutaNome: "asc" },
});
const seq = await prisma.rpsSequencia.findUnique({ where: { unidadeId: 2 } });

const r2 = (n: number) => Math.round(n * 100) / 100;
const somaM = r2(ter.reduce((s: number, t: any) => s + t.valorNota, 0));
const somaP = r2(ter.reduce((s: number, t: any) => s + t.valorTerapeuta, 0));

console.log("Competência:", mes.mes + "/" + mes.ano, "| status", mes.status);
console.log("Base:", mes.valorBase, "| alíquota ISS", mes.aliquotaIss, "/ trib", mes.aliquotaTributos);
console.log("Terapeutas:", ter.length, "| ΣvalorNota(M)=", somaM, "| ΣvalorTerapeuta(P)=", somaP);
console.log("Próximo RPS (Anália):", seq?.proximoRps);
console.log("Primeira:", ter[0].terapeutaNome, "| M=", ter[0].valorNota, "| RPS=", ter[0].rps, "| NF=", ter[0].nfSalaoNumero);
console.log("Discriminação (1ª linha):", ter[0].discriminacao.split("\n")[0]);
console.log(Math.abs(somaM - mes.valorBase) <= 0.05 ? "✅ conferência OK (ΣM ≈ base)" : "❌ ΣM diverge da base");
await prisma.$disconnect();
