'use client'

import { useCallback, useEffect, useState } from 'react'
import { ListChecks, RefreshCw, ChevronLeft, ChevronRight, Check } from 'lucide-react'

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

interface Entrada { id: number; data: string; valor: number; descricao: string | null; classificada: boolean; planoContaId: number | null; planoContaNome: string | null; classificadoPor: string | null }

export default function EntradasPage() {
  const agora = new Date()
  const [unidades, setUnidades] = useState<{ slug: string; nome: string }[]>(UNIDADES)
  const [unidade, setUnidade] = useState('')
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [contas, setContas] = useState<{ id: number; nome: string }[]>([])
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [contaSel, setContaSel] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [totais, setTotais] = useState({ aClassificar: 0, classificado: 0 })

  // Unidades do usuário + contas A Receber (uma vez).
  useEffect(() => {
    fetch('/api/auth/permissoes').then(r => r.ok ? r.json() : null).then(j => {
      const us: string[] | null = j?.unidades ?? null
      const vis = us == null ? UNIDADES : UNIDADES.filter(u => us.includes(u.slug))
      setUnidades(vis)
      setUnidade(prev => prev || vis[0]?.slug || '')
    }).catch(() => setUnidade(UNIDADES[0].slug))
    fetch('/api/plano-contas').then(r => r.ok ? r.json() : null).then(j => {
      if (j?.contas) setContas(j.contas.filter((c: { tipo: string }) => c.tipo === 'A Receber'))
    }).catch(() => {})
  }, [])

  const carregar = useCallback(async () => {
    if (!unidade) return
    setCarregando(true); setErro(null); setSel(new Set())
    try {
      const r = await fetch(`/api/financeiro/entradas?unidade=${unidade}&ano=${ano}&mes=${mes}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao carregar'); setEntradas([]); return }
      setEntradas(j.entradas); setTotais({ aClassificar: j.totalAClassificar, classificado: j.totalClassificado })
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [unidade, ano, mes])

  useEffect(() => { carregar() }, [carregar])

  const mudarMes = (d: number) => { let m = mes + d, a = ano; if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }; setMes(m); setAno(a) }

  const aClassificar = entradas.filter(e => !e.classificada)
  const toggleTodas = () => setSel(sel.size === aClassificar.length ? new Set() : new Set(aClassificar.map(e => e.id)))
  const toggle = (id: number) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const classificar = async (ids: number[], planoContaId: number) => {
    if (!ids.length || !planoContaId) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/financeiro/classificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fonteIds: ids, planoContaId }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao classificar'); return }
      await carregar()
    } finally { setSalvando(false) }
  }

  const desclassificar = async (id: number) => {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/financeiro/classificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fonteIds: [id], planoContaId: null }),
      })
      const j = await r.json(); if (!r.ok || j.error) { setErro(j.error || 'Erro'); return }
      await carregar()
    } finally { setSalvando(false) }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <ListChecks className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Entradas a Classificar</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">
        Pix recebidos no banco que não são de cliente (transferências, aportes, reembolsos). Classifique numa conta pra alimentar a DRE.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={unidade} onChange={e => setUnidade(e.target.value)} className="rounded-md border border-[#DDC7A4] px-3 py-1.5 text-sm bg-white">
          {unidades.map(u => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={() => mudarMes(-1)} className="p-1.5 rounded hover:bg-[#7E0000]/10 text-[#7E0000]"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium min-w-[130px] text-center">{MESES[mes]} / {ano}</span>
          <button onClick={() => mudarMes(1)} className="p-1.5 rounded hover:bg-[#7E0000]/10 text-[#7E0000]"><ChevronRight size={16} /></button>
        </div>
        <button onClick={carregar} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-md border border-[#7E0000]/30 text-[#7E0000] hover:bg-[#7E0000]/5 px-3 py-1.5 text-sm">
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {erro && <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 text-sm mb-4">{erro}</div>}

      {/* Barra de ação em lote */}
      {sel.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-[#425F1D]/10 border border-[#425F1D]/30 rounded-lg px-4 py-2.5 mb-3">
          <span className="text-sm font-medium text-[#344a16]">{sel.size} selecionada(s)</span>
          <select value={contaSel} onChange={e => setContaSel(e.target.value)} className="rounded-md border border-[#425F1D]/40 px-2 py-1.5 text-sm bg-white min-w-[220px]">
            <option value="">Escolha a conta (A Receber)…</option>
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button disabled={!contaSel || salvando} onClick={() => classificar([...sel], Number(contaSel))}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#425F1D] hover:bg-[#344a16] disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium">
            <Check size={15} /> Classificar selecionadas
          </button>
        </div>
      )}

      {/* Resumo */}
      <div className="flex gap-4 mb-3 text-sm">
        <span className="text-[#7E0000]">A classificar: <b>{brl(totais.aClassificar)}</b> ({aClassificar.length})</span>
        <span className="text-[#425F1D]">Classificado: <b>{brl(totais.classificado)}</b></span>
      </div>

      {carregando ? (
        <p className="text-sm text-[#392617]/50">Carregando…</p>
      ) : entradas.length === 0 ? (
        <p className="text-sm text-[#392617]/50">Nenhuma entrada de banco neste mês. Importe o extrato OFX na tela de Conciliação.</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-[#E4E5E2] text-left text-[#7E0000] text-xs uppercase tracking-wide">
                <th className="px-3 py-2.5 w-8">
                  {aClassificar.length > 0 && <input type="checkbox" checked={sel.size === aClassificar.length && sel.size > 0} onChange={toggleTodas} />}
                </th>
                <th className="px-3 py-2.5 w-16">Dia</th>
                <th className="px-3 py-2.5">Origem (histórico do banco)</th>
                <th className="px-3 py-2.5 text-right w-28">Valor</th>
                <th className="px-3 py-2.5 w-56">Conta</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map(e => (
                <tr key={e.id} className={`border-t border-[#DDC7A4]/40 ${e.classificada ? 'bg-[#425F1D]/[0.04]' : ''}`}>
                  <td className="px-3 py-2">{!e.classificada && <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />}</td>
                  <td className="px-3 py-2 text-[#392617]/70 whitespace-nowrap">{diaBR(e.data)}</td>
                  <td className="px-3 py-2 text-[#392617]">{e.descricao || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-[#392617] whitespace-nowrap">{brl(e.valor)}</td>
                  <td className="px-3 py-2">
                    {e.classificada ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[#425F1D] text-xs"><Check size={13} /> {e.planoContaNome}</span>
                        <button onClick={() => desclassificar(e.id)} disabled={salvando} className="text-[#7E0000]/50 hover:text-[#7E0000] text-[11px] underline">desfazer</button>
                      </div>
                    ) : (
                      <select defaultValue="" disabled={salvando} onChange={ev => { if (ev.target.value) classificar([e.id], Number(ev.target.value)) }}
                        className="rounded-md border border-[#DDC7A4] px-2 py-1 text-xs bg-white w-full">
                        <option value="">Classificar…</option>
                        {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
