'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, CheckCircle2, MessageSquareWarning, ShieldCheck, Lock, LogOut, Users,
  ThumbsUp, XCircle, CalendarDays, Sparkles,
} from 'lucide-react'

interface Unidade { slug: string; nome: string }
interface Resumo { total: number; pendentes: number; confirmados: number; contestados: number; ajustados: number; rejeitados: number }
interface PorTerapeuta { nome: string; total: number; pendentes: number; contestados: number }
interface Contestacao { belleId: string; terapeutaNome: string; clienteNome: string; servico: string | null; data: string; valorComissao: number; observacaoContestacao: string | null }
interface ApiResp {
  unidadeAtual: Unidade
  unidades: Unidade[]
  ref: string
  resumo: Resumo
  porTerapeuta: PorTerapeuta[]
  contestacoes: Contestacao[]
  liberado: boolean
  liberadoEm: string | null
  liberadoPorNome: string | null
  forcado: boolean
  forcadoInfo: { terapeuta: string; pendentes: number }[] | null
  podeLiberar: boolean
  temContestacaoAberta: boolean
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
function mesLongo(ref: string) {
  const [a, m] = ref.split('-').map(Number)
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${meses[m - 1]} de ${a}`
}

export default function ValidacaoPage() {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async (u?: string | null, r?: string | null) => {
    setLoading(true); setErro(null)
    const p = new URLSearchParams()
    if (u) p.set('unidade', u)
    if (r) p.set('ref', r)
    const res = await fetch(`/api/validacao?${p.toString()}`, { cache: 'no-store' })
    const j: ApiResp = await res.json()
    setResp(j); setSlug(j.unidadeAtual?.slug ?? null); setRef(j.ref ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // A unidade vem do menu (?unidade=slug) e fica TRAVADA — sem seletor.
    const u = new URLSearchParams(window.location.search).get('unidade')
    carregar(u, null)
  }, [carregar])

  async function liberar(forcar: boolean) {
    if (!slug || !ref) return
    setErro(null)
    const res = await fetch('/api/validacao/liberar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: slug, ref, forcar }),
    })
    const j = await res.json().catch(() => ({}))
    if (res.ok) carregar(slug, ref)
    else setErro(j.error || 'Não foi possível liberar.')
  }

  const r = resp

  return (
    <div className="min-h-screen bg-[#E4E5E2]">
      <header className="bg-[#7E0000] text-white px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#DDC7A4]">Buddha Spa · Coordenação</p>
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2"><ShieldCheck size={20} /> Validação do Fechamento</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-white/80 hover:text-white text-sm">← Painel</a>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login' }}
              className="text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"><LogOut size={16} /> Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 sm:px-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="block">
            <span className="text-[12px] text-[#392617]/70">Mês</span>
            <input type="month" value={ref ?? ''} onChange={(e) => { setRef(e.target.value); carregar(slug, e.target.value) }}
              className="mt-0.5 block border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] font-medium focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
        ) : !r ? (
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-8 text-center text-[#392617]/70">Nada a exibir.</div>
        ) : (
          <>
            <p className="text-sm text-[#392617]/70 mb-3">{r.unidadeAtual.nome} · {mesLongo(r.ref)}</p>

            {/* Resumo */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              <Stat label="Total" valor={r.resumo.total} />
              <Stat label="A validar" valor={r.resumo.pendentes} tom={r.resumo.pendentes ? 'cinza' : 'ok'} />
              <Stat label="Confirmados" valor={r.resumo.confirmados} tom="ok" />
              <Stat label="Contestados" valor={r.resumo.contestados} tom={r.resumo.contestados ? 'alerta' : 'ok'} />
              <Stat label="Ajustados" valor={r.resumo.ajustados} />
              <Stat label="Rejeitados" valor={r.resumo.rejeitados} />
            </div>

            {/* Liberação */}
            <BlocoLiberacao r={r} erro={erro} onLiberar={liberar} />

            {/* Contestações a resolver */}
            {r.contestacoes.length > 0 && (
              <section className="mb-5">
                <h2 className="text-sm font-bold text-[#7E0000] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MessageSquareWarning size={15} /> Contestações a resolver ({r.contestacoes.length})
                </h2>
                <div className="space-y-3">
                  {r.contestacoes.map((c) => <CardContestacao key={c.belleId} c={c} onResolvido={() => carregar(slug, ref)} />)}
                </div>
              </section>
            )}

            {/* Resumo por terapeuta */}
            <section>
              <h2 className="text-sm font-bold text-[#7E0000] uppercase tracking-wide mb-2 flex items-center gap-1.5"><Users size={15} /> Por terapeuta</h2>
              <div className="rounded-xl border border-[#DDC7A4] bg-white overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-[#F5F0EB] text-[#7E0000] text-[13px] uppercase">
                      <th className="text-left font-bold px-3 py-2.5">Terapeuta</th>
                      <th className="text-right font-bold px-2 py-2.5 w-[58px]">Total</th>
                      <th className="text-right font-bold px-2 py-2.5 w-[92px]">A validar</th>
                      <th className="text-right font-bold px-2 py-2.5 w-[92px]">Contest.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDC7A4]/40">
                    {r.porTerapeuta.map((t) => (
                      <tr key={t.nome}>
                        <td className="px-3 py-2 text-[#392617] truncate" title={t.nome}>{t.nome}</td>
                        <td className="px-2 py-2 text-right text-[#392617]/80">{t.total}</td>
                        <td className={`px-2 py-2 text-right ${t.pendentes ? 'text-[#392617]' : 'text-[#392617]/40'}`}>{t.pendentes || '—'}</td>
                        <td className={`px-2 py-2 text-right ${t.contestados ? 'text-[#7E0000] font-semibold' : 'text-[#392617]/40'}`}>{t.contestados || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Stat({ label, valor, tom }: { label: string; valor: number; tom?: 'ok' | 'alerta' | 'cinza' }) {
  const cor = tom === 'alerta' ? 'text-[#7E0000]' : tom === 'ok' ? 'text-[#425F1D]' : 'text-[#392617]'
  return (
    <div className="bg-white rounded-xl border border-[#DDC7A4] px-2 py-2.5 text-center">
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#392617]/75">{label}</p>
    </div>
  )
}

function CardContestacao({ c, onResolvido }: { c: Contestacao; onResolvido: () => void }) {
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const dataBR = `${c.data.slice(8, 10)}/${c.data.slice(5, 7)}/${c.data.slice(0, 4)}`

  async function resolver(resolucao: 'AJUSTADO' | 'REJEITADO') {
    setSalvando(true)
    await fetch('/api/validacao/resolver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ belleId: c.belleId, resolucao, respostaCoord: nota }),
    })
    setSalvando(false); onResolvido()
  }

  return (
    <div className="bg-white rounded-2xl border border-[#7E0000]/20 p-4">
      {/* Destaque para a coordenadora: TERAPEUTA · TERAPIA · DATA */}
      <p className="text-[17px] font-bold text-[#392617] leading-tight">{c.terapeutaNome}</p>
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#7E0000] bg-[#7E0000]/10 rounded-full px-2.5 py-1">
          <Sparkles size={13} /> {c.servico || 'Atendimento'}
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#392617] bg-[#DDC7A4]/50 rounded-full px-2.5 py-1">
          <CalendarDays size={13} /> {dataBR}
        </span>
      </div>
      <p className="text-[12px] text-[#392617]/55 mt-1.5">Cliente: {c.clienteNome} · comissão {brl(c.valorComissao)}</p>
      <p className="mt-2 text-[13px] text-[#7E0000] italic bg-[#7E0000]/[0.04] rounded-lg px-3 py-2">“{c.observacaoContestacao}”</p>
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Resposta da coordenação (opcional)"
        className="mt-2 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => resolver('AJUSTADO')} disabled={salvando}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#425F1D] hover:bg-[#374f18] disabled:opacity-50 rounded-lg px-3 py-2.5">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <ThumbsUp size={15} />} Ajustar (conta)
        </button>
        <button onClick={() => resolver('REJEITADO')} disabled={salvando}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#7E0000] border border-[#7E0000]/30 hover:bg-[#7E0000]/5 disabled:opacity-50 rounded-lg px-3 py-2.5">
          <XCircle size={15} /> Rejeitar (não conta)
        </button>
      </div>
    </div>
  )
}

function BlocoLiberacao({ r, erro, onLiberar }: { r: ApiResp; erro: string | null; onLiberar: (forcar: boolean) => void }) {
  const [confirmarForca, setConfirmarForca] = useState(false)
  const pendentesPorTer = r.porTerapeuta.filter((t) => t.pendentes > 0)

  if (r.liberado) {
    return (
      <div className="bg-white rounded-2xl border border-[#425F1D]/40 p-4 mb-5">
        <div className="flex items-center gap-2 text-[#425F1D]">
          <Lock size={18} />
          <div>
            <p className="font-semibold text-[15px]">Fechamento liberado</p>
            <p className="text-[12px] text-[#392617]/60">por {r.liberadoPorNome}{r.liberadoEm ? ` · ${new Date(r.liberadoEm).toLocaleDateString('pt-BR')}` : ''} — o lote confirmado segue para o Folha.</p>
          </div>
        </div>
        {r.forcado && r.forcadoInfo && r.forcadoInfo.length > 0 && (
          <div className="mt-3 text-[12px] bg-[#D78B18]/10 border border-[#D78B18]/30 rounded-lg p-3">
            <p className="font-semibold text-[#9a6410]">⚠ Liberado à força — o RH foi avisado na folha de que não validaram a tempo:</p>
            <ul className="mt-1 text-[#392617]/70 list-disc pl-5">
              {r.forcadoInfo.map((f) => <li key={f.terapeuta}>{f.terapeuta} — {f.pendentes} atendimento(s) não validado(s)</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Contestação em aberto → liberação INDISPONÍVEL, sem botões.
  if (r.temContestacaoAberta) {
    return (
      <div className="bg-white rounded-2xl border border-[#7E0000]/25 p-4 mb-5">
        <p className="text-[14px] font-semibold text-[#7E0000] flex items-center gap-1.5"><MessageSquareWarning size={16} /> Liberação indisponível</p>
        <p className="text-[12px] text-[#392617]/70 mt-1">Há {r.resumo.contestados} contestação(ões) em aberto. Resolva todas abaixo para poder liberar o fechamento.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#DDC7A4] p-4 mb-5">
      <p className="text-[14px] font-semibold text-[#392617] mb-1">Liberar o fechamento do mês</p>
      {r.podeLiberar ? (
        <>
          <p className="text-[12px] text-[#392617]/60 mb-3">Tudo validado e ajustado. Ao liberar, o lote confirmado é enviado ao Folha para o cálculo da comissão.</p>
          {erro && <p className="text-[12px] text-[#7E0000] font-medium mb-2">{erro}</p>}
          <button onClick={() => onLiberar(false)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#425F1D] hover:bg-[#374f18] rounded-lg px-4 py-2.5">
            <Lock size={16} /> Liberar fechamento
          </button>
        </>
      ) : (
        <>
          <p className="text-[12px] text-[#392617]/60 mb-2">Faltam <strong>{r.resumo.pendentes}</strong> atendimento(s) sem validação da terapeuta:</p>
          <ul className="text-[12px] text-[#392617]/70 list-disc pl-5 mb-3">
            {pendentesPorTer.map((t) => <li key={t.nome}>{t.nome} — {t.pendentes} a validar</li>)}
          </ul>
          {erro && <p className="text-[12px] text-[#7E0000] font-medium mb-2">{erro}</p>}
          {!confirmarForca ? (
            <div className="flex flex-wrap gap-2 items-center">
              <button disabled className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#425F1D] opacity-40 rounded-lg px-4 py-2.5 cursor-not-allowed">
                <Lock size={16} /> Liberar fechamento
              </button>
              <button onClick={() => setConfirmarForca(true)}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#9a6410] border border-[#D78B18]/50 bg-[#D78B18]/10 hover:bg-[#D78B18]/20 rounded-lg px-4 py-2.5">
                Forçar liberação
              </button>
            </div>
          ) : (
            <div className="bg-[#D78B18]/10 border border-[#D78B18]/40 rounded-lg p-3">
              <p className="text-[13px] text-[#392617]"><strong>Forçar a liberação?</strong> Os {r.resumo.pendentes} pendentes serão confirmados e o <strong>RH será avisado na folha</strong> de que as terapeutas acima não validaram a tempo.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => onLiberar(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] rounded-lg px-4 py-2">Confirmar e liberar</button>
                <button onClick={() => setConfirmarForca(false)} className="px-3 py-2 text-sm text-[#392617]/70">Cancelar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
