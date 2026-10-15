'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2, PhoneCall, CheckCircle2, AlertTriangle, Gift, SmilePlus, Tag,
  ChevronDown, ChevronRight,
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
  const [expandido, setExpandido] = useState<string | null>(null)
  // Filtros por coluna.
  const [fCliente, setFCliente] = useState('')
  const [fProf, setFProf] = useState('')
  const [fServ, setFServ] = useState('')
  const [fClass, setFClass] = useState('')   // '' | detrator | neutro
  const [fStatus, setFStatus] = useState('') // '' | pendente | tratado

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

  // Aplica a tratativa salva LOCALMENTE (sem refazer a chamada ao Belle). Evita o
  // recarregamento a cada tratativa — que é lento e dava erro ("não foi possível
  // carregar") no ambiente da coordenação — e mantém a unidade e a posição na tela.
  const aplicarTratativa = useCallback((chaveCaso: string, t: Tratativa) => {
    setResp((prev) => prev?.nps
      ? { ...prev, nps: { ...prev.nps, avaliacoes: prev.nps.avaliacoes.map((a) => (a.chaveCaso === chaveCaso ? { ...a, tratativa: t } : a)) } }
      : prev)
  }, [])

  const podeTratar = resp?.perfil === 'DONA' || resp?.perfil === 'COORDENACAO'
  const nps = resp?.nps
  const todos = useMemo(() => nps?.avaliacoes ?? [], [nps])
  const pendentesCount = todos.filter((a) => !a.tratativa).length

  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()
  const filtrados = useMemo(() => todos.filter((a) => {
    if (fCliente && !norm(a.cliente).includes(norm(fCliente))) return false
    if (fProf && !norm(a.profissional).includes(norm(fProf))) return false
    if (fServ && !norm(a.servicos).includes(norm(fServ))) return false
    if (fClass === 'detrator' && !ehDetrator(a.classificacao)) return false
    if (fClass === 'neutro' && ehDetrator(a.classificacao)) return false
    if (fStatus === 'pendente' && a.tratativa) return false
    if (fStatus === 'tratado' && !a.tratativa) return false
    return true
  }).sort((a, b) => {
    const pa = a.tratativa ? 1 : 0, pb = b.tratativa ? 1 : 0
    if (pa !== pb) return pa - pb                       // pendentes primeiro
    return (b.data || '').localeCompare(a.data || '')   // mais recentes
  }), [todos, fCliente, fProf, fServ, fClass, fStatus])

  const inputCls = 'w-full rounded border border-white/30 bg-white/90 text-[#392617] px-1.5 py-0.5 text-[11px] font-normal placeholder:text-[#392617]/40 focus:outline-none'

  return (
    <div className="p-4 sm:p-6 w-full max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#7E0000] flex items-center gap-2">
          <PhoneCall size={24} /> NPS a Tratar
          {resp?.unidadeAtual?.nome && (
            <span className="text-sm font-semibold text-[#392617]/70 bg-[#F5F0EB] rounded-full px-3 py-1">{resp.unidadeAtual.nome}</span>
          )}
        </h1>
        {nps && !nps.erro && (
          <p className="text-sm text-[#392617]/60 mt-1">
            NPS de {nomeMes(nps.periodo.inicio)} · {nps.totalRespostas ?? 0} resposta{(nps.totalRespostas ?? 0) === 1 ? '' : 's'} no mês ·{' '}
            <b className="text-[#7E0000]">{pendentesCount} pendente{pendentesCount === 1 ? '' : 's'}</b> de {todos.length}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
      ) : !resp || !nps ? (
        <p className="text-sm text-[#392617]/50">Não foi possível carregar o NPS.</p>
      ) : nps.erro ? (
        <p className="text-sm text-[#7E0000]/80 flex items-center gap-1.5"><AlertTriangle size={14} /> {nps.erro}</p>
      ) : todos.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-[#425F1D] bg-[#425F1D]/10 rounded-lg px-3 py-2">
          <CheckCircle2 size={15} /> Nenhum detrator ou neutro neste mês. Satisfação alta! 🎉
        </div>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[920px]">
              <thead>
                <tr className="bg-[#7E0000] text-white text-xs">
                  <th className="w-6"></th>
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-left font-semibold">Classificação</th>
                  <th className="px-2 py-2 text-center font-semibold">Nota</th>
                  <th className="px-3 py-2 text-left font-semibold">Terapeuta</th>
                  <th className="px-3 py-2 text-left font-semibold">Serviço</th>
                  <th className="px-2 py-2 text-center font-semibold">Data</th>
                  <th className="px-3 py-2 text-center font-semibold">Status</th>
                </tr>
                {/* linha de filtros */}
                <tr className="bg-[#5c0000]">
                  <th></th>
                  <th className="px-2 py-1"><input value={fCliente} onChange={(e) => setFCliente(e.target.value)} placeholder="filtrar…" className={inputCls} /></th>
                  <th className="px-2 py-1">
                    <select value={fClass} onChange={(e) => setFClass(e.target.value)} className={inputCls}>
                      <option value="">Todas</option><option value="detrator">Detrator</option><option value="neutro">Neutro</option>
                    </select>
                  </th>
                  <th></th>
                  <th className="px-2 py-1"><input value={fProf} onChange={(e) => setFProf(e.target.value)} placeholder="filtrar…" className={inputCls} /></th>
                  <th className="px-2 py-1"><input value={fServ} onChange={(e) => setFServ(e.target.value)} placeholder="filtrar…" className={inputCls} /></th>
                  <th></th>
                  <th className="px-2 py-1">
                    <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inputCls}>
                      <option value="">Todos</option><option value="pendente">Pendente</option><option value="tratado">Tratado</option>
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDC7A4]/30">
                {filtrados.map((a, i) => {
                  const pend = !a.tratativa
                  const chave = a.chaveCaso || String(i)
                  const aberta = expandido === chave
                  const det = ehDetrator(a.classificacao)
                  return (
                    <Fragment key={chave}>
                      <tr className="hover:bg-[#FBF6EF] cursor-pointer" onClick={() => setExpandido(aberta ? null : chave)}>
                        <td className="px-1 text-center text-[#7E0000]">{aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td className="px-3 py-2 font-medium text-[#392617] whitespace-nowrap">{a.cliente}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ backgroundColor: det ? '#7E0000' : '#D78B18' }}>
                            {a.classificacao}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-[#392617]">{a.nota ?? '—'}</td>
                        <td className="px-3 py-2 text-[#392617]/80 whitespace-nowrap">{a.profissional || '—'}</td>
                        <td className="px-3 py-2 text-[#392617]/80 whitespace-nowrap">{a.servicos || '—'}</td>
                        <td className="px-2 py-2 text-center text-[#392617]/70 whitespace-nowrap">{dataBR(a.data)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ backgroundColor: pend ? '#D78B18' : '#425F1D' }}>
                            {pend ? 'Pendente' : 'Tratado'}
                          </span>
                        </td>
                      </tr>
                      {aberta && (
                        <tr className="bg-[#F5F0EB]/60">
                          <td colSpan={8} className="px-4 py-3">
                            {a.comentario
                              ? <p className="text-[13px] text-[#392617]/80 italic mb-1">“{a.comentario}”</p>
                              : <p className="text-[13px] text-[#392617]/40 italic mb-1">sem comentário</p>}
                            {pend ? (
                              <BlocoTratativa unidadeSlug={resp.unidadeAtual.slug} podeTratar={!!podeTratar} onSalvo={aplicarTratativa}
                                caso={{ chaveCaso: a.chaveCaso, cliente: a.cliente, classificacao: a.classificacao, nota: a.nota, comentario: a.comentario }} />
                            ) : a.tratativa ? (
                              <div className="mt-1">
                                <p className="text-[10px] font-semibold uppercase text-[#425F1D]">Tratativa{a.tratativa.por ? ` · ${a.tratativa.por}` : ''}</p>
                                <p className="text-[13px] text-[#392617]/80 mt-0.5">{a.tratativa.acaoTomada}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {a.tratativa.tipoProblema && <Chip icon={<Tag size={10} />} texto={a.tratativa.tipoProblema} />}
                                  {a.tratativa.cortesiaConcedida != null && <Chip icon={<Gift size={10} />} texto={`Cortesia: ${a.tratativa.cortesiaConcedida ? 'Sim' : 'Não'}`} />}
                                  {a.tratativa.clienteSatisfeito && <Chip icon={<SmilePlus size={10} />} texto={`Satisfeito: ${a.tratativa.clienteSatisfeito}`} />}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-[#392617]/50">Nenhum caso com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Formulário de tratativa ────────────────────────────────────────────────────
function BlocoTratativa({ unidadeSlug, podeTratar, onSalvo, caso }: {
  unidadeSlug: string; podeTratar: boolean; onSalvo: (chaveCaso: string, tratativa: Tratativa) => void
  caso: { chaveCaso: string; cliente: string; classificacao: string; nota: number | null; comentario: string }
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [acao, setAcao] = useState('')
  const [tipo, setTipo] = useState('')
  const [cortesia, setCortesia] = useState<boolean | null>(null)
  const [satisf, setSatisf] = useState('')

  async function salvar() {
    if (!acao.trim()) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/rotinas/tratativa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unidade: unidadeSlug, origem: 'NPS', chaveCaso: caso.chaveCaso,
          cliente: caso.cliente, classificacao: caso.classificacao, nota: caso.nota, comentario: caso.comentario,
          acaoTomada: acao, tipoProblema: tipo || null, cortesiaConcedida: cortesia, clienteSatisfeito: satisf || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.error || 'Erro ao salvar a tratativa'); return }
      const t = j.tratativa
      // Atualiza a tela na hora, sem recarregar (não refaz a chamada ao Belle).
      onSalvo(caso.chaveCaso, {
        acaoTomada: t?.acaoTomada ?? acao,
        tipoProblema: t?.tipoProblema ?? (tipo || null),
        cortesiaConcedida: t?.cortesiaConcedida ?? cortesia,
        clienteSatisfeito: t?.clienteSatisfeito ?? (satisf || null),
        por: t?.tratadoPorNome ?? null,
        em: t?.atualizadoEm ?? '',
      })
    } catch {
      setErro('Falha de conexão ao salvar')
    } finally { setSalvando(false) }
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
      <div className="flex justify-end items-center gap-2">
        {erro && <span className="text-[11px] text-[#7E0000]">{erro}</span>}
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
