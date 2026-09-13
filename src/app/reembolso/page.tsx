'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Ticket, Loader2, RefreshCw, Info, Gift, ChevronDown, ChevronRight, Trash2, Plus, Lock, LockOpen, Printer } from 'lucide-react'

// ─── Tipos (espelham /api/reembolso/[ano]/[mes]) ────────────────────────────────
interface Linha {
  reembolsoUnidadeId: number | null
  unidadeId: number
  nome: string
  slug: string
  vouchers: number
  acrescimo7: number
  omnichannel: number
  cortesiaReembolso: number
  cortesiaUsada: number
  compras: number
  comprasEfetiva: number
  treinamento: number
  treinamentoEfetivo: number
  royaltiesMkt: number
  faturamentoCaixa: number
  pex: boolean
  isHigienopolis: boolean
  total: number
  valorRecebido: number
  conciliado: boolean
  fetchedAt: string | null
  puxado: boolean
  comprasItens: { id: number; descricao: string; valor: number }[]
  treinamentoItens: { id: number; terapeuta: string }[]
}
interface Resumo {
  ano: number; mes: number; status: string
  linhas: Linha[]
  totais: Record<string, number>
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Mês de referência padrão: o mês anterior (reembolso é pago no dia 10 do mês seguinte).
function mesReferenciaPadrao() {
  const d = new Date()
  let mes = d.getMonth() // 0..11 → mês anterior (getMonth já é 0-based = mês passado 1-based)
  let ano = d.getFullYear()
  if (mes === 0) { mes = 12; ano -= 1 }
  return { ano, mes }
}

export default function ReembolsoPage() {
  const inicial = mesReferenciaPadrao()
  const [ano, setAno] = useState(inicial.ano)
  const [mes, setMes] = useState(inicial.mes)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // edições locais dos campos manuais: `${unidadeId}:${campo}` → string
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [comprasAberta, setComprasAberta] = useState<number | null>(null) // unidadeId com editor de compras aberto
  const [royaltiesAberta, setRoyaltiesAberta] = useState<number | null>(null)
  const [treinoAberta, setTreinoAberta] = useState<number | null>(null)
  const [novo, setNovo] = useState<{ desc: string; val: string }>({ desc: '', val: '' })
  const [novoTerapeuta, setNovoTerapeuta] = useState('')
  const [belleBusy, setBelleBusy] = useState<number | null>(null)

  const carregar = useCallback(async (a: number, m: number) => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch(`/api/reembolso/${a}/${m}`, { cache: 'no-store' })
      if (!r.ok) { setErro(r.status === 403 ? 'Acesso restrito (somente Daniana).' : `Erro ${r.status}`); setResumo(null); return }
      const j: Resumo = await r.json()
      setResumo(j); setEdits({})
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e)); setResumo(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar(ano, mes) }, [ano, mes, carregar])

  async function salvarManual(unidadeId: number, campo: 'compras' | 'treinamento' | 'faturamentoCaixa', valorStr: string) {
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0
    await fetch(`/api/reembolso/${ano}/${mes}/manual`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId, [campo]: valor }),
    })
    await carregar(ano, mes)
  }

  function editKey(u: number, c: string) { return `${u}:${c}` }
  function valorCampo(l: Linha, campo: 'compras' | 'treinamento' | 'faturamentoCaixa' | 'valorRecebido') {
    const k = editKey(l.unidadeId, campo)
    if (edits[k] !== undefined) return edits[k]
    return brl(l[campo])
  }

  async function salvarConciliacao(unidadeId: number, valorStr: string) {
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0
    await fetch(`/api/reembolso/${ano}/${mes}/conciliacao`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId, valorRecebido: valor }),
    })
    await carregar(ano, mes)
  }
  async function toggleConciliado(l: Linha) {
    await fetch(`/api/reembolso/${ano}/${mes}/conciliacao`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId: l.unidadeId, conciliado: !l.conciliado }),
    })
    await carregar(ano, mes)
  }

  async function togglePex(l: Linha) {
    await fetch(`/api/reembolso/${ano}/${mes}/manual`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId: l.unidadeId, pex: !l.pex }),
    })
    await carregar(ano, mes)
  }

  async function addCompraItem(unidadeId: number) {
    const valor = parseFloat(novo.val.replace(/\./g, '').replace(',', '.')) || 0
    if (!valor && !novo.desc.trim()) return
    await fetch(`/api/reembolso/${ano}/${mes}/compras`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId, descricao: novo.desc.trim() || 'Compra', valor }),
    })
    setNovo({ desc: '', val: '' })
    await carregar(ano, mes)
  }

  async function removeCompraItem(id: number) {
    await fetch(`/api/reembolso/compras/${id}`, { method: 'DELETE' })
    await carregar(ano, mes)
  }

  async function addTreinamentoItem(unidadeId: number) {
    const terapeuta = novoTerapeuta.trim()
    if (!terapeuta) return
    await fetch(`/api/reembolso/${ano}/${mes}/treinamentos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId, terapeuta }),
    })
    setNovoTerapeuta('')
    await carregar(ano, mes)
  }

  async function removeTreinamentoItem(id: number) {
    await fetch(`/api/reembolso/treinamentos/${id}`, { method: 'DELETE' })
    await carregar(ano, mes)
  }

  async function puxarFaturamentoBelle(unidadeId: number) {
    setBelleBusy(unidadeId); setErro(null)
    try {
      const r = await fetch(`/api/reembolso/${ano}/${mes}/faturamento-belle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidadeId }),
      })
      const j = await r.json()
      if (!j.ok) setErro('Belle: ' + (j.error || 'falha ao puxar faturamento'))
      await carregar(ano, mes)
    } catch (e) {
      setErro('Belle: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setBelleBusy(null) }
  }

  const fechado = resumo?.status === 'FECHADO'
  async function alternarFechamento() {
    const novoStatus = fechado ? 'ABERTO' : 'FECHADO'
    if (novoStatus === 'FECHADO' && !confirm(`Fechar ${MESES[mes - 1]}/${ano}? O mês fica só-leitura (dá pra reabrir depois).`)) return
    await fetch(`/api/reembolso/${ano}/${mes}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    })
    await carregar(ano, mes)
  }

  const t = resumo?.totais
  const puxados = resumo?.linhas.filter((l) => l.puxado).length ?? 0

  return (
    <div className="p-4 md:p-8 max-w-[1400px] w-full">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-[#7E0000] flex items-center justify-center text-[#DDC7A4]">
          <Ticket size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#392617]">Reembolso de Vouchers</h1>
          <p className="text-xs text-[#392617]/60">Conferência mensal — valores a reembolsar da rede (pago dia 10)</p>
        </div>
      </div>

      {/* Barra: seletor de mês + status */}
      <div className="flex flex-wrap items-center gap-3 mt-4 mb-4">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617]">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617]">
          {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => carregar(ano, mes)}
          className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617] hover:bg-[#F5F0EB] flex items-center gap-2">
          <RefreshCw size={15} /> Atualizar
        </button>
        <Link href="/reembolso/cortesias" className="px-3 py-2 rounded-lg border border-[#D78B18] text-[#7E0000] text-sm hover:bg-[#F5F0EB] flex items-center gap-2">
          <Gift size={15} /> Controle de Cortesias
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-[#392617]/70">{puxados}/7 puxadas</span>
          {resumo && (
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${fechado ? 'bg-[#7E0000] text-[#DDC7A4]' : 'bg-[#425F1D]/15 text-[#425F1D]'}`}>
              {fechado ? '🔒 Fechado' : 'Aberto'}
            </span>
          )}
          <Link href={`/reembolso/impressao?ano=${ano}&mes=${mes}`} target="_blank"
            className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617] hover:bg-[#F5F0EB] flex items-center gap-2">
            <Printer size={15} /> Imprimir
          </Link>
          <button onClick={alternarFechamento}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${fechado ? 'border border-[#7E0000] text-[#7E0000] hover:bg-[#F5F0EB]' : 'bg-[#7E0000] text-[#DDC7A4] hover:bg-[#5c0000]'}`}>
            {fechado ? <><LockOpen size={15} /> Reabrir mês</> : <><Lock size={15} /> Fechar mês</>}
          </button>
        </div>
      </div>
      {fechado && (
        <div className="mb-4 rounded-lg bg-[#7E0000]/10 border border-[#7E0000]/30 text-[#7E0000] text-sm px-4 py-2 flex items-center gap-2">
          <Lock size={15} /> Mês fechado — só leitura. Clique em <b>Reabrir mês</b> para editar.
        </div>
      )}

      {/* Como puxar — via extensão Reembolso Auto */}
      <div className="mb-5 rounded-xl border border-[#D78B18]/40 bg-[#FBF6EF] p-4">
        <div className="flex items-start gap-2 text-sm text-[#392617]">
          <Info size={18} className="text-[#D78B18] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Como puxar os dados de {MESES[mes - 1]}/{ano}:</p>
            <p className="text-[#392617]/80">
              Abra a extensão <b>🧘 Reembolso Auto</b> no Chrome, escolha o mês e clique <b>Sincronizar agora</b> —
              ela loga nas 7 unidades sozinha e envia tudo pra cá. Depois clique <b>Atualizar</b> aqui em cima.
            </p>
          </div>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{erro}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#392617]/50"><Loader2 className="animate-spin mr-2" /> Carregando…</div>
      ) : resumo ? (
        <div className="overflow-x-auto rounded-xl border border-[#DDC7A4] bg-white">
          <table className="w-full text-sm min-w-[1280px]">
            <thead>
              <tr className="bg-[#7E0000] text-[#DDC7A4] text-xs">
                <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-[#7E0000]">Unidade</th>
                <th className="text-right px-2 py-2.5 font-semibold">Vouchers</th>
                <th className="text-right px-2 py-2.5 font-semibold">+7%</th>
                <th className="text-right px-2 py-2.5 font-semibold">Omni</th>
                <th className="text-right px-2 py-2.5 font-semibold">Cortesias</th>
                <th className="text-right px-2 py-2.5 font-semibold">Compras</th>
                <th className="text-right px-2 py-2.5 font-semibold">Treino</th>
                <th className="text-right px-2 py-2.5 font-semibold">Royalties/Mkt</th>
                <th className="text-right px-3 py-2.5 font-semibold">A reembolsar</th>
                <th className="text-right px-2 py-2.5 font-semibold">Conciliação</th>
              </tr>
            </thead>
            <tbody>
              {resumo.linhas.map((l) => {
                const comprasOpen = comprasAberta === l.unidadeId
                const royOpen = royaltiesAberta === l.unidadeId
                const treinoOpen = treinoAberta === l.unidadeId
                return (
                <Fragment key={l.unidadeId}>
                <tr className="border-t border-[#F0E8DC] hover:bg-[#FBF6EF]">
                  <td className="px-3 py-2 sticky left-0 bg-white">
                    <span className="font-medium text-[#392617]">{l.nome}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] ${l.puxado ? 'text-[#425F1D]' : 'text-[#D78B18]'}`}>
                        {l.puxado ? `puxado ${l.fetchedAt ? new Date(l.fetchedAt).toLocaleDateString('pt-BR') : ''}` : 'pendente WP'}
                      </span>
                      <label className="flex items-center gap-1 text-[10px] text-[#425F1D] cursor-pointer" title="Participa do PEX? (−20% compras + treino grátis)">
                        <input type="checkbox" checked={l.pex} disabled={fechado} onChange={() => togglePex(l)} className="accent-[#425F1D]" /> PEX
                      </label>
                    </div>
                  </td>
                  <td className="text-right px-2 tabular-nums text-[#392617]">{brl(l.vouchers)}</td>
                  <td className="text-right px-2 tabular-nums text-[#392617]/70">{brl(l.acrescimo7)}</td>
                  <td className="text-right px-2 tabular-nums text-[#392617]/70">{brl(l.omnichannel)}</td>
                  <td className="text-right px-2 tabular-nums text-[#392617]/70" title={`Usado: R$ ${brl(l.cortesiaUsada)}`}>{brl(l.cortesiaReembolso)}</td>
                  {/* Compras — mostra o valor JÁ com desconto PEX; abre o editor de itens */}
                  <td className="text-right px-1">
                    <button onClick={() => { setComprasAberta(comprasOpen ? null : l.unidadeId); setNovo({ desc: '', val: '' }) }}
                      title={l.pex && l.compras !== l.comprasEfetiva ? `Bruto R$ ${brl(l.compras)} · PEX −20%` : undefined}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#DDC7A4] hover:border-[#D78B18] text-[#392617] tabular-nums">
                      {comprasOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} R$ {brl(l.comprasEfetiva)}
                    </button>
                  </td>
                  {/* Treino — terapeutas (R$1.000 cada); célula = valor efetivo (PEX ⇒ 0) */}
                  <td className="text-right px-1">
                    <button onClick={() => { setTreinoAberta(treinoOpen ? null : l.unidadeId); setNovoTerapeuta('') }}
                      title={l.pex ? 'PEX: treino grátis' : undefined}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#DDC7A4] hover:border-[#D78B18] text-[#392617] tabular-nums">
                      {treinoOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} R$ {brl(l.treinamentoEfetivo)}
                    </button>
                  </td>
                  {/* Royalties/Mkt — mostra o valor; memória de cálculo no expansor (só Higienópolis) */}
                  <td className="text-right px-1">
                    {l.isHigienopolis ? (
                      <button onClick={() => setRoyaltiesAberta(royOpen ? null : l.unidadeId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#DDC7A4] hover:border-[#D78B18] text-[#392617] tabular-nums">
                        {royOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} R$ {brl(l.royaltiesMkt)}
                      </button>
                    ) : (
                      <span className="text-[#392617]/30">—</span>
                    )}
                  </td>
                  <td className="text-right px-3 tabular-nums font-bold text-[#7E0000]">{brl(l.total)}</td>
                  {/* Conciliação — valor recebido em conta vs a reembolsar (editável mesmo fechado) */}
                  <td className="px-1 text-right">
                    <input inputMode="decimal" value={valorCampo(l, 'valorRecebido')}
                      onChange={(e) => setEdits((p) => ({ ...p, [editKey(l.unidadeId, 'valorRecebido')]: e.target.value }))}
                      onBlur={(e) => salvarConciliacao(l.unidadeId, e.target.value)}
                      placeholder="recebido"
                      className="w-24 text-right px-2 py-1 rounded border border-[#DDC7A4] text-[#392617] focus:border-[#D78B18] focus:outline-none" />
                    <div className="flex items-center justify-end gap-2 mt-0.5">
                      {l.valorRecebido > 0 && (
                        Math.abs(l.valorRecebido - l.total) < 0.01
                          ? <span className="text-[9px] text-[#425F1D] font-semibold">✓ confere</span>
                          : <span className="text-[9px] text-[#7E0000]">dif {brl(l.valorRecebido - l.total)}</span>
                      )}
                      <label className="flex items-center gap-1 text-[10px] text-[#425F1D] cursor-pointer" title="Marcar como conferido">
                        <input type="checkbox" checked={l.conciliado} onChange={() => toggleConciliado(l)} className="accent-[#425F1D]" /> ok
                      </label>
                    </div>
                  </td>
                </tr>
                {comprasOpen && (
                  <tr className="bg-[#FBF6EF]">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="max-w-lg">
                        <div className="font-semibold text-xs text-[#392617] mb-2">Compras de {l.nome} — memória de cálculo</div>
                        {l.comprasItens.length === 0 && <p className="text-xs text-[#392617]/50 mb-2">Nenhum item lançado ainda.</p>}
                        <div className="space-y-1">
                          {l.comprasItens.map((it) => (
                            <div key={it.id} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1 border border-[#F0E8DC]">
                              <span className="flex-1 text-[#392617]">{it.descricao}</span>
                              <span className="tabular-nums text-[#392617]">R$ {brl(it.valor)}</span>
                              <button onClick={() => removeCompraItem(it.id)} disabled={fechado} className="text-[#7E0000] hover:text-red-700 disabled:opacity-30" title="Remover"><Trash2 size={13} /></button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input placeholder="descrição (ex.: óleos)" value={novo.desc} disabled={fechado} onChange={(e) => setNovo((p) => ({ ...p, desc: e.target.value }))}
                            className="flex-1 px-2 py-1 rounded border border-[#DDC7A4] text-xs text-[#392617] focus:border-[#D78B18] focus:outline-none disabled:bg-[#F5F0EB]" />
                          <input inputMode="decimal" placeholder="valor" value={novo.val} disabled={fechado} onChange={(e) => setNovo((p) => ({ ...p, val: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') addCompraItem(l.unidadeId) }}
                            className="w-24 text-right px-2 py-1 rounded border border-[#DDC7A4] text-xs text-[#392617] focus:border-[#D78B18] focus:outline-none disabled:bg-[#F5F0EB]" />
                          <button onClick={() => addCompraItem(l.unidadeId)} disabled={fechado} className="px-2 py-1 rounded bg-[#7E0000] text-[#DDC7A4] hover:bg-[#5c0000] disabled:opacity-40 flex items-center gap-1 text-xs"><Plus size={13} /> Add</button>
                        </div>
                        <div className="text-xs mt-2 text-[#392617]/80">
                          Total compras: <b>R$ {brl(l.compras)}</b>
                          {l.pex && <span className="text-[#425F1D]"> · PEX −20% ⇒ efetivo R$ {brl(l.comprasEfetiva)}</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {l.isHigienopolis && royOpen && (
                  <tr className="bg-[#FBF6EF]">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="max-w-lg">
                        <div className="font-semibold text-xs text-[#392617] mb-2">Royalties / Mkt de {l.nome} — memória de cálculo</div>
                        <div className="flex items-center gap-2 text-xs">
                          <label className="text-[#392617]/70">Faturamento caixa do mês:</label>
                          <div className="flex items-center gap-1">
                            <span className="text-[#392617]/40">R$</span>
                            <input inputMode="decimal" value={valorCampo(l, 'faturamentoCaixa')} readOnly={fechado}
                              onChange={(e) => setEdits((p) => ({ ...p, [editKey(l.unidadeId, 'faturamentoCaixa')]: e.target.value }))}
                              onBlur={(e) => salvarManual(l.unidadeId, 'faturamentoCaixa', e.target.value)}
                              className="w-32 text-right px-2 py-1 rounded border border-[#DDC7A4] text-[#392617] focus:border-[#D78B18] focus:outline-none" />
                          </div>
                          <button onClick={() => puxarFaturamentoBelle(l.unidadeId)} disabled={fechado || belleBusy === l.unidadeId}
                            className="px-2 py-1 rounded bg-[#425F1D] text-white hover:bg-[#37501a] disabled:opacity-50 inline-flex items-center gap-1">
                            {belleBusy === l.unidadeId ? <><Loader2 size={12} className="animate-spin" /> puxando…</> : <><RefreshCw size={12} /> Puxar do Belle</>}
                          </button>
                        </div>
                        <div className="text-xs mt-2 text-[#392617]/80">
                          Royalties 6% = <b>R$ {brl(l.faturamentoCaixa * 0.06)}</b> · Mkt 2% = <b>R$ {brl(l.faturamentoCaixa * 0.02)}</b> · Total 8% = <b className="text-[#7E0000]">R$ {brl(l.royaltiesMkt)}</b>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {treinoOpen && (
                  <tr className="bg-[#FBF6EF]">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="max-w-lg">
                        <div className="font-semibold text-xs text-[#392617] mb-2">Treinamentos de {l.nome} — terapeutas (R$ 1.000 cada)</div>
                        {l.treinamentoItens.length === 0 && <p className="text-xs text-[#392617]/50 mb-2">Nenhuma terapeuta lançada ainda.</p>}
                        <div className="space-y-1">
                          {l.treinamentoItens.map((it) => (
                            <div key={it.id} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1 border border-[#F0E8DC]">
                              <span className="flex-1 text-[#392617]">{it.terapeuta}</span>
                              <span className="tabular-nums text-[#392617]/70">R$ 1.000,00</span>
                              <button onClick={() => removeTreinamentoItem(it.id)} disabled={fechado} className="text-[#7E0000] hover:text-red-700 disabled:opacity-30" title="Remover"><Trash2 size={13} /></button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input placeholder="nome da terapeuta" value={novoTerapeuta} disabled={fechado} onChange={(e) => setNovoTerapeuta(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addTreinamentoItem(l.unidadeId) }}
                            className="flex-1 px-2 py-1 rounded border border-[#DDC7A4] text-xs text-[#392617] focus:border-[#D78B18] focus:outline-none disabled:bg-[#F5F0EB]" />
                          <button onClick={() => addTreinamentoItem(l.unidadeId)} disabled={fechado} className="px-2 py-1 rounded bg-[#7E0000] text-[#DDC7A4] hover:bg-[#5c0000] disabled:opacity-40 flex items-center gap-1 text-xs"><Plus size={13} /> Add</button>
                        </div>
                        <div className="text-xs mt-2 text-[#392617]/80">
                          {l.treinamentoItens.length} treinamento(s) × R$ 1.000 = <b>R$ {brl(l.treinamento)}</b>
                          {l.pex && <span className="text-[#425F1D]"> · PEX ⇒ grátis (efetivo R$ 0,00)</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#7E0000] bg-[#F5F0EB] font-bold text-[#392617]">
                <td className="px-3 py-2.5 sticky left-0 bg-[#F5F0EB]">TOTAL REDE</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.vouchers ?? 0)}</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.acrescimo7 ?? 0)}</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.omnichannel ?? 0)}</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.cortesiaReembolso ?? 0)}</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.comprasEfetiva ?? 0)}</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.treinamentoEfetivo ?? 0)}</td>
                <td className="text-right px-2 tabular-nums">{brl(t?.royaltiesMkt ?? 0)}</td>
                <td className="text-right px-3 tabular-nums text-[#7E0000] text-base">{brl(t?.total ?? 0)}</td>
                <td className="text-right px-2 tabular-nums text-xs">
                  {brl(t?.valorRecebido ?? 0)}
                  <div className="text-[9px] font-normal text-[#392617]/60">{t?.conciliadas ?? 0}/7 conferidas</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  )
}
