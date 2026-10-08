"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Scale, Loader2, Check, Copy, ChevronDown, ChevronRight, AlertTriangle,
  Lock, FileText, LockOpen, Plus, Trash2, Save, Stamp, DownloadCloud, RefreshCw,
} from "lucide-react";

// ─── Tipos (espelham /api/nf-salao/[ano]/[mes]) ─────────────────────────────────
interface Terapeuta {
  id: number; terapeutaNome: string; cnpjMei: string; comissao: number; diasCredito: number;
  valorTerapeuta: number; pct: number; valorNota: number; baseCalculo: number; rps: number | null;
  nfSalaoNumero: string | null; nfComissaoNumero: string | null; nfCreditoNumero: string | null;
  codVerificacao?: string | null; discriminacao: string; status: string;
}
interface Base {
  faturamentoCaixa: number; reembolsoVoucher: number; reembolsoGympass: number;
  reembolsoTotalpass: number; notasAvulsas: number; valorBase: number;
  faturamentoFonte: string | null; reembolsoFonte: string | null;
}
interface Pendencia {
  nivel: "erro" | "aviso";
  codigo: string;
  escopo: "competencia" | "terapeuta";
  terapeutaId?: number;
  terapeutaNome?: string;
  mensagem: string;
}
interface Competencia {
  existe: boolean; ano: number; mes: number; status: string; aliquotaIss: number; aliquotaTributos: number;
  base: Base; terapeutas: Terapeuta[];
  totais: { comissao: number; diasCredito: number; somaTerapeutas: number; somaNotas: number; somaBaseCalculo: number; difBase: number };
  proximoRps: number | null;
  pendencias: Pendencia[];
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_LONGO = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
// Lê a resposta como JSON de forma segura: se vier HTML (erro 500/502/504 do servidor
// sob carga), não estoura "Unexpected token '<'" — devolve null e a UI mostra msg amigável.
async function lerJson(r: Response): Promise<Record<string, unknown> | null> {
  const txt = await r.text();
  try { return JSON.parse(txt) as Record<string, unknown>; } catch { return null; }
}
const msgErro = (r: Response, j: Record<string, unknown> | null): string =>
  (j?.error as string) || (r.status >= 500 ? "Servidor indisponível no momento — tente de novo em instantes." : `Erro (${r.status}).`);

const UNIDADES = [
  { slug: "shopping-metropole", nome: "Shopping Metrópole" },
  { slug: "analia-franco", nome: "Anália Franco" },
  { slug: "shopping-analia-franco", nome: "Shopping Anália Franco" },
  { slug: "perdizes", nome: "Perdizes" },
  { slug: "tatuape-gomescardim", nome: "Tatuapé Gomes Cardim" },
  { slug: "mooca-plaza", nome: "Mooca Plaza" },
  { slug: "higienopolis", nome: "Higienópolis" },
];
const brl = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = (n: number) => (n * 100).toFixed(2).replace(".", ",") + "%";
// aceita "1.234,56" ou "1234.56"
const parseNum = (s: string): number => {
  if (s == null) return 0;
  const t = String(s).trim();
  if (t === "") return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return isNaN(n) ? 0 : n;
};

export default function NfSalaoPage() {
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(8);
  const [comp, setComp] = useState<Competencia | null>(null);
  const [disponiveis, setDisponiveis] = useState<{ ano: number; mes: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [baseForm, setBaseForm] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [unidade, setUnidade] = useState("analia-franco");
  const [empresa, setEmpresa] = useState<{ razaoSocial: string; cnpj: string; inscricaoMunicipal: string; nomeFantasia: string } | null>(null);
  const [rpsForm, setRpsForm] = useState("");

  const editavel = comp?.existe && comp.status === "ABERTO";

  const syncBaseForm = (c: Competencia) => setBaseForm({
    faturamentoCaixa: String(c.base.faturamentoCaixa),
    reembolsoVoucher: String(c.base.reembolsoVoucher),
    reembolsoGympass: String(c.base.reembolsoGympass),
    reembolsoTotalpass: String(c.base.reembolsoTotalpass),
    notasAvulsas: String(c.base.notasAvulsas),
    aliquotaIss: String(c.aliquotaIss),
    aliquotaTributos: String(c.aliquotaTributos),
  });

  const carregar = useCallback(async (a: number, m: number, u: string) => {
    setLoading(true); setErro(null); setAviso(null);
    try {
      const r = await fetch(`/api/nf-salao/${a}/${m}?unidade=${u}`, { cache: "no-store" });
      const j = await lerJson(r);
      if (!r.ok || !j) throw new Error(msgErro(r, j));
      setComp(j.competencia as Competencia); setDisponiveis((j.disponiveis as typeof disponiveis) || []); setEmpresa((j.empresa as typeof empresa) ?? null);
      if ((j.competencia as Competencia)?.existe) syncBaseForm(j.competencia as Competencia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro"); setComp(null); setEmpresa(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(ano, mes, unidade); }, [ano, mes, unidade, carregar]);

  // POST de ação; atualiza comp com o retorno
  const acao = async (payload: Record<string, unknown>, method: "POST" | "PATCH" = "POST") => {
    setBusy(true); setErro(null); setAviso(null);
    try {
      const r = await fetch(`/api/nf-salao/${ano}/${mes}?unidade=${unidade}`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await lerJson(r);
      if (!r.ok || !j) throw new Error(msgErro(r, j));
      const c = j.competencia as Competencia;
      setComp(c);
      if (c?.existe) { syncBaseForm(c); setDisponiveis((d) => d.some((x) => x.ano === ano && x.mes === mes) ? d : [{ ano, mes, status: c.status }, ...d]); }
      return true;
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); return false; }
    finally { setBusy(false); }
  };

  const puxarFolha = async () => {
    setBusy(true); setErro(null); setAviso(null);
    try {
      const r = await fetch(`/api/nf-salao/${ano}/${mes}?unidade=${unidade}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "puxarFolha" }) });
      const j = await lerJson(r);
      if (!r.ok || !j) throw new Error(msgErro(r, j));
      const c = j.competencia as Competencia; setComp(c); if (c?.existe) syncBaseForm(c);
      const rz = j.resumo as { encontrado?: boolean; criados?: number; atualizados?: number; creditos?: number; cnpjCorrigidos?: unknown[] } | undefined;
      if (rz && !rz.encontrado) setAviso("A Folha ainda não tem fechamento para este mês.");
      else if (rz) setAviso(`Folha: ${rz.criados} terapeuta(s) criada(s), ${rz.atualizados} atualizada(s)${rz.cnpjCorrigidos?.length ? ` · ${rz.cnpjCorrigidos.length} CNPJ corrigido(s)` : ""}${rz.creditos ? ` · ${rz.creditos} com dias de crédito pago no mês` : ""}.`);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  };

  const puxarBaseGestao = async () => {
    setBusy(true); setErro(null); setAviso(null);
    try {
      const r = await fetch(`/api/nf-salao/${ano}/${mes}?unidade=${unidade}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "puxarBaseGestao" }) });
      const j = await lerJson(r);
      if (!r.ok || !j) throw new Error(msgErro(r, j));
      const c = j.competencia as Competencia; setComp(c); if (c?.existe) syncBaseForm(c);
      const rz = j.resumoBase as { competLabel?: string; faturamentoCaixa?: number; reembolsoLabel?: string; reembolsoVoucher?: number; reembolsoGympass?: number; reembolsoTotalpass?: number; reembolsoZerado?: boolean } | undefined;
      if (rz) setAviso(`Base puxada da Gestão — caixa de ${rz.competLabel}: ${brl(rz.faturamentoCaixa ?? 0)} · voucher líq. ${rz.reembolsoLabel}: ${brl(rz.reembolsoVoucher ?? 0)} · Gympass ${brl(rz.reembolsoGympass ?? 0)} · TotalPass ${brl(rz.reembolsoTotalpass ?? 0)}. Só as notas avulsas são manuais.${rz.reembolsoZerado ? " ⚠ Voucher do mês anterior veio zerado — confira a conciliação." : ""}`);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  };

  const atribuirRps = async () => {
    if (!confirm("Atribuir RPS a todas as terapeutas que ainda não têm? A numeração segue a ordem alfabética da tabela.")) return;
    setBusy(true); setErro(null); setAviso(null);
    try {
      const r = await fetch(`/api/nf-salao/${ano}/${mes}?unidade=${unidade}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "atribuirRps" }) });
      const j = await lerJson(r);
      if (!r.ok || !j) throw new Error(msgErro(r, j));
      const c = j.competencia as Competencia; setComp(c); if (c?.existe) syncBaseForm(c);
      const n = j.atribuidos as number | undefined;
      setAviso(n ? `RPS atribuído a ${n} terapeuta(s), em ordem alfabética.` : "Todas as terapeutas já tinham RPS.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  };

  const definirRps = async () => {
    const valor = parseInt(rpsForm, 10);
    if (!valor || valor < 1) { setErro("Informe um número de RPS válido (inteiro ≥ 1)."); return; }
    setBusy(true); setErro(null); setAviso(null);
    try {
      const r = await fetch(`/api/nf-salao/${ano}/${mes}?unidade=${unidade}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "definirRps", valor }) });
      const j = await lerJson(r);
      if (!r.ok || !j) throw new Error(msgErro(r, j));
      const c = j.competencia as Competencia; setComp(c); if (c?.existe) syncBaseForm(c);
      setRpsForm("");
      const n = j.renumeradas as number | undefined;
      setAviso(`Próximo RPS definido em ${valor}${n ? ` · ${n} nota(s) renumerada(s) a partir de ${valor}` : ""}.`);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  };

  const salvarBase = () => acao({
    faturamentoCaixa: parseNum(baseForm.faturamentoCaixa), reembolsoVoucher: parseNum(baseForm.reembolsoVoucher),
    reembolsoGympass: parseNum(baseForm.reembolsoGympass), reembolsoTotalpass: parseNum(baseForm.reembolsoTotalpass),
    notasAvulsas: parseNum(baseForm.notasAvulsas), aliquotaIss: parseNum(baseForm.aliquotaIss), aliquotaTributos: parseNum(baseForm.aliquotaTributos),
  }, "PATCH").then((ok) => ok && setAviso("Base salva e rateio recalculado."));

  const copiar = async (t: Terapeuta) => {
    try { await navigator.clipboard.writeText(t.discriminacao); setCopiado(t.id); setTimeout(() => setCopiado((c) => (c === t.id ? null : c)), 1800); } catch { /* */ }
  };

  const b = comp?.base;
  const conferido = comp && Math.abs(comp.totais.difBase) <= 0.05;
  // Pendências que impedem o fechamento (todas, menos "RPS não atribuído" — o fechar resolve).
  const bloqueantes = comp ? comp.pendencias.filter((p) => p.codigo !== "rps") : [];
  const podeFechar = bloqueantes.length === 0;

  return (
    <div className="p-5 md:p-8 max-w-[1200px] w-full mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4D8C1] pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[#7E0000] text-[11px] font-semibold uppercase tracking-[0.15em]">
            <Scale className="w-3.5 h-3.5" /> Controle Fiscal · Lei do Salão Parceiro
          </div>
          <h1 className="text-2xl md:text-[28px] font-semibold text-[#392617] mt-1">Emissão de Notas do Salão</h1>
          <p className="text-sm text-[#6b5645] mt-0.5">
            Buddha Spa {UNIDADES.find((u) => u.slug === unidade)?.nome ?? ""}
            {empresa
              ? <> · <b>{empresa.razaoSocial}</b> — CNPJ {empresa.cnpj}{empresa.inscricaoMunicipal ? ` · IM ${empresa.inscricaoMunicipal}` : ""}</>
              : <> · <span className="text-[#9a2b2b]">empresa não cadastrada — cadastre em /empresas</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {comp?.existe && (
            comp.status === "ABERTO" ? (
              <button disabled={busy || !podeFechar}
                title={podeFechar ? "" : `Resolva as ${bloqueantes.length} pendência(s) antes de fechar`}
                onClick={() => { if (confirm("Fechar a competência? O RPS será atribuído automaticamente (ordem alfabética) a quem ainda não tem, e o mês fica travado para edição.")) acao({ acao: "fechar" }); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#425F1D] hover:bg-[#374f18] px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <Lock className="w-4 h-4" /> Fechar mês
              </button>
            ) : (
              <button disabled={busy} onClick={() => acao({ acao: "reabrir" })}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7E0000] border border-[#E4D8C1] bg-white hover:bg-[#f6ecdb] px-3 py-2 rounded-lg disabled:opacity-50">
                <LockOpen className="w-4 h-4" /> Reabrir
              </button>
            )
          )}
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} title="Unidade" className="rounded-lg border border-[#E4D8C1] bg-white px-3 py-2 text-sm font-semibold text-[#7E0000]">
            {UNIDADES.map((u) => (<option key={u.slug} value={u.slug}>{u.nome}</option>))}
          </select>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-lg border border-[#E4D8C1] bg-white px-3 py-2 text-sm text-[#392617]">
            {MESES.map((nm, i) => (<option key={i} value={i + 1}>{nm}</option>))}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-[#E4D8C1] bg-white px-3 py-2 text-sm text-[#392617]">
            {[2026, 2027].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
      </div>

      {(erro || aviso) && (
        <div className={`flex items-center gap-2 rounded-xl p-3 mb-4 text-sm ${erro ? "text-[#7E0000] bg-[#f8e9e9] border border-[#e6c9c9]" : "text-[#425F1D] bg-[#e9efdd] border border-[#cdddb0]"}`}>
          {erro ? <Lock className="w-4 h-4" /> : <Check className="w-4 h-4" />}{erro || aviso}
        </div>
      )}

      {loading && (<div className="flex items-center gap-2 text-[#6b5645] py-16 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando competência…</div>)}

      {/* Mês inexistente → abrir */}
      {!loading && comp && !comp.existe && (
        <div className="text-center text-[#6b5645] py-16">
          <FileText className="w-8 h-8 mx-auto mb-3 text-[#c9b79a]" />
          Nenhuma competência lançada para <b>{MESES_LONGO[mes - 1]}/{ano}</b> ainda.
          <div className="mt-4">
            <button disabled={busy} onClick={() => acao({ acao: "abrir" })}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] px-4 py-2.5 rounded-lg disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Abrir competência de {MESES_LONGO[mes - 1]}/{ano}
            </button>
          </div>
          {disponiveis.length > 0 && (
            <div className="mt-4 text-sm">Disponível: {disponiveis.map((d) => (
              <button key={`${d.ano}-${d.mes}`} onClick={() => { setAno(d.ano); setMes(d.mes); }} className="text-[#7E0000] underline mx-1">{MESES[d.mes - 1]}/{d.ano}</button>
            ))}</div>
          )}
        </div>
      )}

      {!loading && comp && comp.existe && b && (
        <>
          {/* Banner de conferência */}
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-5 text-sm font-medium ${conferido ? "bg-[#e9efdd] text-[#425F1D] border border-[#cdddb0]" : "bg-[#fbf0d8] text-[#8a5a10] border border-[#e8d3a3]"}`}>
            {conferido ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {conferido ? (<>Conferido — a soma das {comp.terapeutas.length} notas ({brl(comp.totais.somaNotas)}) bate com a base ({brl(b.valorBase)}).</>)
              : (<>Atenção — a soma das notas ({brl(comp.totais.somaNotas)}) diverge da base ({brl(b.valorBase)}) em {brl(comp.totais.difBase)}.</>)}
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${comp.status === "FECHADO" ? "bg-[#425F1D]" : "bg-[#D78B18]"}`} />{comp.status === "FECHADO" ? "Mês fechado" : "Em aberto — editável"}
            </span>
          </div>

          {/* Pendências */}
          {comp.pendencias.length > 0 ? (
            <div className="bg-white border border-[#E4D8C1] rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#B5791A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#7E0000]">Pendências</span>
                <span className="text-[11px] text-[#8a7866]">
                  {bloqueantes.length > 0
                    ? `${bloqueantes.length} a resolver antes de fechar`
                    : "nada impede o fechamento"}
                  {comp.pendencias.some((p) => p.codigo === "rps") ? " · RPS será atribuído ao fechar" : ""}
                </span>
              </div>
              <ul className="space-y-1.5">
                {comp.pendencias.map((p, i) => (
                  <li key={i} onClick={() => { if (p.terapeutaId != null) setAberta(p.terapeutaId); }}
                    className={`flex items-start gap-2 text-sm ${p.terapeutaId != null ? "cursor-pointer hover:text-[#7E0000]" : ""}`}>
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${p.nivel === "erro" ? "bg-[#9a2b2b]" : "bg-[#D78B18]"}`} />
                    <span className="text-[#40342a]">{p.terapeutaNome ? <b>{p.terapeutaNome}: </b> : null}{p.mensagem}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5 text-sm bg-[#e9efdd] text-[#425F1D] border border-[#cdddb0]">
              <Check className="w-4 h-4" /> Sem pendências — pronto pra fechar e emitir.
            </div>
          )}

          {/* Base + KPIs */}
          <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-4 mb-6">
            <div className="bg-white border border-[#E4D8C1] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[#7E0000]">Base a emitir · {MESES_LONGO[mes - 1]}/{ano}</div>
                {editavel && (
                  <button disabled={busy} onClick={puxarBaseGestao} title="Puxa o caixa do mês (Belle) e o reembolso de voucher do mês anterior"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#7E0000] border border-[#E4D8C1] bg-white hover:bg-[#f6ecdb] px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Puxar da Gestão
                  </button>
                )}
              </div>
              {([
                { key: "faturamentoCaixa", l: "Faturamento em caixa", s: b.faturamentoFonte || "Belle", op: "+", tag: "gestão" },
                { key: "reembolsoVoucher", l: "Reembolso de voucher", s: b.reembolsoFonte || "líquido (mês anterior)", op: "+", tag: "gestão" },
                { key: "reembolsoGympass", l: "Gympass", s: "parcerias (mês anterior)", op: "+", tag: "gestão" },
                { key: "reembolsoTotalpass", l: "TotalPass", s: "parcerias (mês anterior)", op: "+", tag: "gestão" },
                { key: "notasAvulsas", l: "Notas avulsas já emitidas", s: "abate da base", op: "−", tag: "manual" },
              ] as const).map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-[#E4D8C1]">
                  <div className="flex flex-col">
                    <span className="text-[#392617] text-sm flex items-center gap-2">{row.l}
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${row.tag === "gestão" ? "text-[#425F1D] bg-[#e9efdd]" : "text-[#B5791A] bg-[#f6ecd8]"}`}>{row.tag}</span>
                    </span>
                    <span className="text-[11px] text-[#8a7866]">{row.s}</span>
                  </div>
                  {editavel ? (
                    <div className="flex items-center gap-1">
                      <span className={`font-bold ${row.op === "−" ? "text-[#9a2b2b]" : "text-[#B5791A]"}`}>{row.op}</span>
                      <input value={baseForm[row.key] ?? ""} onChange={(e) => setBaseForm((f) => ({ ...f, [row.key]: e.target.value }))}
                        inputMode="decimal" className="w-32 text-right tabular-nums rounded-md border border-[#E4D8C1] px-2 py-1 text-sm" />
                    </div>
                  ) : (
                    <span className="tabular-nums text-[#392617]"><span className={`inline-block w-3.5 font-bold ${row.op === "−" ? "text-[#9a2b2b]" : "text-[#B5791A]"}`}>{row.op}</span>{brl(b[row.key])}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-[#7E0000]">
                <span className="font-bold text-[#7E0000] uppercase text-sm tracking-wide">Valor base para emissão</span>
                <span className="text-2xl font-bold text-[#7E0000] tabular-nums">{brl(b.valorBase)}</span>
              </div>
              {editavel && (
                <div className="flex items-end justify-between gap-3 mt-4">
                  <div className="flex gap-3">
                    <label className="text-xs text-[#6b5645]">Alíquota ISS %
                      <input value={baseForm.aliquotaIss ?? ""} onChange={(e) => setBaseForm((f) => ({ ...f, aliquotaIss: e.target.value }))} inputMode="decimal" className="mt-1 block w-24 rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums" /></label>
                    <label className="text-xs text-[#6b5645]">Tributos aprox. %
                      <input value={baseForm.aliquotaTributos ?? ""} onChange={(e) => setBaseForm((f) => ({ ...f, aliquotaTributos: e.target.value }))} inputMode="decimal" className="mt-1 block w-24 rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums" /></label>
                  </div>
                  <button disabled={busy} onClick={salvarBase} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] px-3 py-2 rounded-lg disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar base
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-rows-4 gap-3">
              <Kpi label="Total que o salão vai emitir" value={brl(b.valorBase)} accent />
              <Kpi label="Notas do salão (1 por terapeuta)" value={String(comp.terapeutas.length)} />
              <Kpi label="Soma das NFs das terapeutas (ΣP)" value={brl(comp.totais.somaTerapeutas)} />
              <div className="border rounded-2xl px-4 flex items-center justify-between gap-2 border-[#E4D8C1] bg-white">
                <span className="text-[12.5px] text-[#6b5645]">Próximo RPS da unidade</span>
                {editavel ? (
                  <div className="flex items-center gap-1.5">
                    <input value={rpsForm} onChange={(e) => setRpsForm(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
                      placeholder={comp.proximoRps != null ? String(comp.proximoRps) : "—"}
                      className="w-20 text-right tabular-nums rounded-md border border-[#E4D8C1] px-2 py-1 text-sm" />
                    <button disabled={busy || !rpsForm} onClick={definirRps} title="Definir o próximo RPS desta unidade"
                      className="text-xs font-semibold text-[#7E0000] border border-[#E4D8C1] bg-white hover:bg-[#f6ecdb] px-2 py-1.5 rounded-md disabled:opacity-40">Definir</button>
                  </div>
                ) : (
                  <span className="text-xl font-bold tabular-nums text-[#392617]">{comp.proximoRps != null ? String(comp.proximoRps) : "—"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-[#E4D8C1] rounded-2xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#7E0000]">Notas por terapeuta</div>
              <div className="text-[11px] uppercase tracking-wide text-[#8a7866]">valor da nota = base × % de contribuição</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse">
                <thead>
                  <tr className="bg-[#7E0000] text-[#f6ead6] text-[11px] uppercase tracking-wide">
                    <th className="text-left font-semibold px-3 py-2.5">Terapeuta</th>
                    <th className="text-right font-semibold px-3 py-2.5">Comissão · G</th>
                    <th className="text-right font-semibold px-3 py-2.5">Dias créd. · F</th>
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
                    <NfRow key={t.id} t={t} editavel={!!editavel} busy={busy}
                      aberta={aberta === t.id} onToggle={() => setAberta((a) => (a === t.id ? null : t.id))}
                      onCopy={() => copiar(t)} copiado={copiado === t.id}
                      aliquotaIss={comp.aliquotaIss} aliquotaTributos={comp.aliquotaTributos}
                      onSalvar={(d) => acao({ acao: "editTerapeuta", id: t.id, terapeuta: d })}
                      onRemover={() => { if (confirm(`Remover ${t.terapeutaNome} desta competência?`)) acao({ acao: "removerTerapeuta", id: t.id }); }}
                      onEmitir={(d) => acao({ acao: "emitir", id: t.id, ...d })}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#fbf5ea] border-t-2 border-[#7E0000] font-bold text-[#392617]">
                    <td className="text-left px-3 py-3 text-[#7E0000] uppercase text-xs tracking-wide">Totais</td>
                    <td className="text-right px-3 py-3 tabular-nums">{brl(comp.totais.comissao)}</td>
                    <td className="text-right px-3 py-3 tabular-nums text-[#B5791A]">{brl(comp.totais.diasCredito)}</td>
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

          {/* Puxar da Folha + adicionar terapeuta */}
          {editavel && (
            <div className="mb-6">
              {!addOpen ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={busy} onClick={puxarFolha} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#425F1D] hover:bg-[#374f18] px-3 py-2 rounded-lg disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />} Puxar terapeutas da Folha
                  </button>
                  <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7E0000] border border-dashed border-[#c9b79a] bg-white hover:bg-[#f6ecdb] px-3 py-2 rounded-lg">
                    <Plus className="w-4 h-4" /> Adicionar manual
                  </button>
                  <button disabled={busy} onClick={atribuirRps} title="Dá o próximo RPS (ordem alfabética) a quem ainda não tem" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7E0000] border border-[#E4D8C1] bg-white hover:bg-[#f6ecdb] px-3 py-2 rounded-lg disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />} Atribuir RPS a todas
                  </button>
                  <span className="text-xs text-[#8a7866]">A Folha traz nome, CNPJ, comissão, nº da NF e os dias de crédito pagos no mês (aprovados na Folha).</span>
                </div>
              ) : (
                <AddTerapeutaForm busy={busy} onCancel={() => setAddOpen(false)}
                  onAdd={async (d) => { const ok = await acao({ acao: "addTerapeuta", terapeuta: d }); if (ok) setAddOpen(false); }} />
              )}
            </div>
          )}

          <p className="text-xs text-[#8a7866]">
            Alíquota do mês: ISS {comp.aliquotaIss.toFixed(2).replace(".", ",")}% · tributos aprox. {comp.aliquotaTributos.toFixed(2).replace(".", ",")}%.
            Código do serviço 06.02.01 (prefeitura SP 08516). {editavel ? "Clique numa terapeuta para editar valores, copiar a discriminação e registrar a NF emitida." : "Mês fechado — reabra para editar."}
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

const brl2 = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pnum = (s: string): number => { const t = String(s ?? "").trim(); if (!t) return 0; const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t); return isNaN(n) ? 0 : n; };

function NfRow({
  t, editavel, busy, aberta, onToggle, onCopy, copiado, aliquotaIss, aliquotaTributos, onSalvar, onRemover, onEmitir,
}: {
  t: Terapeuta; editavel: boolean; busy: boolean; aberta: boolean; onToggle: () => void; onCopy: () => void;
  copiado: boolean; aliquotaIss: number; aliquotaTributos: number;
  onSalvar: (d: Record<string, unknown>) => void; onRemover: () => void; onEmitir: (d: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({ comissao: String(t.comissao), diasCredito: String(t.diasCredito), cnpjMei: t.cnpjMei, nfComissaoNumero: t.nfComissaoNumero ?? "", nfCreditoNumero: t.nfCreditoNumero ?? "" });
  const [emit, setEmit] = useState({ nfSalaoNumero: t.nfSalaoNumero ?? "", codVerificacao: t.codVerificacao ?? "" });
  useEffect(() => { setF({ comissao: String(t.comissao), diasCredito: String(t.diasCredito), cnpjMei: t.cnpjMei, nfComissaoNumero: t.nfComissaoNumero ?? "", nfCreditoNumero: t.nfCreditoNumero ?? "" }); setEmit({ nfSalaoNumero: t.nfSalaoNumero ?? "", codVerificacao: t.codVerificacao ?? "" }); }, [t]);

  return (
    <>
      <tr className="border-b border-[#E4D8C1] odd:bg-[#FBF8F3] hover:bg-[#f6ecdb] cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {aberta ? <ChevronDown className="w-3.5 h-3.5 text-[#8a7866]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8a7866]" />}
            <div><div className="font-semibold text-[#392617] text-sm">{t.terapeutaNome}</div><div className="text-[11px] text-[#8a7866] tabular-nums">{t.cnpjMei || "— sem CNPJ —"}</div></div>
            {t.status === "EMITIDA" && <span className="ml-1 text-[9px] font-bold uppercase text-[#425F1D] bg-[#e9efdd] px-1.5 py-0.5 rounded">emitida</span>}
          </div>
        </td>
        <td className="text-right px-3 py-2.5 tabular-nums text-[#6b5645]">{brl2(t.comissao)}</td>
        <td className={`text-right px-3 py-2.5 tabular-nums ${t.diasCredito > 0 ? "text-[#B5791A] font-semibold" : "text-[#b9a992]"}`}>{brl2(t.diasCredito)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-[#392617]">{brl2(t.valorTerapeuta)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums">{pctFmt(t.pct)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums font-bold text-[#B5791A]">{brl2(t.valorNota)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums text-[#6b5645]">{brl2(t.baseCalculo)}</td>
        <td className="text-right px-3 py-2.5 tabular-nums font-bold text-[#7E0000]">{t.rps ?? "—"}</td>
        <td className="text-right px-3 py-2.5 tabular-nums">{t.nfSalaoNumero ?? "—"}</td>
        <td className="px-2 py-2.5"></td>
      </tr>
      {aberta && (
        <tr className="bg-[#fbfaf7]">
          <td colSpan={10} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#7E0000]">Discriminação — pronta pra colar</span>
                  <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7E0000] border border-[#E4D8C1] bg-white px-2.5 py-1.5 rounded-lg hover:bg-[#f6ecdb]">
                    {copiado ? <><Check className="w-3.5 h-3.5 text-[#425F1D]" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#40342a] bg-white border border-[#E4D8C1] border-l-[3px] border-l-[#D78B18] rounded-lg p-3 font-sans">{t.discriminacao}</pre>
              </div>
              <div className="text-sm" onClick={(e) => e.stopPropagation()}>
                {editavel ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <label className="text-xs text-[#6b5645]">Comissão (G)<input value={f.comissao} onChange={(e) => setF({ ...f, comissao: e.target.value })} inputMode="decimal" className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums text-right" /></label>
                      <label className="text-xs text-[#6b5645]">Dias de crédito (F)<input value={f.diasCredito} onChange={(e) => setF({ ...f, diasCredito: e.target.value })} inputMode="decimal" className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums text-right" /></label>
                      <label className="text-xs text-[#6b5645] col-span-2">CNPJ MEI<input value={f.cnpjMei} onChange={(e) => setF({ ...f, cnpjMei: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums" /></label>
                      <label className="text-xs text-[#6b5645]">NF comissão (nº)<input value={f.nfComissaoNumero} onChange={(e) => setF({ ...f, nfComissaoNumero: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums" /></label>
                      <label className="text-xs text-[#6b5645]">NF dias crédito (nº)<input value={f.nfCreditoNumero} onChange={(e) => setF({ ...f, nfCreditoNumero: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums" /></label>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <button disabled={busy} onClick={() => onSalvar({ comissao: pnum(f.comissao), diasCredito: pnum(f.diasCredito), cnpjMei: f.cnpjMei, nfComissaoNumero: f.nfComissaoNumero || null, nfCreditoNumero: f.nfCreditoNumero || null })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] px-2.5 py-1.5 rounded-lg disabled:opacity-50"><Save className="w-3.5 h-3.5" /> Salvar</button>
                      <button disabled={busy} onClick={onRemover} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7E0000] border border-[#E4D8C1] bg-white hover:bg-[#f8e9e9] px-2.5 py-1.5 rounded-lg disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Remover</button>
                    </div>
                    <div className="border-t border-[#E4D8C1] pt-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-[#7E0000] mb-2 flex items-center gap-1.5"><Stamp className="w-3.5 h-3.5" /> Registrar emissão {t.rps == null && "(vai atribuir o próximo RPS)"}</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <label className="text-xs text-[#6b5645]">Nº da NF emitida<input value={emit.nfSalaoNumero} onChange={(e) => setEmit({ ...emit, nfSalaoNumero: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm tabular-nums" /></label>
                        <label className="text-xs text-[#6b5645]">Código de verificação<input value={emit.codVerificacao} onChange={(e) => setEmit({ ...emit, codVerificacao: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1 text-sm" /></label>
                      </div>
                      <button disabled={busy} onClick={() => onEmitir({ nfSalaoNumero: emit.nfSalaoNumero, codVerificacao: emit.codVerificacao })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#425F1D] hover:bg-[#374f18] px-2.5 py-1.5 rounded-lg disabled:opacity-50"><Stamp className="w-3.5 h-3.5" /> {t.rps == null ? "Atribuir RPS e registrar" : "Salvar emissão"}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <FieldRow k="Código do serviço (SP)" v="08516 · 06.02.01" />
                    <FieldRow k="Alíquota ISS / tributos" v={`${aliquotaIss.toFixed(2).replace(".", ",")}% / ${aliquotaTributos.toFixed(2).replace(".", ",")}%`} />
                    <FieldRow k="RPS (sequencial interno)" v={t.rps != null ? String(t.rps) : "—"} />
                    <FieldRow k="NF da terapeuta — comissão" v={t.nfComissaoNumero ?? "—"} />
                    <FieldRow k="NF da terapeuta — dias de crédito" v={t.nfCreditoNumero ?? "—"} />
                    <FieldRow k="Valor da terapeuta · P (dedução)" v={brl2(t.valorTerapeuta)} />
                    <FieldRow k="Base de cálculo do ISS · O" v={brl2(t.baseCalculo)} />
                    <FieldRow k="Valor total da nota · M" v={brl2(t.valorNota)} big />
                    <FieldRow k="NF emitida · verificação" v={`${t.nfSalaoNumero ?? "—"}${t.codVerificacao ? " · " + t.codVerificacao : ""}`} />
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AddTerapeutaForm({ busy, onAdd, onCancel }: { busy: boolean; onAdd: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ terapeutaNome: "", cnpjMei: "", comissao: "", diasCredito: "" });
  return (
    <div className="bg-white border border-[#E4D8C1] rounded-2xl p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-[#7E0000] mb-3">Nova terapeuta na competência</div>
      <div className="grid md:grid-cols-4 gap-2">
        <label className="text-xs text-[#6b5645] md:col-span-2">Nome<input value={f.terapeutaNome} onChange={(e) => setF({ ...f, terapeutaNome: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-[#6b5645] md:col-span-2">CNPJ MEI<input value={f.cnpjMei} onChange={(e) => setF({ ...f, cnpjMei: e.target.value })} className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1.5 text-sm tabular-nums" /></label>
        <label className="text-xs text-[#6b5645]">Comissão (G)<input value={f.comissao} onChange={(e) => setF({ ...f, comissao: e.target.value })} inputMode="decimal" className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1.5 text-sm tabular-nums text-right" /></label>
        <label className="text-xs text-[#6b5645]">Dias de crédito (F)<input value={f.diasCredito} onChange={(e) => setF({ ...f, diasCredito: e.target.value })} inputMode="decimal" className="mt-1 block w-full rounded-md border border-[#E4D8C1] px-2 py-1.5 text-sm tabular-nums text-right" /></label>
      </div>
      <div className="flex gap-2 mt-3">
        <button disabled={busy || !f.terapeutaNome.trim()} onClick={() => onAdd({ terapeutaNome: f.terapeutaNome, cnpjMei: f.cnpjMei, comissao: pnum(f.comissao), diasCredito: pnum(f.diasCredito) })}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] px-3 py-2 rounded-lg disabled:opacity-50"><Plus className="w-4 h-4" /> Adicionar</button>
        <button onClick={onCancel} className="text-sm font-semibold text-[#6b5645] px-3 py-2 rounded-lg hover:bg-[#f6ecdb]">Cancelar</button>
      </div>
    </div>
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
