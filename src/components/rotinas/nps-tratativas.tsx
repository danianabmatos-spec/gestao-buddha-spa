'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, PhoneCall, CheckCircle2, AlertTriangle, Gift, SmilePlus, Tag,
  User, CalendarDays, Flower2, ChevronDown, ChevronRight,
} from 'lucide-react'

// ─── Tipos (espelham /api/rotinas/agir-hoje — bloco NPS) ────────────────────────
interface Tratativa {
  acaoTomada: string
  tipoProblema: string | null
  cortesiaConcedida: boolean | null
  clienteSatisfeito: string | null
  por: string | null
  em: string
}
interface AvaliacaoNPS {
  idAtendimento: string; chaveCaso: string
  data: string; cliente: string; classificacao: string; nota: number | null
  comentario: string; profissional: string; servicos: string; tipo: string
  tratativa: Tratativa | null
}
interface Unidade { id: number; nome: string; slug: string }
interface ApiResp {
  perfil: string
  unidadeAtual: Unidade
  unidades: Unidade[]
  nps: { periodo: { inicio: string; fim: string }; totalRespostas?: number; avaliacoes: AvaliacaoNPS[]; erro?: string }
}

const ehDetrator = (c: string) => c.toLowerCase().includes('detrator')
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (iso: string) => { const m = parseInt((iso || '').slice(5, 7), 10); return m >= 1 && m <= 12 ? MESES_NOME[m - 1] : 'do mês' }
const dataBR = (iso: string) => { const s = String(iso || ''); return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s }

const TIPOS_PROBLEMA = [
  'Atendimento / recepção', 'Profissional / massagista', 'Tempo de espera / atraso',
  'Ambiente / limpeza', 'Agendamento / reserva', 'Preço / cobrança',
  'Técnica / resultado da massagem', 'Comunicação / expectativa', 'Outro',
]
const SATISFACAO = ['Sim', 'Não', 'Sem retorno ainda']

export default function NpsTratativas({ unidadeSlug }: { unidadeSlug: string | null }) {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(unidadeSlug)
  const [tratadosAberto, setTratadosAberto] = useState(false)

  const carregar = useCallback(async (s: string | null) => {
    setLoading(true)
    const qs = s ? `?unidade=${s}` : ''
    try {
      const r = await fetch(`/api/rotinas/agir-hoje${qs}`, { cache: 'no-store' })
      const j: ApiResp = await r.json()
      setResp(j)
      setSlug(j.unidadeAtual?.slug ?? null)
    } catch { setResp(null) }
    setLoading(false)
  }, [])

  useEffect(() => { carregar(unidadeSlug) }, [unidadeSlug, carregar])

  const podeTratar = resp?.perfil === 'DONA' || resp?.perfil === 'COORDENACAO'
  const nps = resp?.nps
  const pendentes = (nps?.avaliacoes ?? []).filter((a) => !a.tratativa)
  const tratados = (nps?.avaliacoes ?? []).filter((a) => a.tratativa)

  return (
    <div className="p-4 sm:p-6 w-full max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#7E0000] flex items-center gap-2">
          <PhoneCall size={24} /> NPS a Tratar
          {resp?.unidadeAtual?.nome && (
            <span className="text-sm font-semibold text-[#392617]/70 bg-[#F5F0EB] rounded-full px-3 py-1">{resp.unidadeAtual.nome}</span>
          )}
        </h1>
        {nps && !nps.erro && (
          <p className="text-sm text-[#392617]/60 mt-1">
            Clientes para contatar — NPS de {nomeMes(nps.periodo.inicio)} ·{' '}
            {nps.totalRespostas ?? 0} resposta{(nps.totalRespostas ?? 0) === 1 ? '' : 's'} no mês
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
      ) : !resp || !nps ? (
        <p className="text-sm text-[#392617]/50">Não foi possível carregar o NPS.</p>
      ) : nps.erro ? (
        <p className="text-sm text-[#7E0000]/80 flex items-center gap-1.5"><AlertTriangle size={14} /> {nps.erro}</p>
      ) : (
        <>
          {/* ── Pendentes ── */}
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-bold text-[#7E0000] uppercase tracking-wide">Pendentes de tratativa</h2>
              <span className="text-xs font-bold text-white bg-[#7E0000] rounded-full px-2 py-0.5">{pendentes.length}</span>
            </div>
            {pendentes.length === 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-[#425F1D] bg-[#425F1D]/10 rounded-lg px-3 py-2">
                <CheckCircle2 size={15} /> Nenhum cliente pendente de tratativa neste mês. Satisfação alta! 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {pendentes.map((a, i) => (
                  <CasoNps key={a.chaveCaso || i} a={a} unidadeSlug={resp.unidadeAtual.slug} podeTratar={!!podeTratar} onSalvo={() => carregar(slug)} />
                ))}
              </div>
            )}
          </section>

          {/* ── Já tratados no mês (lista) ── */}
          {tratados.length > 0 && (
            <section>
              <button onClick={() => setTratadosAberto((v) => !v)}
                className="flex items-center gap-2 mb-2 text-sm font-bold text-[#425F1D] uppercase tracking-wide">
                {tratadosAberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Já tratados no mês
                <span className="text-xs font-bold text-white bg-[#425F1D] rounded-full px-2 py-0.5 normal-case">{tratados.length}</span>
              </button>
              {tratadosAberto && (
                <div className="rounded-xl border border-[#DDC7A4] bg-white divide-y divide-[#DDC7A4]/50 overflow-hidden">
                  {tratados.map((a, i) => <TratadoRow key={a.chaveCaso || i} a={a} />)}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── Caso pendente (card com formulário) ────────────────────────────────────────
function CasoNps({ a, unidadeSlug, podeTratar, onSalvo }: { a: AvaliacaoNPS; unidadeSlug: string; podeTratar: boolean; onSalvo: () => void }) {
  return (
    <div className="rounded-xl bg-white border border-[#DDC7A4] p-3">
      <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
        <span className="text-sm font-semibold text-[#392617]">{a.cliente}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: ehDetrator(a.classificacao) ? '#7E0000' : '#D78B18' }}>
          {a.classificacao}{a.nota != null ? ` · ${a.nota}/10` : ''}
        </span>
        {a.profissional && <MetaChip icon={<User size={11} />} cor="#D78B18" texto={a.profissional} />}
        {a.servicos && <MetaChip icon={<Flower2 size={11} />} cor="#425F1D" texto={a.servicos} />}
        {a.data && <MetaChip icon={<CalendarDays size={11} />} cor="#7E0000" texto={dataBR(a.data)} />}
      </div>
      {a.comentario
        ? <p className="text-[13px] text-[#392617]/80 mt-1.5 italic">“{a.comentario}”</p>
        : <p className="text-[13px] text-[#392617]/40 mt-1.5 italic">sem comentário</p>}
      <BlocoTratativa unidadeSlug={unidadeSlug} podeTratar={podeTratar} onSalvo={onSalvo}
        caso={{ chaveCaso: a.chaveCaso, cliente: a.cliente, classificacao: a.classificacao, nota: a.nota, comentario: a.comentario }} />
    </div>
  )
}

// ─── Linha de caso já tratado (expansível → mostra a tratativa) ─────────────────
function TratadoRow({ a }: { a: AvaliacaoNPS }) {
  const [aberto, setAberto] = useState(false)
  const t = a.tratativa!
  return (
    <div>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#FBF6EF]">
        <CheckCircle2 size={15} className="text-[#425F1D] shrink-0" />
        <span className="text-sm font-medium text-[#392617] shrink-0">{a.cliente}</span>
        <span className="text-xs text-[#392617]/55 truncate flex-1">
          {[a.profissional, a.servicos, dataBR(a.data)].filter(Boolean).join(' · ')}
        </span>
        {aberto ? <ChevronDown size={15} className="text-[#392617]/40 shrink-0" /> : <ChevronRight size={15} className="text-[#392617]/40 shrink-0" />}
      </button>
      {aberto && (
        <div className="px-3 pb-3 pl-10">
          <p className="text-[10px] font-semibold uppercase text-[#425F1D]">Tratativa{t.por ? ` · ${t.por}` : ''}</p>
          <p className="text-[13px] text-[#392617]/80 mt-0.5">{t.acaoTomada}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {t.tipoProblema && <Chip icon={<Tag size={10} />} texto={t.tipoProblema} />}
            {t.cortesiaConcedida != null && <Chip icon={<Gift size={10} />} texto={`Cortesia: ${t.cortesiaConcedida ? 'Sim' : 'Não'}`} />}
            {t.clienteSatisfeito && <Chip icon={<SmilePlus size={10} />} texto={`Satisfeito: ${t.clienteSatisfeito}`} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Formulário de tratativa ────────────────────────────────────────────────────
function BlocoTratativa({ unidadeSlug, podeTratar, onSalvo, caso }: {
  unidadeSlug: string; podeTratar: boolean; onSalvo: () => void
  caso: { chaveCaso: string; cliente: string; classificacao: string; nota: number | null; comentario: string }
}) {
  const [salvando, setSalvando] = useState(false)
  const [acao, setAcao] = useState('')
  const [tipo, setTipo] = useState('')
  const [cortesia, setCortesia] = useState<boolean | null>(null)
  const [satisf, setSatisf] = useState('')

  async function salvar() {
    if (!acao.trim()) return
    setSalvando(true)
    const r = await fetch('/api/rotinas/tratativa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unidade: unidadeSlug, origem: 'NPS', chaveCaso: caso.chaveCaso,
        cliente: caso.cliente, classificacao: caso.classificacao, nota: caso.nota, comentario: caso.comentario,
        acaoTomada: acao, tipoProblema: tipo || null, cortesiaConcedida: cortesia, clienteSatisfeito: satisf || null,
      }),
    })
    setSalvando(false)
    if (r.ok) onSalvo()
  }

  if (!podeTratar) {
    return <p className="mt-2 pt-2 border-t border-[#DDC7A4]/50 text-[11px] text-[#392617]/40 italic">Aguardando tratativa da coordenação.</p>
  }

  return (
    <div className="mt-2 pt-2 border-t border-[#DDC7A4]/50 space-y-2">
      <p className="text-[10px] font-semibold uppercase text-[#D78B18]">Registrar tratativa</p>
      <textarea value={acao} onChange={(e) => setAcao(e.target.value)} rows={2}
        placeholder="Ação tomada — ex.: liguei, pedi desculpas e ofereci retorno com desconto."
        className="w-full border border-[#DDC7A4] rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[11px] text-[#392617]/70">Tipo de problema
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[12px] bg-white">
            <option value="">Selecionar…</option>
            {TIPOS_PROBLEMA.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-[#392617]/70">Cortesia concedida?
          <select value={cortesia === null ? '' : cortesia ? 'sim' : 'nao'} onChange={(e) => setCortesia(e.target.value === '' ? null : e.target.value === 'sim')}
            className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[12px] bg-white">
            <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
        <label className="text-[11px] text-[#392617]/70">Cliente satisfeito depois?
          <select value={satisf} onChange={(e) => setSatisf(e.target.value)} className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[12px] bg-white">
            <option value="">—</option>
            {SATISFACAO.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button onClick={salvar} disabled={salvando || !acao.trim()}
          className="text-[11px] font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar tratativa
        </button>
      </div>
    </div>
  )
}

function Chip({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#392617] bg-[#DDC7A4]/40 rounded-full px-2 py-0.5">{icon} {texto}</span>
}
function MetaChip({ icon, texto, cor }: { icon: React.ReactNode; texto: string; cor: string }) {
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5" style={{ backgroundColor: `${cor}16`, color: cor }}>{icon} {texto}</span>
}
