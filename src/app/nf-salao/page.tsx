"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Scale,
  Loader2,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lock,
  FileText,
} from "lucide-react";

// ─── Tipos (espelham /api/nf-salao/[ano]/[mes]) ─────────────────────────────────
interface Terapeuta {
  id: number;
  terapeutaNome: string;
  cnpjMei: string;
  comissao: number;
  diasCredito: number;
  valorTerapeuta: number;
  pct: number;
  valorNota: number;
  baseCalculo: number;
  rps: number | null;
  nfSalaoNumero: string | null;
  nfComissaoNumero: string | null;
  nfCreditoNumero: string | null;
  discriminacao: string;
  status: string;
}
interface Competencia {
  existe: boolean;
  ano: number;
  mes: number;
  status: string;
  aliquotaIss: number;
  aliquotaTributos: number;
  base: {
    faturamentoCaixa: number;
    reembolsoVoucher: number;
    reembolsoGympass: number;
    reembolsoTotalpass: number;
    notasAvulsas: number;
    valorBase: number;
    faturamentoFonte: string | null;
    reembolsoFonte: string | null;
  };
  terapeutas: Terapeuta[];
  totais: {
    comissao: number;
    diasCredito: number;
    somaTerapeutas: number;
    somaNotas: number;
    somaBaseCalculo: number;
    difBase: number;
  };
  proximoRps: number | null;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = (n: number) => (n * 100).toFixed(2).replace(".", ",") + "%";

export default function NfSalaoPage() {
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(8);
  const [comp, setComp] = useState<Competencia | null>(null);
  const [disponiveis, setDisponiveis] = useState<{ ano: number; mes: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  const carregar = useCallback(async (a: number, m: number) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch(`/api/nf-salao/${a}/${m}`, { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json()).error || "Erro ao carregar");
      const j = await r.json();
      setComp(j.competencia);
      setDisponiveis(j.disponiveis || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
      setComp(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(ano, mes);
  }, [ano, mes, carregar]);

  const copiar = async (t: Terapeuta) => {
    try {
      await navigator.clipboard.writeText(t.discriminacao);
      setCopiado(t.id);
      setTimeout(() => setCopiado((c) => (c === t.id ? null : c)), 1800);
    } catch {
      /* clipboard indisponível */
    }
  };

  const b = comp?.base;
  const conferido = comp && Math.abs(comp.totais.difBase) <= 0.05;

  return (
    <div className="p-5 md:p-8 max-w-[1200px] w-full mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4D8C1] pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[#7E0000] text-[11px] font-semibold uppercase tracking-[0.15em]">
            <Scale className="w-3.5 h-3.5" /> Controle Fiscal · Lei do Salão Parceiro
          </div>
          <h1 className="text-2xl md:text-[28px] font-semibold text-[#392617] mt-1">
            Emissão de Notas do Salão
          </h1>
          <p className="text-sm text-[#6b5645] mt-0.5">
            Buddha Spa Anália Franco · <b>Sol Central</b> — CNPJ 29.714.058/0001-89
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-lg border border-[#E4D8C1] bg-white px-3 py-2 text-sm text-[#392617]"
          >
            {MESES.map((nm, i) => (
              <option key={i} value={i + 1}>{nm}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-lg border border-[#E4D8C1] bg-white px-3 py-2 text-sm text-[#392617]"
          >
            {[2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[#6b5645] py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando competência…
        </div>
      )}

      {!loading && erro && (
        <div className="flex items-center gap-2 text-[#7E0000] bg-[#f8e9e9] border border-[#e6c9c9] rounded-xl p-4">
          <Lock className="w-4 h-4" /> {erro}
        </div>
      )}

      {!loading && comp && !comp.existe && (
        <div className="text-center text-[#6b5645] py-16">
          <FileText className="w-8 h-8 mx-auto mb-3 text-[#c9b79a]" />
          Nenhuma competência lançada para <b>{MESES_LONGO[mes - 1]}/{ano}</b> ainda.
          {disponiveis.length > 0 && (
            <div className="mt-3 text-sm">
              Disponível:{" "}
              {disponiveis.map((d) => (
                <button
                  key={`${d.ano}-${d.mes}`}
                  onClick={() => { setAno(d.ano); setMes(d.mes); }}
                  className="text-[#7E0000] underline mx-1"
                >
                  {MESES[d.mes - 1]}/{d.ano}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && comp && comp.existe && b && (
        <>
          {/* Banner de conferência */}
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-5 text-sm font-medium ${
              conferido
                ? "bg-[#e9efdd] text-[#425F1D] border border-[#cdddb0]"
                : "bg-[#fbf0d8] text-[#8a5a10] border border-[#e8d3a3]"
            }`}
          >
            {conferido ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {conferido ? (
              <>Conferido — a soma das {comp.terapeutas.length} notas ({brl(comp.totais.somaNotas)}) bate com a base ({brl(b.valorBase)}).</>
            ) : (
              <>Atenção — a soma das notas ({brl(comp.totais.somaNotas)}) diverge da base ({brl(b.valorBase)}) em {brl(comp.totais.difBase)}.</>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${comp.status === "FECHADO" ? "bg-[#425F1D]" : "bg-[#D78B18]"}`} />
              {comp.status === "FECHADO" ? "Mês fechado" : "Em aberto"}
            </span>
          </div>

          {/* Base + KPIs */}
          <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-4 mb-6">
            <div className="bg-white border border-[#E4D8C1] rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#7E0000] mb-3">
                Base a emitir · {MESES_LONGO[mes - 1]}/{ano}
              </div>
              {[
                { l: "Faturamento em caixa", s: b.faturamentoFonte || "Belle", v: b.faturamentoCaixa, op: "+", tag: "gestão" },
                { l: "Reembolso de voucher", s: b.reembolsoFonte || "líquido (mês anterior)", v: b.reembolsoVoucher, op: "+", tag: "gestão" },
                { l: "Gympass", s: "líquido recebido", v: b.reembolsoGympass, op: "+", tag: "manual" },
                { l: "TotalPass", s: "líquido recebido", v: b.reembolsoTotalpass, op: "+", tag: "manual" },
                { l: "Notas avulsas já emitidas", s: "abate da base", v: b.notasAvulsas, op: "−", tag: "manual" },
              ].map((row, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 py-2 border-b border-dashed border-[#E4D8C1]">
                  <div className="flex flex-col">
                    <span className="text-[#392617] text-sm flex items-center gap-2">
                      {row.l}
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${row.tag === "gestão" ? "text-[#425F1D] bg-[#e9efdd]" : "text-[#B5791A] bg-[#f6ecd8]"}`}>
                        {row.tag}
                      </span>
                    </span>
                    <span className="text-[11px] text-[#8a7866]">{row.s}</span>
                  </div>
                  <span className="tabular-nums text-[#392617]">
                    <span className={`inline-block w-3.5 font-bold ${row.op === "−" ? "text-[#9a2b2b]" : "text-[#B5791A]"}`}>{row.op}</span>
                    {brl(row.v)}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between mt-3 pt-3 border-t-2 border-[#7E0000]">
                <span className="font-bold text-[#7E0000] uppercase text-sm tracking-wide">Valor base para emissão</span>
                <span className="text-2xl font-bold text-[#7E0000] tabular-nums">{brl(b.valorBase)}</span>
              </div>
            </div>

            <div className="grid grid-rows-4 gap-3">
              <Kpi label="Total que o salão vai emitir" value={brl(b.valorBase)} accent />
              <Kpi label="Notas do salão (1 por terapeuta)" value={String(comp.terapeutas.length)} />
              <Kpi label="Soma das NFs das terapeutas (ΣP)" value={brl(comp.totais.somaTerapeutas)} />
              <Kpi label="Próximo RPS da unidade" value={comp.proximoRps != null ? String(comp.proximoRps) : "—"} />
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-[#E4D8C1] rounded-2xl overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#7E0000]">Notas por terapeuta</div>
              <div className="text-[11px] uppercase tracking-wide text-[#8a7866]">valor da nota = base × % de contribuição</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="bg-[#7E0000] text-[#f6ead6] text-[11px] uppercase tracking-wide">
                    <th className="text-left font-semibold px-3 py-2.5">Terapeuta</th>
                    <th className="text-right font-semibold px-3 py-2.5">Valor dela · P</th>
                    <th className="text-right font-semibold px-3 py-2.5">%</th>
                    <th className="text-right font-semibold px-3 py-2.5">Valor da NF · M</th>
                    <th className="text-right font-semibold px-3 py-2.5">Base ISS · O</th>
                    <th className="text-right font-semibold px-3 py-2.5">RPS</th>
                    <th className="text-right font-semibold px-3 py-2.5">NF</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {comp.terapeutas.map((t) => (
                    <NfRow
                      key={t.id}
                      t={t}
                      aberta={aberta === t.id}
                      onToggle={() => setAberta((a) => (a === t.id ? null : t.id))}
                      onCopy={() => copiar(t)}
                      copiado={copiado === t.id}
                      aliquotaIss={comp.aliquotaIss}
                      aliquotaTributos={comp.aliquotaTributos}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#fbf5ea] border-t-2 border-[#7E0000] font-bold text-[#392617]">
                    <td className="text-left px-3 py-3 text-[#7E0000] uppercase text-xs tracking-wide">Totais</td>
                    <td className="text-right px-3 py-3 tabular-nums">{brl(comp.totais.somaTerapeutas)}</td>
                    <td className="text-right px-3 py-3 tabular-nums">100%</td>
                    <td className="text-right px-3 py-3 tabular-nums text-[#B5791A]">{brl(comp.totais.somaNotas)}</td>
                    <td className="text-right px-3 py-3 tabular-nums">{brl(comp.totais.somaBaseCalculo)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-[#8a7866]">
            Alíquota do mês: ISS {comp.aliquotaIss.toFixed(2).replace(".", ",")}% · tributos aprox. {comp.aliquotaTributos.toFixed(2).replace(".", ",")}%.
            Código do serviço 06.02.01 (prefeitura SP 08516). Clique em uma terapeuta para ver a discriminação pronta pra colar.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border rounded-2xl px-4 flex items-center justify-between gap-2 ${accent ? "border-[#E4D8C1] bg-gradient-to-b from-white to-[#fdf7ee]" : "border-[#E4D8C1] bg-white"}`}>
      <span className="text-[12.5px] text-[#6b5645] max-w-[55%]">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${accent ? "text-[#B5791A]" : "text-[#392617]"}`}>{value}</span>
    </div>
  );
}

function NfRow({
  t, aberta, onToggle, onCopy, copiado, aliquotaIss, aliquotaTributos,
}: {
  t: Terapeuta; aberta: boolean; onToggle: () => void; onCopy: () => void;
  copiado: boolean; aliquotaIss: number; aliquotaTributos: number;
}) {
  return (
    <>
      <tr className="border-b border-[#E4D8C1] odd:bg-[#FBF8F3] hover:bg-[#f6ecdb] cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {aberta ? <ChevronDown className="w-3.5 h-3.5 text-[#8a7866]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8a7866]" />}
            <div>
              <div className="font-semibold text-[#392617] text-sm">{t.terapeutaNome}</div>
              <div className="text-[11px] text-[#8a7866] tabular-nums">{t.cnpjMei}</div>
            </div>
          </div>
        </td>
        <td className="text-right px-3 py-2.5 tabular-nums text-[#392617]">{brl(t.valorTerapeuta)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums">{pctFmt(t.pct)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums font-bold text-[#B5791A]">{brl(t.valorNota)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-[#6b5645]">{brl(t.baseCalculo)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums font-bold text-[#7E0000]">{t.rps ?? "—"}</td>
        <td className="text-right px-3 py-2.5 tabular-nums">{t.nfSalaoNumero ?? "—"}</td>
        <td className="px-2 py-2.5"></td>
      </tr>
      {aberta && (
        <tr className="bg-[#fbfaf7]">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#7E0000]">Discriminação — pronta pra colar</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCopy(); }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7E0000] border border-[#E4D8C1] bg-white px-2.5 py-1.5 rounded-lg hover:bg-[#f6ecdb]"
                  >
                    {copiado ? <><Check className="w-3.5 h-3.5 text-[#425F1D]" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#40342a] bg-white border border-[#E4D8C1] border-l-[3px] border-l-[#D78B18] rounded-lg p-3 font-sans">
{t.discriminacao}
                </pre>
              </div>
              <div className="text-sm">
                <FieldRow k="Código do serviço (SP)" v="08516 · 06.02.01" />
                <FieldRow k="Alíquota ISS / tributos" v={`${aliquotaIss.toFixed(2).replace(".", ",")}% / ${aliquotaTributos.toFixed(2).replace(".", ",")}%`} />
                <FieldRow k="RPS (sequencial interno)" v={t.rps != null ? String(t.rps) : "—"} />
                <FieldRow k="NF da terapeuta — comissão" v={t.nfComissaoNumero ?? "—"} />
                <FieldRow k="NF da terapeuta — dias de crédito" v={t.nfCreditoNumero ?? "—"} />
                <FieldRow k="Valor da terapeuta · P (dedução)" v={brl(t.valorTerapeuta)} />
                <FieldRow k="Base de cálculo do ISS · O" v={brl(t.baseCalculo)} />
                <FieldRow k="Valor total da nota · M" v={brl(t.valorNota)} big />
                <FieldRow k="NF emitida" v={t.nfSalaoNumero ?? "—"} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FieldRow({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-[#E4D8C1] last:border-0">
      <span className="text-[#6b5645]">{k}</span>
      <span className={`font-semibold text-right tabular-nums ${big ? "text-[#B5791A] text-base" : "text-[#392617]"}`}>{v}</span>
    </div>
  );
}
