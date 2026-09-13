'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, Circle, AlertTriangle, Clock, ChevronDown, ChevronRight,
  Plus, Send, CalendarDays, Loader2, CalendarRange, Pencil, X, Wallet,
} from 'lucide-react'
import CalendarioMes from '@/components/rotinas/calendario-mes'
import AgirHoje from '@/components/rotinas/agir-hoje'

// ─── Tipos (espelham /api/rotinas) ──────────────────────────────────────────────
interface Tarefa {
  id: number
  area: string
  titulo: string
  descricao: string | null
  frequencia: string | null
  status: string
  origem: string
  criadoPorNome: string | null
  prazo: string | null
  dataOriginal: string
  concluidaPorNome: string | null
  acaoApp: string | null
  diasAtraso: number
  atrasada: boolean
  emAlerta: boolean
}
interface Unidade { id: number; nome: string; slug: string }
interface Resumo { total: number; concluidas: number; pendentes: number; atrasadas: number; emAlerta: number }
interface ApiResp {
  data: string
  perfil: string
  unidadeAtual: Unidade
  unidades: Unidade[]
  resumo: Resumo
  tarefas: Tarefa[]
}

const FREQ_LABEL: Record<string, string> = {
  DIARIA: 'Diária', SEMANAL: 'Semanal', MENSAL: 'Mensal', SOB_DEMANDA: 'Sob demanda', AVULSA: 'Avulsa',
}

function formatarData(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

/** Data local de hoje (YYYY-MM-DD), sem fuso UTC. */
function hojeLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RotinaDoDiaPage() {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [unidadeSlug, setUnidadeSlug] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [expandida, setExpandida] = useState<Record<number, boolean>>({})
  const [vista, setVista] = useState<'dia' | 'mes'>('dia')
  const [dataAtiva, setDataAtiva] = useState<string | null>(null) // null = hoje
  const [focoTitulo, setFocoTitulo] = useState<string | null>(null)
  const [editando, setEditando] = useState<Tarefa | null>(null)

  const carregar = useCallback(async (slug: string | null, data?: string | null) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (slug) p.set('unidade', slug)
    if (data) p.set('data', data)
    const r = await fetch(`/api/rotinas?${p.toString()}`, { cache: 'no-store' })
    const j: ApiResp = await r.json()
    setResp(j)
    setUnidadeSlug(j.unidadeAtual?.slug ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { carregar(null) }, [carregar])

  // Vem do calendário: abre o dia da ação, com a tarefa em destaque.
  function abrirAcao(dataISO: string, foco: string) {
    setVista('dia')
    setFocoTitulo(foco)
    setDataAtiva(dataISO === hojeLocalISO() ? null : dataISO)
    carregar(unidadeSlug, dataISO)
  }

  // Volta a olhar o dia de hoje.
  function voltarParaHoje() {
    setDataAtiva(null)
    setFocoTitulo(null)
    carregar(unidadeSlug, null)
  }

  // Rola até a tarefa em foco assim que a lista carrega.
  useEffect(() => {
    if (!focoTitulo || loading) return
    const el = document.getElementById('foco-target')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focoTitulo, loading, resp])

  async function alternar(t: Tarefa) {
    setBusy(t.id)
    await fetch('/api/rotinas/concluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, concluir: t.status !== 'CONCLUIDA' }),
    })
    await carregar(unidadeSlug, dataAtiva)
    setBusy(null)
  }

  const podeDelegar = resp && resp.perfil !== 'RECEPCAO'
  const coordenacao = resp?.tarefas.filter((t) => t.area === 'COORDENACAO') ?? []
  const recepcao = resp?.tarefas.filter((t) => t.area === 'RECEPCAO') ?? []

  return (
    <div className={`p-4 sm:p-6 w-full mx-auto ${vista === 'mes' ? 'max-w-[1600px]' : 'max-w-5xl'}`}>
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#7E0000] flex items-center gap-2">
            <CalendarDays size={24} /> Rotina do Dia
          </h1>
          {resp && (
            <p className="text-sm text-[#392617]/60 capitalize mt-0.5">{formatarData(resp.data)}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Alternador de vista: Hoje / Mês */}
          <div className="inline-flex rounded-lg border border-[#DDC7A4] bg-white p-0.5">
            <button onClick={() => { setVista('dia'); if (dataAtiva) voltarParaHoje() }}
              className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-md px-3 py-1.5 transition-colors ${
                vista === 'dia' ? 'bg-[#7E0000] text-white' : 'text-[#392617]/70 hover:text-[#7E0000]'
              }`}>
              <CalendarDays size={15} /> Hoje
            </button>
            <button onClick={() => setVista('mes')}
              className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-md px-3 py-1.5 transition-colors ${
                vista === 'mes' ? 'bg-[#7E0000] text-white' : 'text-[#392617]/70 hover:text-[#7E0000]'
              }`}>
              <CalendarRange size={15} /> Mês
            </button>
          </div>

          {/* Seletor de unidade */}
          {resp && resp.unidades.length > 0 && (
            <select
              value={unidadeSlug ?? ''}
              onChange={(e) => carregar(e.target.value, dataAtiva)}
              className="bg-white border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] font-medium focus:outline-none focus:ring-2 focus:ring-[#D78B18]"
            >
              {resp.unidades.map((u) => (
                <option key={u.slug} value={u.slug}>{u.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {vista === 'mes' && <CalendarioMes unidadeSlug={unidadeSlug} onAbrirAcao={abrirAcao} />}

      {/* Banner: vendo um dia que não é hoje */}
      {vista === 'dia' && dataAtiva && (
        <div className="flex items-center justify-between gap-3 mb-4 rounded-xl bg-[#D78B18]/10 border border-[#D78B18]/40 px-4 py-2.5">
          <p className="text-sm text-[#392617] capitalize">
            Vendo <b>{formatarData(dataAtiva)}</b>
          </p>
          <button onClick={voltarParaHoje}
            className="text-sm font-medium text-[#7E0000] hover:underline shrink-0">
            Voltar para hoje
          </button>
        </div>
      )}

      {vista === 'dia' && loading && (
        <div className="flex items-center justify-center py-20 text-[#7E0000]">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {vista === 'dia' && !loading && resp && (
        <>
          {/* Inteligência acionável do dia (só quando é hoje) */}
          {!dataAtiva && <AgirHoje unidadeSlug={unidadeSlug} perfil={resp.perfil} />}

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Cartao rotulo="Concluídas" valor={`${resp.resumo.concluidas}/${resp.resumo.total}`} cor="#425F1D" />
            <Cartao rotulo="Pendentes" valor={resp.resumo.pendentes} cor="#D78B18" />
            <Cartao rotulo="Atrasadas" valor={resp.resumo.atrasadas} cor="#7E0000" />
            <Cartao rotulo="Em alerta" valor={resp.resumo.emAlerta} cor="#7E0000" destaque={resp.resumo.emAlerta > 0} />
          </div>

          {podeDelegar && (
            <FormDelegar
              unidadeSlug={unidadeSlug}
              perfil={resp.perfil}
              onCriar={() => carregar(unidadeSlug, dataAtiva)}
            />
          )}

          {/* Coordenação */}
          {resp.perfil !== 'RECEPCAO' && (
            <Secao titulo="Coordenação" tarefas={coordenacao} busy={busy} foco={focoTitulo}
              expandida={expandida} setExpandida={setExpandida} onToggle={alternar}
              podeEditar={resp.perfil !== 'RECEPCAO'} onEditar={setEditando} unidadeSlug={unidadeSlug} />
          )}

          {/* Recepção */}
          <Secao titulo="Recepção" tarefas={recepcao} busy={busy} foco={focoTitulo}
            expandida={expandida} setExpandida={setExpandida} onToggle={alternar}
            podeEditar={resp.perfil !== 'RECEPCAO'} onEditar={setEditando} unidadeSlug={unidadeSlug} />
        </>
      )}

      {editando && (
        <ModalEditar
          tarefa={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar(unidadeSlug, dataAtiva) }}
        />
      )}
    </div>
  )
}

// ─── Componentes ────────────────────────────────────────────────────────────────
function ModalEditar({
  tarefa, onFechar, onSalvo,
}: {
  tarefa: Tarefa
  onFechar: () => void
  onSalvo: () => void
}) {
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao ?? '')
  const [area, setArea] = useState(tarefa.area)
  const [dia, setDia] = useState(tarefa.dataOriginal)
  const [prazo, setPrazo] = useState(tarefa.prazo ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!titulo.trim()) return
    setSalvando(true); setErro(null)
    const r = await fetch('/api/rotinas/editar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tarefa.id, titulo, descricao, area, data: dia, prazo }),
    })
    setSalvando(false)
    if (r.ok) onSalvo()
    else setErro((await r.json().catch(() => ({}))).error || 'Não foi possível salvar.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl border border-[#DDC7A4] w-full max-w-md p-5 space-y-3" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-[#7E0000]">Editar tarefa</p>
          <button onClick={onFechar} className="text-[#392617]/40 hover:text-[#7E0000]"><X size={18} /></button>
        </div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título"
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Como fazer / detalhes" rows={3}
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-[#392617]/70 flex items-center gap-2">
            Área:
            <select value={area} onChange={(e) => setArea(e.target.value)} className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm">
              <option value="COORDENACAO">Coordenação</option>
              <option value="RECEPCAO">Recepção</option>
            </select>
          </label>
          <label className="text-sm text-[#392617]/70 flex items-center gap-2">
            Dia:
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm text-[#392617]/70 flex items-center gap-2">
            Prazo:
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm" />
          </label>
        </div>
        {erro && <p className="text-[11px] text-[#7E0000] font-medium">{erro}</p>}
        <button onClick={salvar} disabled={salvando || !titulo.trim()}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2.5">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}


function Cartao({ rotulo, valor, cor, destaque }: { rotulo: string; valor: string | number; cor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl bg-white border p-3 ${destaque ? 'border-[#7E0000] ring-1 ring-[#7E0000]/30' : 'border-[#DDC7A4]'}`}>
      <p className="text-[11px] uppercase tracking-wide text-[#392617]/50 font-semibold">{rotulo}</p>
      <p className="text-2xl font-bold mt-0.5" style={{ color: cor }}>{valor}</p>
    </div>
  )
}

function Secao({
  titulo, tarefas, busy, expandida, setExpandida, onToggle, foco, podeEditar, onEditar, unidadeSlug,
}: {
  titulo: string
  tarefas: Tarefa[]
  busy: number | null
  expandida: Record<number, boolean>
  setExpandida: (fn: (p: Record<number, boolean>) => Record<number, boolean>) => void
  onToggle: (t: Tarefa) => void
  foco?: string | null
  podeEditar?: boolean
  onEditar?: (t: Tarefa) => void
  unidadeSlug?: string | null
}) {
  const feitas = tarefas.filter((t) => t.status === 'CONCLUIDA').length
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-bold text-[#7E0000] uppercase tracking-wide">{titulo}</h2>
        <span className="text-xs text-[#392617]/50">{feitas}/{tarefas.length}</span>
      </div>
      <div className="space-y-2">
        {tarefas.length === 0 && (
          <p className="text-sm text-[#392617]/40 italic px-1">Nenhuma tarefa para este dia.</p>
        )}
        {tarefas.map((t) => {
          const feita = t.status === 'CONCLUIDA'
          const aberta = expandida[t.id]
          const temDetalhe = !!t.descricao
          const emFoco = !!foco && t.titulo === foco
          return (
            <div key={t.id}
              id={emFoco ? 'foco-target' : undefined}
              className={`rounded-xl bg-white border p-3 transition-colors ${
                emFoco ? 'border-[#7E0000] ring-2 ring-[#7E0000]/50'
                : t.emAlerta ? 'border-[#7E0000] ring-1 ring-[#7E0000]/20'
                : t.atrasada ? 'border-[#D78B18]/70'
                : 'border-[#DDC7A4]'
              }`}>
              <div className="flex items-start gap-3">
                <button onClick={() => onToggle(t)} disabled={busy === t.id} className="mt-0.5 shrink-0">
                  {busy === t.id
                    ? <Loader2 size={22} className="animate-spin text-[#7E0000]" />
                    : feita
                      ? <CheckCircle2 size={22} className="text-[#425F1D]" />
                      : <Circle size={22} className="text-[#DDC7A4] hover:text-[#7E0000]" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${feita ? 'line-through text-[#392617]/40' : 'text-[#392617]'}`}>
                      {t.titulo}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {podeEditar && onEditar && (
                        <button onClick={() => onEditar(t)} title="Editar tarefa"
                          className="text-[#392617]/40 hover:text-[#7E0000]">
                          <Pencil size={14} />
                        </button>
                      )}
                      {temDetalhe && (
                        <button onClick={() => setExpandida((p) => ({ ...p, [t.id]: !p[t.id] }))}
                          className="text-[#392617]/40 hover:text-[#7E0000]">
                          {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {t.frequencia && (
                      <Badge cor="#DDC7A4" texto={FREQ_LABEL[t.frequencia] ?? t.frequencia} escuro />
                    )}
                    {t.origem === 'DELEGADA' && (
                      <Badge cor="#D78B18" texto={`Delegada${t.criadoPorNome ? ' por ' + t.criadoPorNome : ''}`} />
                    )}
                    {t.emAlerta && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#7E0000] px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} /> {t.diasAtraso}+ dias sem solução
                      </span>
                    )}
                    {!t.emAlerta && t.atrasada && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7E0000] bg-[#7E0000]/10 px-2 py-0.5 rounded-full">
                        <Clock size={11} /> Atrasada {t.diasAtraso}d
                      </span>
                    )}
                    {t.prazo && !feita && (
                      <Badge cor="#425F1D" texto={`Prazo ${t.prazo.slice(8)}/${t.prazo.slice(5, 7)}`} />
                    )}
                    {feita && t.concluidaPorNome && (
                      <span className="text-[11px] text-[#425F1D]">✓ {t.concluidaPorNome}</span>
                    )}
                  </div>

                  {t.acaoApp?.startsWith('caixa') && (
                    <a href={`/caixa?tipo=${t.acaoApp.split(':')[1] || 'abertura'}${unidadeSlug ? `&unidade=${unidadeSlug}` : ''}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] rounded-lg px-3 py-1.5">
                      <Wallet size={15} /> Abrir controle de caixa
                    </a>
                  )}

                  {aberta && temDetalhe && (
                    <div className="mt-2 text-[13px] text-[#392617]/70 bg-[#F5F0EB] rounded-lg p-2.5 border border-[#DDC7A4]/60">
                      <p className="text-[10px] uppercase font-semibold text-[#D78B18] mb-1">Como fazer</p>
                      {t.descricao}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Badge({ texto, cor, escuro }: { texto: string; cor: string; escuro?: boolean }) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: escuro ? cor : `${cor}22`, color: escuro ? '#392617' : cor }}>
      {texto}
    </span>
  )
}

function FormDelegar({
  unidadeSlug, perfil, onCriar,
}: {
  unidadeSlug: string | null
  perfil: string
  onCriar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [area, setArea] = useState('RECEPCAO')
  const [prazo, setPrazo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!titulo.trim() || !unidadeSlug) return
    setEnviando(true)
    await fetch('/api/rotinas/delegar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: unidadeSlug, area, titulo, descricao, prazo: prazo || undefined }),
    })
    setTitulo(''); setDescricao(''); setPrazo(''); setEnviando(false); setAberto(false)
    onCriar()
  }

  return (
    <div className="mb-6">
      {!aberto ? (
        <button onClick={() => setAberto(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#7E0000] border border-[#7E0000]/30 hover:bg-[#7E0000]/5 rounded-lg px-3 py-2">
          <Plus size={16} /> Delegar tarefa
        </button>
      ) : (
        <div className="rounded-xl bg-white border border-[#DDC7A4] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#7E0000]">Nova tarefa delegada</p>
            <button onClick={() => setAberto(false)} className="text-[#392617]/40 text-sm">Cancelar</button>
          </div>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?"
            className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes / como fazer (opcional)"
            rows={2}
            className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          <div className="flex flex-wrap gap-3 items-center">
            {perfil === 'DONA' && (
              <label className="text-sm text-[#392617]/70 flex items-center gap-2">
                Para:
                <select value={area} onChange={(e) => setArea(e.target.value)}
                  className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm">
                  <option value="COORDENACAO">Coordenação</option>
                  <option value="RECEPCAO">Recepção</option>
                </select>
              </label>
            )}
            <label className="text-sm text-[#392617]/70 flex items-center gap-2">
              Prazo:
              <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)}
                className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <button onClick={enviar} disabled={enviando || !titulo.trim()}
              className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2">
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
