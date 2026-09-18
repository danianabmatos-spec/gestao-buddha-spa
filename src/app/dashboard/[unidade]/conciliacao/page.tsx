'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { RefreshCw, RotateCw, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUnidadeNome } from '@/lib/belle/unidades-config'

// ─── Tipos ──────────────────────────────────────────────────────────────────────
interface Celula { status: 'ok' | 'divergente' | 'pendente' | 'vazio'; diferenca: number; qtdDivergencias: number; total: number }
interface DiaGrade { dia: string; diaNum: number; celulas: Record<string, Celula>; total: number }
interface MesData { ano: number; mes: number; colunas: string[]; dias: DiaGrade[]; totaisDivergencias: Record<string, number> }

interface Divergencia {
  id: number; data: string; tipo: string; formaPagamento: string | null
  valorEsperado: number; valorEncontrado: number; diferenca: number
  status: string; justificativa: string | null; tratadaPorNome: string | null
  codigo?: string | null; cliente?: string | null; servico?: string | null
}
interface Resumo { totalBelle: number; totalConciliado: number; qtdMovimentacoes: number; qtdAbertas: number; status: string }
interface Caixa { fundoAbertura: number | null; valorFechamento: number | null; saidas: number }
interface PorForma { formaPagamento: string; qtd: number; total: number }
interface DiaDetalhe { resumo: Resumo | null; caixa: Caixa | null; porForma: PorForma[]; divergencias: Divergencia[] }

const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const ABERTAS = ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA']
const TIPO_LABEL: Record<string, string> = {
  FALTA_NO_BELLE: 'Pagamento não lançado no Belle',
  VALOR_DIVERGENTE: 'Valor divergente',
  SOBRA_NO_BELLE: 'Lançamento sem pagamento',
  SEM_CHECKIN: 'Check-in de parceiro faltando',
  SEM_VALIDACAO: 'Voucher usado sem validação (reembolso em risco)',
  DESCONTO: 'Desconto dado',
  CORTESIA: 'Cortesia sem autorização',
}

function hoje() {
  const s = new Date().toLocaleDateString('en-CA')
  return { ano: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)), dia: s }
}

// ─── Célula da tabela do mês ────────────────────────────────────────────────────
function CelulaMes({ cel, onClick }: { cel: Celula; onClick: () => void }) {
  if (cel.status === 'vazio') return <td className="px-3 py-2 text-center text-muted-foreground/30">·</td>
  if (cel.status === 'ok') return <td className="px-3 py-2 text-center text-[#425F1D]">✓</td>
  if (cel.status === 'pendente') return <td className="px-3 py-2 text-center text-muted-foreground/60 text-xs">pend.</td>
  // divergente — mostra o valor da diferença, ou a quantidade quando não há valor (ex.: voucher)
  const rotulo = Math.abs(cel.diferenca) < 0.01 ? `${cel.qtdDivergencias}×` : brl(cel.diferenca)
  return (
    <td className="px-2 py-1.5 text-center">
      <button onClick={onClick}
        className="inline-flex items-center gap-1 rounded-md bg-[#7E0000]/10 hover:bg-[#7E0000]/20 text-[#7E0000] font-semibold text-xs px-2 py-1 transition-colors"
        title="Clique para corrigir">
        🔴 {rotulo}
      </button>
    </td>
  )
}

export default function ConciliacaoPage() {
  const params = useParams()
  const unidadeSlug = params.unidade as string

  const [modo, setModo] = useState<'mes' | 'dia'>('mes')
  const [ano, setAno] = useState(hoje().ano)
  const [mes, setMes] = useState(hoje().mes)
  const [mesData, setMesData] = useState<MesData | null>(null)
  const [carregandoMes, setCarregandoMes] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // detalhe do dia
  const [data, setData] = useState(hoje().dia)
  const [dia, setDia] = useState<DiaDetalhe | null>(null)
  const [carregandoDia, setCarregandoDia] = useState(false)
  const [justificandoId, setJustificandoId] = useState<number | null>(null)
  const [textoJust, setTextoJust] = useState('')
  const [acaoId, setAcaoId] = useState<number | null>(null)

  // ─── Mês ──────────────────────────────────────────────────────────────────────
  const carregarMes = useCallback(async () => {
    setCarregandoMes(true); setErro(null)
    try {
      const r = await fetch(`/api/conciliacao/mes?unidade=${unidadeSlug}&ano=${ano}&mes=${mes}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao carregar o mês'); setMesData(null); return }
      setMesData(j)
    } catch { setErro('Falha de conexão') } finally { setCarregandoMes(false) }
  }, [unidadeSlug, ano, mes])

  useEffect(() => { if (modo === 'mes') carregarMes() }, [modo, carregarMes])

  const mudarMes = (delta: number) => {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }
    setMes(m); setAno(a)
  }

  const sincronizarMes = useCallback(async () => {
    setSincronizando(true); setErro(null)
    try {
      const mm = String(mes).padStart(2, '0')
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const h = hoje()
      const ehMesAtual = ano === h.ano && mes === h.mes
      const dataFim = ehMesAtual ? h.dia : `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}`
      const r = await fetch('/api/conciliacao/sincronizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade: unidadeSlug, dataIni: `${ano}-${mm}-01`, dataFim }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao sincronizar'); return }
      await carregarMes()
    } catch { setErro('Falha ao sincronizar') } finally { setSincronizando(false) }
  }, [unidadeSlug, ano, mes, carregarMes])

  // ─── Dia (detalhe) ──────────────────────────────────────────────────────────────
  const carregarDia = useCallback(async (d: string) => {
    setCarregandoDia(true); setErro(null)
    try {
      const r = await fetch(`/api/conciliacao/dia?unidade=${unidadeSlug}&data=${d}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao carregar o dia'); setDia(null); return }
      setDia(j)
    } catch { setErro('Falha de conexão') } finally { setCarregandoDia(false) }
  }, [unidadeSlug])

  const abrirDia = (d: string) => { setData(d); setModo('dia'); carregarDia(d) }
  const voltarAoMes = () => { setModo('mes'); setDia(null) }

  const tratar = useCallback(async (id: number, acao: string, justificativa?: string) => {
    setAcaoId(id); setErro(null)
    try {
      const r = await fetch('/api/conciliacao/divergencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, acao, justificativa }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao tratar'); return }
      setJustificandoId(null); setTextoJust('')
      await carregarDia(data)
    } finally { setAcaoId(null) }
  }, [carregarDia, data])

  // ─── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#7E0000]">Conciliação Financeira</h1>
          <p className="text-sm text-muted-foreground">{getUnidadeNome(unidadeSlug)}</p>
        </div>
      </div>

      {erro && <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 text-sm">{erro}</div>}

      {modo === 'mes' ? (
        <>
          {/* Navegação do mês */}
          <div className="rounded-lg border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => mudarMes(-1)} className="text-[#7E0000]"><ChevronLeft size={16} /></Button>
              <span className="text-sm font-medium text-foreground min-w-[140px] text-center">{MESES[mes]} / {ano}</span>
              <Button variant="ghost" size="sm" onClick={() => mudarMes(1)} className="text-[#7E0000]"><ChevronRight size={16} /></Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={sincronizarMes} disabled={sincronizando} size="sm" className="gap-1.5 bg-[#7E0000] hover:bg-[#5c0000] text-white">
                <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
                {sincronizando ? 'Sincronizando…' : 'Sincronizar o mês'}
              </Button>
              <Button onClick={carregarMes} disabled={carregandoMes} variant="ghost" size="sm" className="gap-1.5 text-[#7E0000]">
                <RotateCw size={13} className={carregandoMes ? 'animate-spin' : ''} /> Atualizar
              </Button>
            </div>
          </div>

          {/* Tabela do mês */}
          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#E4E5E2]/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Dia</th>
                  {(mesData?.colunas ?? ['Dinheiro', 'Cartão', 'Pix', 'TotalPass', 'Gympass', 'Voucher']).map((c) => (
                    <th key={c} className="px-3 py-2 text-center font-semibold">{c}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Total do dia</th>
                </tr>
              </thead>
              <tbody>
                {mesData?.dias.map((d) => {
                  const temDiv = mesData.colunas.some((c) => d.celulas[c].status === 'divergente')
                  return (
                    <tr key={d.dia} className="border-b last:border-0 hover:bg-[#E4E5E2]/20">
                      <td className="px-3 py-2">
                        <button onClick={() => abrirDia(d.dia)}
                          className={`font-medium ${temDiv ? 'text-[#7E0000]' : 'text-foreground'} hover:underline`}>
                          {String(d.diaNum).padStart(2, '0')}
                        </button>
                      </td>
                      {mesData.colunas.map((c) => (
                        <CelulaMes key={c} cel={d.celulas[c]} onClick={() => abrirDia(d.dia)} />
                      ))}
                      <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">{brl(d.total)}</td>
                    </tr>
                  )
                })}
                {mesData && mesData.dias.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum movimento neste mês. Clique em “Sincronizar o mês”.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span className="text-[#425F1D]">✓</span> conciliado</span>
            <span>🔴 divergência (clique para corrigir)</span>
            <span><span className="text-muted-foreground/60">pend.</span> aguardando dados da operadora/banco</span>
            <span><span className="text-muted-foreground/30">·</span> sem movimento</span>
          </div>
        </>
      ) : (
        <DiaView
          data={data} dia={dia} carregando={carregandoDia}
          onVoltar={voltarAoMes} onSincronizar={async () => {
            setSincronizando(true); setErro(null)
            try {
              const r = await fetch('/api/conciliacao/sincronizar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unidade: unidadeSlug, dataIni: data, dataFim: data }),
              })
              const j = await r.json()
              if (!r.ok || j.error) { setErro(j.error || 'Erro ao sincronizar'); return }
              await carregarDia(data)
            } finally { setSincronizando(false) }
          }} sincronizando={sincronizando}
          tratar={tratar} acaoId={acaoId}
          justificandoId={justificandoId} setJustificandoId={setJustificandoId}
          textoJust={textoJust} setTextoJust={setTextoJust}
        />
      )}
    </div>
  )
}

// ─── Detalhe do dia ───────────────────────────────────────────────────────────────
function DiaView(props: {
  data: string; dia: DiaDetalhe | null; carregando: boolean
  onVoltar: () => void; onSincronizar: () => void; sincronizando: boolean
  tratar: (id: number, acao: string, j?: string) => void; acaoId: number | null
  justificandoId: number | null; setJustificandoId: (n: number | null) => void
  textoJust: string; setTextoJust: (s: string) => void
}) {
  const { data, dia, onVoltar, onSincronizar, sincronizando, tratar, acaoId, justificandoId, setJustificandoId, textoJust, setTextoJust } = props
  const abertas = (dia?.divergencias ?? []).filter((d) => ABERTAS.includes(d.status))
  const fechadas = (dia?.divergencias ?? []).filter((d) => !ABERTAS.includes(d.status))
  const [d1, d2, d3] = data.split('-')

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1.5 text-[#7E0000]"><ArrowLeft size={15} /> Voltar ao mês</Button>
        <span className="text-sm font-medium text-foreground">{d3}/{d2}/{d1}</span>
        <Button onClick={onSincronizar} disabled={sincronizando} size="sm" className="gap-1.5 bg-[#7E0000] hover:bg-[#5c0000] text-white">
          <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} /> {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
        </Button>
      </div>

      {dia?.resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">Total no Belle</p><p className="text-lg font-semibold">{brl(dia.resumo.totalBelle)}</p></div>
          <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">Conciliado</p><p className="text-lg font-semibold text-[#425F1D]">{brl(dia.resumo.totalConciliado)}</p></div>
          <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">Movimentações</p><p className="text-lg font-semibold">{dia.resumo.qtdMovimentacoes}</p></div>
          <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted-foreground">Divergências abertas</p><p className={`text-lg font-semibold ${dia.resumo.qtdAbertas ? 'text-[#7E0000]' : 'text-[#425F1D]'}`}>{dia.resumo.qtdAbertas}</p></div>
        </div>
      )}

      {dia?.caixa && (
        <div className="rounded-lg border bg-white p-3 text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
          <span>Fundo de abertura: <b className="text-foreground">{brl(dia.caixa.fundoAbertura)}</b></span>
          <span>Fechamento: <b className="text-foreground">{dia.caixa.valorFechamento == null ? '—' : brl(dia.caixa.valorFechamento)}</b></span>
          <span>Sangrias: <b className="text-foreground">{brl(dia.caixa.saidas)}</b></span>
        </div>
      )}

      {dia && dia.porForma.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-foreground mb-2">Por forma de pagamento</p>
          <div className="divide-y">
            {dia.porForma.map((f) => (
              <div key={f.formaPagamento} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-foreground">{f.formaPagamento}</span>
                <span className="text-muted-foreground">{f.qtd} · {brl(f.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
          {abertas.length ? <AlertTriangle size={15} className="text-[#7E0000]" /> : <CheckCircle2 size={15} className="text-[#425F1D]" />}
          Divergências {abertas.length ? `(${abertas.length} aberta${abertas.length > 1 ? 's' : ''})` : '— tudo conciliado'}
        </p>
        {abertas.length === 0 && dia && (
          <p className="text-sm text-muted-foreground">
            {dia.caixa?.valorFechamento == null ? 'O caixa do dia ainda não foi fechado.' : 'Nenhuma divergência neste dia. 🎉'}
          </p>
        )}
        <div className="space-y-2">
          {abertas.map((d) => (
            <div key={d.id} className="rounded-lg border border-[#7E0000]/20 bg-[#7E0000]/[0.03] p-3">
              <p className="text-sm font-medium text-foreground">{TIPO_LABEL[d.tipo] ?? d.tipo}</p>
              {d.codigo && (
                <p className="text-xs text-foreground">
                  Código: <b className="font-mono">{d.codigo}</b>
                  {d.cliente ? <> · {d.cliente}</> : null}
                  {d.servico ? <span className="text-muted-foreground"> · {d.servico}</span> : null}
                </p>
              )}
              {Math.abs(d.diferenca) >= 0.01 && (
                <p className="text-xs text-muted-foreground">
                  {d.formaPagamento} · Belle {brl(d.valorEsperado)} vs real {brl(d.valorEncontrado)} · <b className="text-[#7E0000]">dif {brl(d.diferenca)}</b>
                </p>
              )}
              {justificandoId === d.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea value={textoJust} onChange={(e) => setTextoJust(e.target.value)} placeholder="Motivo da justificativa…" rows={2} className="w-full rounded-md border px-2 py-1.5 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={acaoId === d.id || !textoJust.trim()} onClick={() => tratar(d.id, 'justificar', textoJust)} className="bg-[#7E0000] hover:bg-[#5c0000] text-white">Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setJustificandoId(null); setTextoJust('') }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={acaoId === d.id} onClick={() => tratar(d.id, 'reprocessar')} className="gap-1.5">
                    <RotateCw size={13} className={acaoId === d.id ? 'animate-spin' : ''} /> Reprocessar
                  </Button>
                  {d.status === 'ABERTA' && <Button size="sm" variant="ghost" disabled={acaoId === d.id} onClick={() => tratar(d.id, 'em_tratamento')}>Marcar em tratamento</Button>}
                  <Button size="sm" variant="ghost" disabled={acaoId === d.id} onClick={() => { setJustificandoId(d.id); setTextoJust('') }}>Justificar</Button>
                </div>
              )}
            </div>
          ))}
        </div>
        {fechadas.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer">{fechadas.length} resolvida(s)</summary>
            <div className="mt-2 space-y-1">
              {fechadas.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                  <span>{TIPO_LABEL[d.tipo] ?? d.tipo} · {d.codigo ? <b className="font-mono">{d.codigo}</b> : d.formaPagamento}{Math.abs(d.diferenca) >= 0.01 ? ` · dif ${brl(d.diferenca)}` : ''}</span>
                  <span className="text-[#425F1D]">{d.status}{d.tratadaPorNome ? ` · ${d.tratadaPorNome}` : ''}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  )
}
