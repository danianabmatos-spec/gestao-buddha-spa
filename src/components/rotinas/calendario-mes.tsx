'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Loader2, CalendarRange, Sun, Plus, Send, X,
  CheckCircle2, AlertTriangle, Clock, CircleDashed, ChevronRight as Chevron,
} from 'lucide-react'

// ─── Tipos (espelham /api/rotinas/calendario) ───────────────────────────────────
type Estado = 'concluida' | 'atrasada' | 'pendente' | 'planejada'
type OrigemAcao = 'catalogo' | 'sob-demanda' | 'delegada'
interface Evento {
  templateId: number | null
  tarefaId?: number | null
  chave: string
  titulo: string
  descricao: string | null
  area: string
  frente: string | null
  origemAcao: OrigemAcao
  tipo: 'semanal' | 'mensal-inicio' | 'mensal-limite' | 'avulsa'
  ateDia?: number | null
  dataAcaoISO: string
  deadlineISO: string
  estado: Estado
  concluidaPorNome?: string | null
}
interface Dia { dia: number; dataISO: string; diaSemana: number; hoje: boolean; passado: boolean; eventos: Evento[] }
interface Diaria { chave: string; titulo: string; area: string; frente: string | null }
interface Resumo { concluidas: number; atrasadas: number; pendentes: number; planejadas: number }
interface Calendario {
  ano: number; mes: number; totalDias: number; primeiroDiaSemana: number
  dias: Dia[]; diarias: Diaria[]; resumo: Resumo
}
interface Unidade { id: number; nome: string; slug: string }
interface ApiResp {
  perfil: string
  unidadeAtual: Unidade
  unidades: Unidade[]
  calendario: Calendario
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const ESTADO = {
  concluida: { cor: '#425F1D', rotulo: 'Feito', Icone: CheckCircle2 },
  atrasada: { cor: '#7E0000', rotulo: 'Atrasado', Icone: AlertTriangle },
  pendente: { cor: '#D78B18', rotulo: 'A fazer', Icone: Clock },
  planejada: { cor: '#A9906B', rotulo: 'Planejado', Icone: CircleDashed },
} as const

const corArea = (area: string) => (area === 'RECEPCAO' ? '#D78B18' : '#7E0000')
const rotuloArea = (area: string) => (area === 'RECEPCAO' ? 'Recepção' : 'Coordenação')
const rotuloOrigem = (o: OrigemAcao) => (o === 'delegada' ? 'Delegada' : o === 'sob-demanda' ? 'Sob demanda' : '')

export default function CalendarioMes({
  unidadeSlug,
  onAbrirAcao,
}: {
  unidadeSlug: string | null
  onAbrirAcao: (dataISO: string, foco: string) => void
}) {
  const [ref, setRef] = useState<{ ano: number; mes: number } | null>(null)
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [criarEm, setCriarEm] = useState<string | null>(null) // dataISO do modal de criação

  const carregar = useCallback(async (slug: string | null, ano?: number, mes?: number) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (slug) p.set('unidade', slug)
    if (ano && mes) { p.set('ano', String(ano)); p.set('mes', String(mes)) }
    const r = await fetch(`/api/rotinas/calendario?${p.toString()}`, { cache: 'no-store' })
    const j: ApiResp = await r.json()
    setResp(j)
    setRef({ ano: j.calendario.ano, mes: j.calendario.mes })
    setLoading(false)
  }, [])

  useEffect(() => { carregar(unidadeSlug, ref?.ano, ref?.mes) }, [unidadeSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  function irMes(delta: number) {
    if (!ref) return
    let ano = ref.ano
    let mes = ref.mes + delta
    if (mes < 1) { mes = 12; ano-- }
    if (mes > 12) { mes = 1; ano++ }
    carregar(unidadeSlug, ano, mes)
  }

  const cal = resp?.calendario

  return (
    <div>
      {/* Navegação de mês + criar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <button onClick={() => irMes(-1)} disabled={loading} aria-label="Mês anterior"
          className="p-2 rounded-lg text-[#7E0000] hover:bg-[#7E0000]/5 disabled:opacity-40">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-lg font-bold text-[#7E0000] flex items-center gap-2">
          <CalendarRange size={20} />
          {ref ? `${MESES[ref.mes - 1]} ${ref.ano}` : '—'}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setCriarEm(hojeLocalISO())}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] rounded-lg px-3 py-1.5">
            <Plus size={15} /> <span className="hidden sm:inline">Nova ação</span>
          </button>
          <button onClick={() => irMes(1)} disabled={loading} aria-label="Próximo mês"
            className="p-2 rounded-lg text-[#7E0000] hover:bg-[#7E0000]/5 disabled:opacity-40">
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      {/* Resumo do mês */}
      {cal && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <CartaoResumo estado="concluida" valor={cal.resumo.concluidas} />
          <CartaoResumo estado="atrasada" valor={cal.resumo.atrasadas} />
          <CartaoResumo estado="pendente" valor={cal.resumo.pendentes} />
          <CartaoResumo estado="planejada" valor={cal.resumo.planejadas} />
        </div>
      )}

      <p className="text-[11px] text-[#392617]/55 mb-3 leading-relaxed">
        Toque numa atividade para abrir e realizar.
        <span className="ml-1 font-medium text-[#425F1D]">● Feito</span>
        <span className="ml-1.5 font-medium text-[#7E0000]">● Atrasado</span>
        <span className="ml-1.5 font-medium text-[#D78B18]">● A fazer</span>
        <span className="ml-1.5 font-medium text-[#A9906B]">● Planejado</span>
      </p>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
      )}

      {!loading && cal && (
        <>
          {/* ══ DESKTOP: grade do mês (ocupa toda a largura) ══ */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 gap-1.5 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-[#392617]/45 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: cal.primeiroDiaSemana }).map((_, i) => <div key={`v-${i}`} className="min-h-[116px]" />)}
              {cal.dias.map((d) => {
                const fds = d.diaSemana === 0 || d.diaSemana === 6
                return (
                  <div key={d.dataISO}
                    className={`group/dia relative rounded-lg border p-1.5 min-h-[116px] flex flex-col overflow-hidden
                      ${d.hoje ? 'border-[#D78B18] bg-[#D78B18]/[0.06] ring-1 ring-[#D78B18]/40'
                        : fds ? 'border-[#DDC7A4]/50 bg-[#F5F0EB]/40' : 'border-[#DDC7A4] bg-white'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${
                        d.hoje ? 'text-white bg-[#D78B18] rounded-full w-5 h-5 flex items-center justify-center' : 'text-[#392617]/70'
                      }`}>{d.dia}</span>
                      <button onClick={() => setCriarEm(d.dataISO)} title="Criar ação neste dia"
                        className="opacity-0 group-hover/dia:opacity-100 transition text-[#7E0000] hover:bg-[#7E0000]/10 rounded p-0.5">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 min-h-0">
                      {d.eventos.map((e, i) => <ChipEvento key={i} e={e} onClick={onAbrirAcao} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ══ MOBILE: agenda em lista ══ */}
          <div className="sm:hidden space-y-3">
            {cal.dias.filter((d) => d.eventos.length > 0).map((d) => (
              <div key={d.dataISO}
                className={`rounded-xl border overflow-hidden ${d.hoje ? 'border-[#D78B18] ring-1 ring-[#D78B18]/30' : 'border-[#DDC7A4]'}`}>
                <div className={`flex items-center gap-2 px-3 py-2 ${d.hoje ? 'bg-[#D78B18]/10' : 'bg-[#F5F0EB]'}`}>
                  <span className={`text-base font-bold ${d.hoje ? 'text-[#D78B18]' : 'text-[#7E0000]'}`}>{d.dia}</span>
                  <span className="text-xs font-medium text-[#392617]/60 uppercase">{DIAS_SEMANA[d.diaSemana]}</span>
                  {d.hoje && <span className="text-[10px] font-bold text-white bg-[#D78B18] px-2 py-0.5 rounded-full">HOJE</span>}
                  <button onClick={() => setCriarEm(d.dataISO)} className="ml-auto text-[#7E0000] p-1"><Plus size={16} /></button>
                </div>
                <div className="divide-y divide-[#DDC7A4]/40 bg-white">
                  {d.eventos.map((e, i) => <LinhaEvento key={i} e={e} onClick={onAbrirAcao} />)}
                </div>
              </div>
            ))}
            {cal.dias.every((d) => d.eventos.length === 0) && (
              <p className="text-sm text-[#392617]/50 italic text-center py-8">Sem atividades semanais, mensais ou sob demanda neste mês.</p>
            )}
          </div>

          {/* Rotinas diárias */}
          {cal.diarias.length > 0 && (
            <div className="mt-4 rounded-xl bg-[#F5F0EB] border border-[#DDC7A4]/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#D78B18] flex items-center gap-1.5 mb-1"><Sun size={14} /> Todo dia</p>
              <p className="text-[11px] text-[#392617]/50 mb-2">Estas rotinas se repetem todos os dias — acompanhe na aba <b>Hoje</b>.</p>
              <div className="flex flex-wrap gap-1.5">
                {cal.diarias.map((d) => (
                  <span key={d.chave} className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-white border border-[#DDC7A4] rounded-full px-2.5 py-1">
                    <Dot cor={corArea(d.area)} /> {d.titulo}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de criação/delegação */}
      {criarEm && resp && (
        <ModalCriar
          dataISO={criarEm}
          perfil={resp.perfil}
          unidades={resp.unidades}
          unidadeAtualSlug={resp.unidadeAtual.slug}
          onFechar={() => setCriarEm(null)}
          onCriado={() => { setCriarEm(null); carregar(unidadeSlug, ref?.ano, ref?.mes) }}
        />
      )}
    </div>
  )
}

// ─── Peças ──────────────────────────────────────────────────────────────────────
function CartaoResumo({ estado, valor }: { estado: Estado; valor: number }) {
  const info = ESTADO[estado]
  const Icone = info.Icone
  return (
    <div className="rounded-xl bg-white border p-2 sm:p-2.5 text-center" style={{ borderColor: `${info.cor}40` }}>
      <Icone size={16} className="mx-auto mb-0.5" style={{ color: info.cor }} />
      <p className="text-xl font-bold leading-none" style={{ color: info.cor }}>{valor}</p>
      <p className="text-[10px] font-medium mt-0.5" style={{ color: info.cor }}>{info.rotulo}</p>
    </div>
  )
}

function ChipEvento({ e, onClick }: { e: Evento; onClick: (d: string, f: string) => void }) {
  const info = ESTADO[e.estado]
  const Icone = info.Icone
  const foco = e.tipo === 'mensal-limite' ? e.titulo.replace(/ — prazo final$/, '') : e.titulo
  const extra = e.origemAcao !== 'catalogo'
  return (
    <button onClick={() => onClick(e.dataAcaoISO, foco)}
      title={`${e.titulo} · ${rotuloArea(e.area)} · ${info.rotulo}${extra ? ` · ${rotuloOrigem(e.origemAcao)}` : ''}${e.ateDia && e.tipo === 'mensal-inicio' ? ` (até dia ${e.ateDia})` : ''}`}
      className={`group flex items-center gap-1 text-left rounded px-1 py-0.5 hover:brightness-95 transition ${extra ? 'border border-dashed' : ''}`}
      style={{ backgroundColor: `${info.cor}16`, borderColor: extra ? `${info.cor}66` : undefined }}>
      <Icone size={11} className="shrink-0" style={{ color: info.cor }} />
      <span className="text-[10px] leading-tight font-medium truncate" style={{ color: info.cor }}>{e.titulo}</span>
    </button>
  )
}

function LinhaEvento({ e, onClick }: { e: Evento; onClick: (d: string, f: string) => void }) {
  const info = ESTADO[e.estado]
  const Icone = info.Icone
  const foco = e.tipo === 'mensal-limite' ? e.titulo.replace(/ — prazo final$/, '') : e.titulo
  return (
    <button onClick={() => onClick(e.dataAcaoISO, foco)}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[#F5F0EB]/60 active:bg-[#F5F0EB]">
      <Icone size={18} className="shrink-0" style={{ color: info.cor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#392617] truncate">{e.titulo}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <Badge cor={corArea(e.area)} texto={rotuloArea(e.area)} />
          <Badge cor={info.cor} texto={info.rotulo} />
          {e.origemAcao !== 'catalogo' && <Badge cor="#7E0000" texto={rotuloOrigem(e.origemAcao)} escuro />}
          {e.tipo === 'mensal-inicio' && e.ateDia && <Badge cor="#A9906B" texto={`até dia ${e.ateDia}`} escuro />}
          {e.estado === 'concluida' && e.concluidaPorNome && <span className="text-[10px] text-[#425F1D]">✓ {e.concluidaPorNome}</span>}
        </div>
      </div>
      <Chevron size={16} className="text-[#392617]/30 shrink-0" />
    </button>
  )
}

const DIAS_SEMANA_EXT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
type Freq = 'PONTUAL' | 'SEMANAL' | 'MENSAL'

function ModalCriar({
  dataISO, perfil, unidades, unidadeAtualSlug, onFechar, onCriado,
}: {
  dataISO: string; perfil: string; unidades: Unidade[]; unidadeAtualSlug: string
  onFechar: () => void; onCriado: () => void
}) {
  const podeEscolherArea = perfil === 'DONA' || perfil === 'COORDENACAO'
  const podeMultiUnidade = perfil === 'DONA'
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [area, setArea] = useState(perfil === 'RECEPCAO' ? 'RECEPCAO' : 'COORDENACAO')
  const [dia, setDia] = useState(dataISO)
  const [freq, setFreq] = useState<Freq>('PONTUAL')
  const [unidadesSel, setUnidadesSel] = useState<string[]>([unidadeAtualSlug])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const dref = new Date(`${dia}T00:00:00`)
  const diaSemana = dref.getDay()
  const diaDoMes = Math.min(dref.getDate(), 28)
  const ajuda = freq === 'SEMANAL' ? `Repete toda ${DIAS_SEMANA_EXT[diaSemana]}.`
    : freq === 'MENSAL' ? `Repete todo dia ${diaDoMes} do mês.`
    : 'Acontece uma única vez.'

  const todasSel = unidadesSel.length === unidades.length && unidades.length > 1
  function toggleUnidade(slug: string) {
    setUnidadesSel((cur) => cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug])
  }

  async function enviar() {
    if (!titulo.trim() || unidadesSel.length === 0) return
    setEnviando(true); setErro(null)
    const url = freq === 'PONTUAL' ? '/api/rotinas/delegar' : '/api/rotinas/template'
    const payload = freq === 'PONTUAL'
      ? { unidades: unidadesSel, area, titulo, descricao, prazo: dia, data: dia }
      : {
          unidades: unidadesSel, area, titulo, descricao, frequencia: freq,
          diaSemana: freq === 'SEMANAL' ? diaSemana : undefined,
          diaDoMes: freq === 'MENSAL' ? diaDoMes : undefined,
        }
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setEnviando(false)
    if (r.ok) onCriado()
    else setErro((await r.json().catch(() => ({}))).error || 'Não foi possível criar.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl border border-[#DDC7A4] w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-[#7E0000]">Nova ação</p>
          <button onClick={onFechar} className="text-[#392617]/40 hover:text-[#7E0000]"><X size={18} /></button>
        </div>

        {/* Tipo: pontual / semanal / mensal */}
        <div className="inline-flex rounded-lg border border-[#DDC7A4] bg-[#F5F0EB] p-0.5 w-full">
          {(['PONTUAL', 'SEMANAL', 'MENSAL'] as Freq[]).map((f) => (
            <button key={f} onClick={() => setFreq(f)}
              className={`flex-1 text-xs font-medium rounded-md px-2 py-1.5 transition-colors ${
                freq === f ? 'bg-[#7E0000] text-white' : 'text-[#392617]/70 hover:text-[#7E0000]'
              }`}>
              {f === 'PONTUAL' ? 'Pontual' : f === 'SEMANAL' ? 'Semanal' : 'Mensal'}
            </button>
          ))}
        </div>

        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" autoFocus
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Como fazer / detalhes (opcional)" rows={2}
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />

        {/* Unidade(s) */}
        <div>
          <p className="text-sm text-[#392617]/70 mb-1.5">Aplicar em:</p>
          {podeMultiUnidade ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {unidades.map((u) => (
                  <label key={u.slug} className={`flex items-center gap-2 text-[13px] rounded-lg border px-2.5 py-1.5 cursor-pointer ${
                    unidadesSel.includes(u.slug) ? 'border-[#7E0000] bg-[#7E0000]/5 text-[#7E0000] font-medium' : 'border-[#DDC7A4] text-[#392617]/70'
                  }`}>
                    <input type="checkbox" checked={unidadesSel.includes(u.slug)} onChange={() => toggleUnidade(u.slug)} className="accent-[#7E0000]" />
                    {u.nome}
                  </label>
                ))}
              </div>
              {unidades.length > 1 && (
                <button onClick={() => setUnidadesSel(todasSel ? [unidadeAtualSlug] : unidades.map((u) => u.slug))}
                  className="mt-1.5 text-[11px] font-medium text-[#7E0000] hover:underline">
                  {todasSel ? 'Limpar seleção' : 'Selecionar todas as unidades'}
                </button>
              )}
            </>
          ) : unidades.length > 1 ? (
            <select value={unidadesSel[0]} onChange={(e) => setUnidadesSel([e.target.value])}
              className="w-full border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm">
              {unidades.map((u) => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
            </select>
          ) : (
            <p className="text-sm font-medium text-[#392617]">{unidades[0]?.nome}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {podeEscolherArea && (
            <label className="text-sm text-[#392617]/70 flex items-center gap-2">
              Para:
              <select value={area} onChange={(e) => setArea(e.target.value)} className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm">
                <option value="COORDENACAO">Coordenação</option>
                <option value="RECEPCAO">Recepção</option>
              </select>
            </label>
          )}
          <label className="text-sm text-[#392617]/70 flex items-center gap-2">
            {freq === 'PONTUAL' ? 'Prazo:' : 'A partir de:'}
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-sm" />
          </label>
        </div>
        <p className="text-[11px] text-[#D78B18] font-medium">
          {ajuda}{unidadesSel.length > 1 ? ` Em ${unidadesSel.length} unidades.` : ''}
        </p>
        {erro && <p className="text-[11px] text-[#7E0000] font-medium">{erro}</p>}
        <button onClick={enviar} disabled={enviando || !titulo.trim() || unidadesSel.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2.5">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Criar ação
        </button>
      </div>
    </div>
  )
}

function Dot({ cor }: { cor: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
}
function Badge({ texto, cor, escuro }: { texto: string; cor: string; escuro?: boolean }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: escuro ? `${cor}30` : `${cor}22`, color: escuro ? '#392617' : cor }}>{texto}</span>
  )
}

/** Data local de hoje (YYYY-MM-DD). */
function hojeLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
