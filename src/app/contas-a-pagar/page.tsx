'use client'

import { useCallback, useEffect, useState } from 'react'
import { Wallet, Plus, Check, X, RotateCcw, RefreshCw } from 'lucide-react'

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaBR = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—')
const hojeYmd = () => new Date().toLocaleDateString('en-CA')

interface Titulo {
  id: number; descricao: string; fornecedorTexto: string; valor: number; parcela: number; totalParcelas: number
  dataCompetencia: string | null; dataVencimento: string | null; dataPagamento: string | null
  status: string; formaPagamento: string; planoContaId: number | null; planoConta: { nome: string } | null; origem: string
}
interface Conta { id: number; nome: string; tipo: string }

const STATUS_COR: Record<string, string> = {
  PREVISTO: 'bg-[#D78B18]/15 text-[#8a5a00]', PAGO: 'bg-[#425F1D]/15 text-[#425F1D]',
  CANCELADO: 'bg-[#392617]/10 text-[#392617]/50', VENCIDO: 'bg-[#7E0000]/12 text-[#7E0000]',
}

export default function ContasPagarPage() {
  const [unidades, setUnidades] = useState(UNIDADES)
  const [unidade, setUnidade] = useState('')
  const [ano, setAno] = useState(new Date().getFullYear())
  const [statusFiltro, setStatusFiltro] = useState('')
  const [titulos, setTitulos] = useState<Titulo[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState({ descricao: '', valor: '', totalParcelas: '1', dataVencimento: hojeYmd(), dataCompetencia: '', planoContaId: '', fornecedorTexto: '', formaPagamento: '' })

  useEffect(() => {
    fetch('/api/auth/permissoes').then(r => r.ok ? r.json() : null).then(j => {
      const us: string[] | null = j?.unidades ?? null
      const vis = us == null ? UNIDADES : UNIDADES.filter(u => us.includes(u.slug))
      setUnidades(vis); setUnidade(prev => prev || vis[0]?.slug || '')
    }).catch(() => setUnidade(UNIDADES[0].slug))
    fetch('/api/plano-contas').then(r => r.ok ? r.json() : null).then(j => { if (j?.contas) setContas(j.contas) }).catch(() => {})
  }, [])

  const carregar = useCallback(async () => {
    if (!unidade) return
    setCarregando(true); setErro(null)
    try {
      const qs = `unidade=${unidade}&ano=${ano}${statusFiltro ? `&status=${statusFiltro}` : ''}`
      const r = await fetch(`/api/financeiro/titulos?${qs}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro'); setTitulos([]); return }
      setTitulos(j.titulos)
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [unidade, ano, statusFiltro])
  useEffect(() => { carregar() }, [carregar])

  const contasPagar = contas.filter(c => c.tipo !== 'A Receber')

  const criar = async () => {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/financeiro/titulos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade, ...form }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao lançar'); return }
      setNovo(false); setForm({ descricao: '', valor: '', totalParcelas: '1', dataVencimento: hojeYmd(), dataCompetencia: '', planoContaId: '', fornecedorTexto: '', formaPagamento: '' })
      await carregar()
    } finally { setSalvando(false) }
  }

  const acao = async (id: number, body: Record<string, unknown>) => {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/financeiro/titulos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json(); if (!r.ok || j.error) { setErro(j.error || 'Erro'); return }
      await carregar()
    } finally { setSalvando(false) }
  }

  const statusEfetivo = (t: Titulo) => t.status === 'PREVISTO' && t.dataVencimento && t.dataVencimento < hojeYmd() ? 'VENCIDO' : t.status
  const soma = (f: (t: Titulo) => boolean) => titulos.filter(f).reduce((s, t) => s + t.valor, 0)
  const totPrev = soma(t => t.status === 'PREVISTO')
  const totPago = soma(t => t.status === 'PAGO')
  const totVenc = soma(t => statusEfetivo(t) === 'VENCIDO')

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Wallet className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Contas a Pagar</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">Títulos a pagar por unidade — alimentam a DRE (competência) e o Fluxo de Caixa (vencimento/pagamento).</p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={unidade} onChange={e => setUnidade(e.target.value)} className="rounded-md border border-[#DDC7A4] px-3 py-1.5 text-sm bg-white">
          {unidades.map(u => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
        </select>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} className="rounded-md border border-[#DDC7A4] px-3 py-1.5 text-sm bg-white">
          <option value="">Todos os status</option>
          <option value="PREVISTO">Previsto</option>
          <option value="PAGO">Pago</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setAno(ano - 1)} className="px-2 py-1 rounded hover:bg-[#7E0000]/10 text-[#7E0000]">←</button>
          <span className="font-medium min-w-[48px] text-center">{ano}</span>
          <button onClick={() => setAno(ano + 1)} className="px-2 py-1 rounded hover:bg-[#7E0000]/10 text-[#7E0000]">→</button>
        </div>
        <button onClick={carregar} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-md border border-[#7E0000]/30 text-[#7E0000] hover:bg-[#7E0000]/5 px-3 py-1.5 text-sm">
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
        <button onClick={() => setNovo(v => !v)} className="inline-flex items-center gap-1.5 rounded-md bg-[#7E0000] hover:bg-[#5c0000] text-white px-3 py-1.5 text-sm font-medium ml-auto">
          <Plus size={15} /> Lançar título
        </button>
      </div>

      {erro && <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 text-sm mb-4">{erro}</div>}

      {/* Form de lançamento */}
      {novo && (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="col-span-2 md:col-span-3 text-xs text-[#392617]/70">Descrição
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" placeholder="Ex.: Aluguel setembro" />
          </label>
          <label className="text-xs text-[#392617]/70">Valor (R$)
            <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} type="number" step="0.01" className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-[#392617]/70">Parcelas
            <input value={form.totalParcelas} onChange={e => setForm({ ...form, totalParcelas: e.target.value })} type="number" min="1" max="60" className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-[#392617]/70">Conta (plano)
            <select value={form.planoContaId} onChange={e => setForm({ ...form, planoContaId: e.target.value })} className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm bg-white">
              <option value="">(a classificar)</option>
              {contasPagar.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#392617]/70">Vencimento (1ª parcela)
            <input value={form.dataVencimento} onChange={e => setForm({ ...form, dataVencimento: e.target.value })} type="date" className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-[#392617]/70">Competência (opcional)
            <input value={form.dataCompetencia} onChange={e => setForm({ ...form, dataCompetencia: e.target.value })} type="date" className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-[#392617]/70">Fornecedor
            <input value={form.fornecedorTexto} onChange={e => setForm({ ...form, fornecedorTexto: e.target.value })} className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" />
          </label>
          <div className="col-span-2 md:col-span-3 flex gap-2">
            <button onClick={criar} disabled={salvando || !form.descricao || !form.valor} className="rounded-md bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 text-white px-4 py-1.5 text-sm font-medium">Salvar</button>
            <button onClick={() => setNovo(false)} className="rounded-md text-[#392617]/60 hover:bg-[#392617]/5 px-4 py-1.5 text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
        <div className="rounded-lg border border-[#DDC7A4]/60 bg-white px-3 py-2"><div className="font-bold text-[#8a5a00]">{brl(totPrev)}</div><div className="text-xs text-[#392617]/60">Previsto</div></div>
        <div className="rounded-lg border border-[#DDC7A4]/60 bg-white px-3 py-2"><div className="font-bold text-[#425F1D]">{brl(totPago)}</div><div className="text-xs text-[#392617]/60">Pago</div></div>
        <div className={`rounded-lg border px-3 py-2 ${totVenc > 0 ? 'border-[#7E0000] bg-[#7E0000]/5' : 'border-[#DDC7A4]/60 bg-white'}`}><div className="font-bold text-[#7E0000]">{brl(totVenc)}</div><div className="text-xs text-[#392617]/60">Vencido em aberto</div></div>
      </div>

      {carregando ? <p className="text-sm text-[#392617]/50">Carregando…</p> : titulos.length === 0 ? (
        <p className="text-sm text-[#392617]/50">Nenhum título neste filtro. Clique em “Lançar título”.</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-[#E4E5E2] text-left text-[#7E0000] text-xs uppercase tracking-wide">
                <th className="px-3 py-2.5">Vencimento</th>
                <th className="px-3 py-2.5">Descrição</th>
                <th className="px-3 py-2.5">Conta</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {titulos.map(t => {
                const st = statusEfetivo(t)
                return (
                  <tr key={t.id} className="border-t border-[#DDC7A4]/40">
                    <td className="px-3 py-2 whitespace-nowrap text-[#392617]/80">{diaBR(t.dataVencimento)}</td>
                    <td className="px-3 py-2 text-[#392617]">{t.descricao}{t.fornecedorTexto ? <span className="text-[#392617]/50"> · {t.fornecedorTexto}</span> : null}</td>
                    <td className="px-3 py-2">
                      <select value={t.planoContaId ?? ''} disabled={salvando || t.status === 'CANCELADO'} onChange={e => acao(t.id, { planoContaId: e.target.value || null })}
                        className="rounded border border-[#DDC7A4] px-1.5 py-1 text-xs bg-white max-w-[180px]">
                        <option value="">(a classificar)</option>
                        {contasPagar.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{brl(t.valor)}</td>
                    <td className="px-3 py-2 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COR[st]}`}>{st}</span></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {t.status === 'PREVISTO' && <button onClick={() => acao(t.id, { acao: 'pagar' })} disabled={salvando} title="Marcar pago" className="inline-flex items-center gap-1 text-[#425F1D] hover:bg-[#425F1D]/10 rounded px-2 py-1 text-xs"><Check size={13} /> Pagar</button>}
                      {t.status === 'PAGO' && <button onClick={() => acao(t.id, { acao: 'reabrir' })} disabled={salvando} title="Reabrir" className="inline-flex items-center gap-1 text-[#8a5a00] hover:bg-[#D78B18]/10 rounded px-2 py-1 text-xs"><RotateCcw size={13} /> Reabrir</button>}
                      {t.status !== 'CANCELADO' && <button onClick={() => acao(t.id, { acao: 'cancelar' })} disabled={salvando} title="Cancelar" className="inline-flex items-center gap-1 text-[#7E0000]/70 hover:bg-[#7E0000]/10 rounded px-2 py-1 text-xs"><X size={13} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
