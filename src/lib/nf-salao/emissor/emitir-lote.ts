// Emissão em LOTE da NFS-e Nacional de uma competência (uma NF por terapeuta).
// Fluxo por nota (as já emitidas são puladas):
//   reserva nDPS (sequencial por unidade) → monta DPS → emite no governo (mTLS A1)
//   → sucesso: grava chaveAcesso + nº da NFS-e + status EMITIDA; falha: coleta o erro.
// NÃO atende Higienópolis (Lucro Presumido = emissão municipal SP, outro caminho).

import { prisma } from "@/lib/prisma";
import { slugPorId } from "@/lib/nf-salao/unidades";
import { getEmissor, type ModoEmissor } from "@/lib/nf-salao/emissor";
import { carregarCredencial, ambienteAtual } from "@/lib/nf-salao/emissor/config";
import { montarDpsDaNota, type EmpresaParaDps, type CompetenciaParaDps } from "@/lib/nf-salao/emissor/mapa-dps";
import type { Ambiente } from "@/lib/nf-salao/emissor/types";

export interface ItemResultadoLote {
  notaId: number;
  terapeutaNome: string;
  ok: boolean;
  chaveAcesso?: string;
  numeroNfse?: string | null;
  erro?: string;
}
export interface ResultadoEmitirLote {
  ambiente: Ambiente;
  total: number;
  emitidas: number;
  jaEmitidas: number;
  falhas: number;
  itens: ItemResultadoLote[];
}

/** Reserva (atômico) o próximo nº sequencial da unidade — é o nDPS do padrão nacional. */
async function reservarRps(unidadeId: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const seq = await tx.rpsSequencia.upsert({
      where: { unidadeId }, update: {}, create: { unidadeId, proximoRps: 1 },
    });
    const n = seq.proximoRps;
    await tx.rpsSequencia.update({ where: { unidadeId }, data: { proximoRps: n + 1 } });
    return n;
  });
}

const fmtErro = (e?: { codigo: string; descricao: string }[]) =>
  (e ?? []).map((x) => `${x.codigo} ${x.descricao}`).join(" · ") || "Falha na emissão.";

/**
 * Emite (ou re-tenta) as notas pendentes da competência via Emissor Nacional.
 * Precisa do certificado A1 configurado p/ a unidade (config.ts). Mês deve estar fechado?
 * Não exigimos aqui — a tela controla; mas só emite notas com valor e discriminação.
 */
export async function emitirLote(ano: number, mes: number, unidadeId: number): Promise<ResultadoEmitirLote> {
  const slug = slugPorId(unidadeId);
  if (!slug) throw new Error(`Unidade ${unidadeId} sem slug.`);
  // Backend por município: 6 unidades da capital (incl. Higienópolis) = Nota do Milhão (SP);
  // Metrópole (São Bernardo) = GINFES.
  const modo: ModoEmissor = slug === "shopping-metropole" ? "municipal-ginfes" : "municipal-sp";

  const cred = carregarCredencial(slug); // lança erro claro se o A1 não estiver configurado
  const ambiente = ambienteAtual();
  const emissor = getEmissor(modo, ambiente);

  const mesRow = await prisma.nfSalaoMes.findUnique({
    where: { unidadeId_ano_mes: { unidadeId, ano, mes } },
  });
  if (!mesRow) throw new Error(`Competência ${mes}/${ano} não encontrada.`);
  const empresa = await prisma.empresa.findFirst({ where: { unidadeSlug: slug } });
  if (!empresa) throw new Error(`Empresa não cadastrada para '${slug}' (cadastre em /empresas).`);

  const notas = await prisma.nfSalaoTerapeuta.findMany({
    where: { nfSalaoMesId: mesRow.id },
    orderBy: { terapeutaNome: "asc" },
  });

  const comp: CompetenciaParaDps = {
    ano: mesRow.ano, mes: mesRow.mes,
    aliquotaIss: mesRow.aliquotaIss, aliquotaTributos: mesRow.aliquotaTributos,
  };
  const emp: EmpresaParaDps = {
    cnpj: empresa.cnpj, inscricaoMunicipal: empresa.inscricaoMunicipal, razaoSocial: empresa.razaoSocial,
    logradouro: empresa.logradouro, numero: empresa.numero, complemento: empresa.complemento,
    bairro: empresa.bairro, cep: empresa.cep, uf: empresa.uf,
  };

  const res: ResultadoEmitirLote = {
    ambiente, total: notas.length, emitidas: 0, jaEmitidas: 0, falhas: 0, itens: [],
  };

  for (const nota of notas) {
    if (nota.status === "EMITIDA" || nota.chaveAcesso) {
      res.jaEmitidas++;
      res.itens.push({ notaId: nota.id, terapeutaNome: nota.terapeutaNome, ok: true, chaveAcesso: nota.chaveAcesso ?? undefined, numeroNfse: nota.nfSalaoNumero });
      continue;
    }

    // nDPS: usa o que a nota já tem; senão reserva um novo e persiste (não reaproveita em gaps).
    let ndps = nota.rps;
    if (ndps == null) {
      ndps = await reservarRps(unidadeId);
      await prisma.nfSalaoTerapeuta.update({ where: { id: nota.id }, data: { rps: ndps } });
    }

    const dps = montarDpsDaNota(
      { valorNota: nota.valorNota, discriminacao: nota.discriminacao },
      comp, emp, slug, { numero: ndps },
    );

    try {
      const r = await emissor.emitir(dps, cred);
      if (r.ok) {
        // Grava EMITIDA só quando há nº/chave de verdade (produção). Em homologação
        // (ex. TesteEnvioLoteRPS de SP) valida sem gerar nota → não marca EMITIDA.
        if (r.numeroNfse || r.chaveAcesso) {
          await prisma.nfSalaoTerapeuta.update({
            where: { id: nota.id },
            data: {
              chaveAcesso: r.chaveAcesso ?? nota.chaveAcesso,
              codVerificacao: r.codVerificacao ?? nota.codVerificacao,
              nfSalaoNumero: r.numeroNfse ?? nota.nfSalaoNumero,
              status: "EMITIDA",
              emitidaEm: new Date(),
            },
          });
        }
        res.emitidas++;
        res.itens.push({ notaId: nota.id, terapeutaNome: nota.terapeutaNome, ok: true, chaveAcesso: r.chaveAcesso, numeroNfse: r.numeroNfse });
      } else {
        res.falhas++;
        res.itens.push({ notaId: nota.id, terapeutaNome: nota.terapeutaNome, ok: false, erro: fmtErro(r.erros) });
      }
    } catch (e) {
      res.falhas++;
      res.itens.push({ notaId: nota.id, terapeutaNome: nota.terapeutaNome, ok: false, erro: (e as Error)?.message ?? "Erro na emissão." });
    }
  }

  return res;
}
