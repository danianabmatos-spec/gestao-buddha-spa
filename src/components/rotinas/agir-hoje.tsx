'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, PhoneCall, Star, MessageSquare, ExternalLink, CheckCircle2, Sparkles, AlertTriangle, Gift, SmilePlus, Tag, User, CalendarDays, Flower2 } from 'lucide-react'

// ─── Tipos (espelham /api/rotinas/agir-hoje) ────────────────────────────────────
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
interface AvaliacaoGoogle {
  chaveCaso: string; nota: number; texto: string; autor: string; quando: string; publishTime: string
  tratativa: Tratativa | null
}
interface ApiResp {
  perfil: string
  unidadeAtual: { id: number; nome: string; slug: string }
  nps: { periodo: { inicio: string; fim: string }; totalRespostas?: number; avaliacoes: AvaliacaoNPS[]; erro?: string }
  google: { nota: number; totalAvaliacoes: number; url: string; mes: string; avaliacoes: AvaliacaoGoogle[]; erro?: string }
}

const ehDetrator = (c: string) => c.toLowerCase().includes('detrator')

// Bloco do Google desligado por ora: a API pública só devolve ~5 reviews antigas e
// não traz as recentes do mês. Religar quando conectarmos a Google Business Profile API.
const MOSTRAR_GOOGLE = false

const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
function nomeMes(iso: string): string {
  const m = parseInt((iso || '').slice(5, 7), 10)
  return m >= 1 && m <= 12 ? MESES_NOME[m - 1] : 'do mês'
}
function dataBR(iso: string): string {
  const s = String(iso || '')
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s
}

// Tipologia do problema (para métricas). Ajustável.
const TIPOS_PROBLEMA = [
  'Atendimento / recepção',
  'Profissional / massagista',
  'Tempo de espera / atraso',
  'Ambiente / limpeza',
  'Agendamento / reserva',
  'Preço / cobrança',
  'Técnica / resultado da massagem',
  'Comunicação / expectativa',
  'Outro',
]
const SATISFACAO = ['Sim', 'Não', 'Sem retorno ainda']

export default function AgirHoje({ unidadeSlug, perfil }: { unidadeSlug: string | null; perfil: string }) {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async (slug: string | null) => {
    setLoading(true)
    const qs = slug ? `?unidade=${slug}` : ''
    try {
      const r = await fetch(`/api/rotinas/agir-hoje${qs}`, { cache: 'no-store' })
      setResp(await r.json())
    } catch {
      setResp(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar(unidadeSlug) }, [unidadeSlug, carregar])

  const podeTratar = perfil === 'DONA' || perfil === 'COORDENACAO'

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#DDC7A4] bg-white p-4 mb-5 flex items-center gap-3 text-[#7E0000]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Buscando o que precisa da sua atenção hoje…</span>
      </div>
    )
  }
  if (!resp) return null

  const nps = resp.nps
  const google = resp.google

  return (
    <div className="rounded-2xl border border-[#7E0000]/30 bg-gradient-to-b from-[#7E0000]/[0.04] to-white p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-[#7E0000]" />
        <h2 className="text-base font-bold text-[#7E0000]">Para você agir hoje</h2>
      </div>

      {/* ── NPS ── */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <PhoneCall size={15} className="text-[#7E0000]" />
          <h3 className="text-sm font-bold text-[#392617]">Clientes para contatar — NPS de {nomeMes(nps.periodo.inicio)}</h3>
          {!nps.erro && (
            <span className="text-[11px] text-[#392617]/50">
              {nps.totalRespostas ?? 0} resposta{(nps.totalRespostas ?? 0) === 1 ? '' : 's'} no mês · <b className="text-[#7E0000]">{nps.avaliacoes.length} para tratar</b>
            </span>
          )}
        </div>
        {nps.erro ? (
          <p className="text-sm text-[#7E0000]/80 flex items-center gap-1.5"><AlertTriangle size={14} /> {nps.erro}</p>
        ) : nps.avaliacoes.length === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-[#425F1D] bg-[#425F1D]/10 rounded-lg px-3 py-2">
            <CheckCircle2 size={15} /> Nenhum detrator ou neutro para tratar neste mês. Satisfação alta! 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {nps.avaliacoes.map((a, i) => (
              <CasoNps key={a.chaveCaso || i} a={a} unidadeSlug={resp.unidadeAtual.slug} podeTratar={podeTratar} />
            ))}
          </div>
        )}
      </section>

      {/* ── Google (desligado por ora — ver MOSTRAR_GOOGLE) ── */}
      {MOSTRAR_GOOGLE && (
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Star size={15} className="text-[#D78B18]" />
          <h3 className="text-sm font-bold text-[#392617]">Avaliações do Google de {nomeMes(google.mes + '-01')} (≠ 5★)</h3>
          {google.url && (
            <a href={google.url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-[#7E0000] hover:underline inline-flex items-center gap-0.5 ml-auto">
              Abrir no Google <ExternalLink size={11} />
            </a>
          )}
        </div>
        {google.erro ? (
          <p className="text-sm text-[#7E0000]/80 flex items-center gap-1.5"><AlertTriangle size={14} /> {google.erro}</p>
        ) : google.avaliacoes.length === 0 ? (
          <p className="text-[12px] text-[#392617]/55">
            Nenhuma avaliação abaixo de 5★ deste mês disponível pela API pública (nota atual {google.nota} · {google.totalAvaliacoes} avaliações).
            <span className="block mt-0.5 text-[#392617]/40">⚠️ A API pública do Google devolve só ~5 avaliações "mais relevantes" e não inclui as recentes — as de {nomeMes(google.mes + '-01')} não vêm por aqui. Para trazer TODAS (por data), é preciso conectar a Google Business Profile API.</span>
          </p>
        ) : (
          <div className="space-y-2">
            {google.avaliacoes.map((a, i) => (
              <CasoGoogle key={a.chaveCaso || i} a={a} unidadeSlug={resp.unidadeAtual.slug} podeTratar={podeTratar} />
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  )
}

// ─── Caso de NPS ────────────────────────────────────────────────────────────────
function CasoNps({ a, unidadeSlug, podeTratar }: { a: AvaliacaoNPS; unidadeSlug: string; podeTratar: boolean }) {
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
      <BlocoTratativa
        unidadeSlug={unidadeSlug} podeTratar={podeTratar} inicial={a.tratativa}
        caso={{ origem: 'NPS', chaveCaso: a.chaveCaso, cliente: a.cliente, classificacao: a.classificacao, nota: a.nota, comentario: a.comentario }}
      />
    </div>
  )
}

// ─── Caso do Google ─────────────────────────────────────────────────────────────
function CasoGoogle({ a, unidadeSlug, podeTratar }: { a: AvaliacaoGoogle; unidadeSlug: string; podeTratar: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-[#DDC7A4] p-3">
      <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
        <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full"
          style={{ backgroundColor: a.nota <= 2 ? '#7E0000' : '#D78B18' }}>{a.nota}★</span>
        <span className="text-sm font-semibold text-[#392617]">{a.autor}</span>
        {a.publishTime && <MetaChip icon={<CalendarDays size={11} />} cor="#7E0000" texto={dataBR(a.publishTime)} />}
        {a.quando && <span className="text-[11px] text-[#392617]/45">{a.quando}</span>}
      </div>
      {a.texto && <p className="text-[13px] text-[#392617]/80 mt-1 italic flex gap-1"><MessageSquare size={13} className="mt-0.5 shrink-0 text-[#392617]/30" /> {a.texto}</p>}
      <BlocoTratativa
        unidadeSlug={unidadeSlug} podeTratar={podeTratar} inicial={a.tratativa}
        caso={{ origem: 'GOOGLE', chaveCaso: a.chaveCaso, cliente: a.autor, classificacao: `Google ${a.nota}★`, nota: a.nota, comentario: a.texto }}
      />
    </div>
  )
}

// ─── Bloco de tratativa (compartilhado NPS + Google) ────────────────────────────
interface CasoRef {
  origem: 'NPS' | 'GOOGLE'; chaveCaso: string; cliente: string
  classificacao: string; nota: number | null; comentario: string
}
function BlocoTratativa({
  unidadeSlug, podeTratar, inicial, caso,
}: {
  unidadeSlug: string; podeTratar: boolean; inicial: Tratativa | null; caso: CasoRef
}) {
  const [tratativa, setTratativa] = useState<Tratativa | null>(inicial)
  const [editando, setEditando] = useState(!inicial)
  const [salvando, setSalvando] = useState(false)
  const [acao, setAcao] = useState(inicial?.acaoTomada ?? '')
  const [tipo, setTipo] = useState(inicial?.tipoProblema ?? '')
  const [cortesia, setCortesia] = useState<boolean | null>(inicial?.cortesiaConcedida ?? null)
  const [satisf, setSatisf] = useState(inicial?.clienteSatisfeito ?? '')

  async function salvar() {
    if (!acao.trim()) return
    setSalvando(true)
    const r = await fetch('/api/rotinas/tratativa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unidade: unidadeSlug, origem: caso.origem, chaveCaso: caso.chaveCaso,
        cliente: caso.cliente, classificacao: caso.classificacao, nota: caso.nota, comentario: caso.comentario,
        acaoTomada: acao, tipoProblema: tipo || null,
        cortesiaConcedida: cortesia, clienteSatisfeito: satisf || null,
      }),
    })
    setSalvando(false)
    if (r.ok) {
      const j = await r.json()
      const t = j.tratativa
      setTratativa({ acaoTomada: t.acaoTomada, tipoProblema: t.tipoProblema, cortesiaConcedida: t.cortesiaConcedida, clienteSatisfeito: t.clienteSatisfeito, por: t.tratadoPorNome, em: t.atualizadoEm })
      setEditando(false)
    }
  }

  if (!podeTratar) {
    return <p className="mt-2 pt-2 border-t border-[#DDC7A4]/50 text-[11px] text-[#392617]/40 italic">Aguardando tratativa da coordenação.</p>
  }

  if (tratativa && !editando) {
    return (
      <div className="mt-2 pt-2 border-t border-[#DDC7A4]/50">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-[#425F1D] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase text-[#425F1D]">Tratado{tratativa.por ? ` · ${tratativa.por}` : ''}</p>
            <p className="text-[13px] text-[#392617]/80">{tratativa.acaoTomada}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tratativa.tipoProblema && <Chip icon={<Tag size={10} />} texto={tratativa.tipoProblema} />}
              {tratativa.cortesiaConcedida != null && <Chip icon={<Gift size={10} />} texto={`Cortesia: ${tratativa.cortesiaConcedida ? 'Sim' : 'Não'}`} />}
              {tratativa.clienteSatisfeito && <Chip icon={<SmilePlus size={10} />} texto={`Satisfeito: ${tratativa.clienteSatisfeito}`} />}
            </div>
          </div>
          <button onClick={() => setEditando(true)} className="text-[11px] text-[#7E0000] hover:underline shrink-0">editar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 pt-2 border-t border-[#DDC7A4]/50 space-y-2">
      <p className="text-[10px] font-semibold uppercase text-[#D78B18]">Registrar tratativa</p>
      <textarea value={acao} onChange={(e) => setAcao(e.target.value)} rows={2}
        placeholder="Ação tomada — ex.: liguei, pedi desculpas e ofereci retorno com desconto."
        className="w-full border border-[#DDC7A4] rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[11px] text-[#392617]/70">
          Tipo de problema
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[12px] bg-white">
            <option value="">Selecionar…</option>
            {TIPOS_PROBLEMA.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-[#392617]/70">
          Cortesia concedida?
          <select value={cortesia === null ? '' : cortesia ? 'sim' : 'nao'} onChange={(e) => setCortesia(e.target.value === '' ? null : e.target.value === 'sim')}
            className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[12px] bg-white">
            <option value="">—</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </label>
        <label className="text-[11px] text-[#392617]/70">
          Cliente satisfeito depois?
          <select value={satisf} onChange={(e) => setSatisf(e.target.value)}
            className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[12px] bg-white">
            <option value="">—</option>
            {SATISFACAO.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        {tratativa && <button onClick={() => { setEditando(false); setAcao(tratativa.acaoTomada); setTipo(tratativa.tipoProblema ?? ''); setCortesia(tratativa.cortesiaConcedida); setSatisf(tratativa.clienteSatisfeito ?? '') }} className="text-[11px] text-[#392617]/50">cancelar</button>}
        <button onClick={salvar} disabled={salvando || !acao.trim()}
          className="text-[11px] font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar tratativa
        </button>
      </div>
    </div>
  )
}

function Chip({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#392617] bg-[#DDC7A4]/40 rounded-full px-2 py-0.5">
      {icon} {texto}
    </span>
  )
}

// Chip destacado para profissional / terapia / data (ao lado da classificação).
function MetaChip({ icon, texto, cor }: { icon: React.ReactNode; texto: string; cor: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5"
      style={{ backgroundColor: `${cor}16`, color: cor }}>
      {icon} {texto}
    </span>
  )
}
