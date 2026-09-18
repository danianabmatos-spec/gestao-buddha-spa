'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trophy, Gift, Sparkles, LogOut, Award, Building2, ChevronRight } from 'lucide-react'

interface Unidade { slug: string; nome: string }
interface Pontos { terapeutaNome: string; voucher: number; agendamento: number; produto: number; pacote: number; total: number }
interface UnidadeResp {
  geral?: false; unidadeAtual: Unidade; unidades: Unidade[]; ref: string
  porTerapeuta: Pontos[]; totalUnidade: number; metaPremio: number; metaSorteio: number
  premioAtivo: boolean; sorteioAtivo: boolean; ganhador: string | null
}
interface ResumoUnidade { slug: string; nome: string; totalUnidade: number; premioAtivo: boolean; sorteioAtivo: boolean; ganhador: string | null; topTotal: number }
interface GeralResp {
  geral: true; ref: string; unidades: ResumoUnidade[]; totalGeral: number
  metaPremio: number; metaSorteio: number; unidadesComPremio: number
}

function mesLongo(ref: string) {
  const [a, m] = ref.split('-').map(Number)
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${meses[m - 1]} de ${a}`
}
const medalha = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`)

export default function PontuacaoPage() {
  const [modo, setModo] = useState<'geral' | 'unidade'>('geral')
  const [uni, setUni] = useState<UnidadeResp | null>(null)
  const [geral, setGeral] = useState<GeralResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)

  const carregar = useCallback(async (m: 'geral' | 'unidade', u: string | null, r: string | null) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (r) p.set('ref', r)
    if (m === 'geral') {
      p.set('geral', '1')
      const j: GeralResp = await (await fetch(`/api/pontuacao?${p.toString()}`, { cache: 'no-store' })).json()
      setGeral(j); setRef(j.ref); setModo('geral')
    } else {
      if (u) p.set('unidade', u)
      const j: UnidadeResp = await (await fetch(`/api/pontuacao?${p.toString()}`, { cache: 'no-store' })).json()
      setUni(j); setSlug(j.unidadeAtual?.slug ?? null); setRef(j.ref); setModo('unidade')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // ?unidade=slug abre direto a visão daquela unidade (vindo do dashboard); senão, geral.
    const u = new URLSearchParams(window.location.search).get('unidade')
    if (u) carregar('unidade', u, null)
    else carregar('geral', null, null)
  }, [carregar])

  const unidadesPicker = uni?.unidades ?? geral?.unidades?.map((u) => ({ slug: u.slug, nome: u.nome })) ?? []
  const multi = unidadesPicker.length > 1

  return (
    <div className="min-h-screen bg-[#E4E5E2]">
      <header className="bg-[#7E0000] text-white px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#DDC7A4]">Buddha Spa · Programa de Recomendação</p>
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2"><Trophy size={20} /> Pontuação do Mês</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-white/80 hover:text-white text-sm">← Painel</a>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login' }}
              className="text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"><LogOut size={16} /> Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {multi && (
            <div className="flex gap-1 bg-white border border-[#DDC7A4] rounded-lg p-1">
              <button onClick={() => carregar('geral', null, ref)}
                className={`text-[13px] px-3 py-1.5 rounded-md font-medium ${modo === 'geral' ? 'bg-[#7E0000] text-white' : 'text-[#392617]/70 hover:bg-[#7E0000]/5'}`}>Geral (rede)</button>
              <button onClick={() => carregar('unidade', slug, ref)}
                className={`text-[13px] px-3 py-1.5 rounded-md font-medium ${modo === 'unidade' ? 'bg-[#7E0000] text-white' : 'text-[#392617]/70 hover:bg-[#7E0000]/5'}`}>Por unidade</button>
            </div>
          )}
          {modo === 'unidade' && multi && (
            <select value={slug ?? ''} onChange={(e) => carregar('unidade', e.target.value, ref)}
              className="bg-white border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] font-medium focus:outline-none focus:ring-2 focus:ring-[#D78B18]">
              {unidadesPicker.map((u) => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
            </select>
          )}
          <label className="block">
            <span className="text-[12px] text-[#392617]/70 mr-2">Mês</span>
            <input type="month" value={ref ?? ''} onChange={(e) => carregar(modo, slug, e.target.value)}
              className="border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] font-medium focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
        ) : modo === 'geral' && geral ? (
          <VisaoGeral g={geral} onAbrir={(s) => { setSlug(s); carregar('unidade', s, ref) }} />
        ) : modo === 'unidade' && uni ? (
          <DetalheUnidade r={uni} />
        ) : (
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-8 text-center text-[#392617]/70">Nada a exibir.</div>
        )}
      </main>
    </div>
  )
}

function VisaoGeral({ g, onAbrir }: { g: GeralResp; onAbrir: (slug: string) => void }) {
  return (
    <>
      <p className="text-sm text-[#392617]/70 mb-3">Rede · {mesLongo(g.ref)}</p>

      {/* Total geral da rede */}
      <div className="bg-gradient-to-r from-[#7E0000] to-[#5c0000] text-white rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-[#DDC7A4]">Total geral da rede</p>
          <p className="text-3xl font-bold">{g.totalGeral} <span className="text-base font-medium text-white/60">pts</span></p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#D78B18]">{g.unidadesComPremio}<span className="text-sm text-white/60">/{g.unidades.length}</span></p>
          <p className="text-[12px] text-white/80">unidades com prêmio ativado</p>
        </div>
      </div>

      {/* Ranking de unidades */}
      <div className="rounded-xl border border-[#DDC7A4] bg-white overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-[#F5F0EB] text-[#7E0000] text-[13px] uppercase">
              <th className="text-left font-bold px-2 py-2.5 w-[40px]">#</th>
              <th className="text-left font-bold px-3 py-2.5">Unidade</th>
              <th className="text-right font-bold px-2 py-2.5 w-[64px]">Pontos</th>
              <th className="text-left font-bold px-3 py-2.5 w-[130px]">Prêmio</th>
              <th className="text-left font-bold px-3 py-2.5">Ganhadora</th>
              <th className="px-2 py-2.5 w-[36px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDC7A4]/40">
            {g.unidades.map((u, i) => (
              <tr key={u.slug} className="hover:bg-[#7E0000]/[0.03] cursor-pointer" onClick={() => onAbrir(u.slug)}>
                <td className="px-2 py-2.5 text-[15px]">{medalha(i)}</td>
                <td className="px-3 py-2.5 text-[#392617] font-medium truncate flex items-center gap-1.5" title={u.nome}><Building2 size={13} className="text-[#7E0000]/60 shrink-0" /> {u.nome}</td>
                <td className="px-2 py-2.5 text-right font-bold text-[#7E0000]">{u.totalUnidade}</td>
                <td className="px-3 py-2.5">
                  {u.sorteioAtivo ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9a6410] bg-[#D78B18]/15 rounded-full px-2 py-0.5"><Sparkles size={11} /> +Sorteio</span>
                    : u.premioAtivo ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#425F1D] bg-[#425F1D]/10 rounded-full px-2 py-0.5"><Gift size={11} /> Ativado</span>
                    : <span className="text-[11px] text-[#392617]/50">faltam {g.metaPremio - u.totalUnidade}</span>}
                </td>
                <td className="px-3 py-2.5 text-[#392617] truncate" title={u.ganhador ?? ''}>{u.ganhador || <span className="text-[#392617]/40">—</span>}</td>
                <td className="px-2 py-2.5 text-right"><ChevronRight size={16} className="text-[#392617]/30" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#392617]/50 mt-2">Toque numa unidade pra ver o ranking das terapeutas. Prêmio ativa com ≥{g.metaPremio} pts; sorteio extra com ≥{g.metaSorteio}.</p>
    </>
  )
}

function DetalheUnidade({ r }: { r: UnidadeResp }) {
  const pct = Math.min(100, Math.round((r.totalUnidade / r.metaSorteio) * 100))
  return (
    <>
      <p className="text-sm text-[#392617]/70 mb-3">{r.unidadeAtual.nome} · {mesLongo(r.ref)}</p>

      <div className="bg-white rounded-2xl border border-[#DDC7A4] p-4 mb-4">
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-[#392617]/60 font-semibold">Total da unidade</p>
            <p className="text-3xl font-bold text-[#7E0000]">{r.totalUnidade} <span className="text-base font-medium text-[#392617]/50">pts</span></p>
          </div>
          <div className="text-right text-[12px] text-[#392617]/70">
            <p>Meta prêmio: <strong>{r.metaPremio}</strong></p>
            <p>Sorteio extra: <strong>{r.metaSorteio}</strong></p>
          </div>
        </div>
        <div className="relative h-3 rounded-full bg-[#DDC7A4]/40 overflow-hidden">
          <div className={`h-full rounded-full ${r.sorteioAtivo ? 'bg-[#425F1D]' : r.premioAtivo ? 'bg-[#D78B18]' : 'bg-[#7E0000]/50'}`} style={{ width: `${pct}%` }} />
          <div className="absolute top-0 bottom-0" style={{ left: `${(r.metaPremio / r.metaSorteio) * 100}%` }}><div className="w-px h-full bg-[#392617]/40" /></div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {r.premioAtivo ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#425F1D] bg-[#425F1D]/10 rounded-full px-3 py-1"><Gift size={14} /> Prêmio ativado (≥{r.metaPremio})</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7E0000] bg-[#7E0000]/10 rounded-full px-3 py-1">Faltam {r.metaPremio - r.totalUnidade} pts pra ativar o prêmio</span>
          )}
          {r.sorteioAtivo && <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#9a6410] bg-[#D78B18]/15 rounded-full px-3 py-1"><Sparkles size={14} /> Sorteio liberado (≥{r.metaSorteio})</span>}
        </div>
      </div>

      {r.premioAtivo && r.ganhador && (
        <div className="bg-gradient-to-r from-[#7E0000] to-[#5c0000] text-white rounded-2xl p-4 mb-4 flex items-center gap-3">
          <Award size={28} className="text-[#D78B18] shrink-0" />
          <div>
            <p className="text-[12px] uppercase tracking-wide text-[#DDC7A4]">Ganhadora do mês (maior pontuação)</p>
            <p className="text-xl font-bold">{r.ganhador}</p>
            <p className="text-[12px] text-white/80">Prêmio: Mini Day Spa Individual ou Terapia 60min em dupla{r.sorteioAtivo ? ' · + sorteio de Terapia 60min pra equipe' : ''}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#DDC7A4] bg-white overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-[#F5F0EB] text-[#7E0000] text-[13px] uppercase">
              <th className="text-left font-bold px-2 py-2.5 w-[44px]">#</th>
              <th className="text-left font-bold px-3 py-2.5">Terapeuta</th>
              <th className="text-right font-bold px-2 py-2.5 w-[70px]">Voucher</th>
              <th className="text-right font-bold px-2 py-2.5 w-[74px]">Agend.</th>
              <th className="text-right font-bold px-2 py-2.5 w-[74px]">Produto</th>
              <th className="text-right font-bold px-2 py-2.5 w-[70px]">Pacote</th>
              <th className="text-right font-bold px-2 py-2.5 w-[64px]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDC7A4]/40">
            {r.porTerapeuta.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[#392617]/60">Nenhuma venda registrada neste mês ainda.</td></tr>
            ) : r.porTerapeuta.map((t, i) => (
              <tr key={t.terapeutaNome} className={i === 0 && r.premioAtivo ? 'bg-[#D78B18]/[0.06]' : ''}>
                <td className="px-2 py-2 text-[15px]">{medalha(i)}</td>
                <td className="px-3 py-2 text-[#392617] font-medium truncate" title={t.terapeutaNome}>{t.terapeutaNome}</td>
                <td className="px-2 py-2 text-right text-[#392617]/80">{t.voucher || '—'}</td>
                <td className="px-2 py-2 text-right text-[#392617]/80">{t.agendamento || '—'}</td>
                <td className="px-2 py-2 text-right text-[#392617]/80">{t.produto || '—'}</td>
                <td className="px-2 py-2 text-right text-[#392617]/80">{t.pacote || '—'}</td>
                <td className="px-2 py-2 text-right font-bold text-[#7E0000]">{t.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#392617]/50 mt-2">Voucher, novo agendamento e produto = 1 ponto cada; pacote = nº de sessões pagas. Conta quando a venda é registrada no pós-venda.</p>
    </>
  )
}
