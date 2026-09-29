'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, CheckCircle2, XCircle, Camera, ClipboardList, Leaf, Moon, Zap,
  ThumbsUp, MessageSquareWarning, LogOut, CalendarDays, Hand, Clock, Wallet, FileText,
} from 'lucide-react'

// ─── Catálogo do bloquinho (espelha o papel de Recomendação) ────────────────────
const OLEOS = [
  { tipo: 'OLEO_CALMA', label: 'Óleo Calma' },
  { tipo: 'OLEO_ENERGIA', label: 'Óleo Energia' },
  { tipo: 'OLEO_SONO', label: 'Óleo Sono' },
]
const CHAS = [
  { tipo: 'CHA_INDIANO', label: 'Chá Indiano' },
  { tipo: 'CHA_DETOX', label: 'Chá Detox' },
  { tipo: 'CHA_ENERGIA', label: 'Chá Energia' },
  { tipo: 'CHA_RELAX', label: 'Chá Relax' },
]
const RETORNOS = [
  { tipo: 'PACOTE', label: 'Pacote de sessões' },
  { tipo: 'VOUCHER', label: 'Voucher' },
  { tipo: 'NOVO_AGENDAMENTO', label: 'Novo agendamento' },
]
const LABEL: Record<string, string> = Object.fromEntries(
  [...OLEOS, ...CHAS, ...RETORNOS].map((i) => [i.tipo, i.label]),
)

interface Recomendacao {
  notaSono: number | null; notaEnergia: number | null; notaEstresse: number | null
  pontosTensao: string | null; retorno: string | null; observacao: string | null
  temFoto: boolean; itens: string[]
}
interface Atendimento {
  belleId: string; clienteNome: string; servico: string | null; hora: string | null; data: string
  statusValidacao: string; observacaoContestacao: string | null
  recomendacao: Recomendacao | null
}
interface ApiResp {
  terapeuta: { nome: string; unidadeSlug: string } | null
  ref: string
  atendimentos: Atendimento[]
}

function dataCard(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
}
function mesLongo(ref: string) {
  const [a, m] = ref.split('-').map(Number)
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${meses[m - 1]} de ${a}`
}

export default function MeusAtendimentosPage() {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams(window.location.search)
    const q = p.get('data') ? `?data=${encodeURIComponent(p.get('data')!)}` : ''
    const r = await fetch(`/api/meus-atendimentos${q}`, { cache: 'no-store' })
    const j: ApiResp = await r.json()
    setResp(j)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const atends = resp?.atendimentos ?? []
  // Contestados não pedem recomendação — ficam fora da conta.
  const recomendaveis = atends.filter((a) => a.statusValidacao !== 'CONTESTADO')
  const totalRecomendado = recomendaveis.filter((a) => a.recomendacao).length

  return (
    <div className="min-h-screen bg-[#E4E5E2]">
      {/* Cabeçalho */}
      <header className="bg-[#7E0000] text-white px-4 py-4 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#DDC7A4]">Buddha Spa</p>
            <h1 className="text-xl font-bold leading-tight">Meus Atendimentos</h1>
            {resp?.terapeuta && (
              <p className="text-[13px] text-white/80 mt-0.5">Olá, {resp.terapeuta.nome.split(' ')[0]} 🌿</p>
            )}
          </div>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login' }}
            className="text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 sm:px-6">
        {resp?.terapeuta && <CheckinBola />}
        {resp?.terapeuta && <MinhaComissao />}
        {resp?.terapeuta && (
          <p className="text-sm text-[#392617]/70 mb-1">Atendimentos de {mesLongo(resp.ref)}</p>
        )}
        {resp?.terapeuta && (
          <div className="mb-4 flex items-center gap-2 text-[13px] text-[#392617]/80 bg-white rounded-xl border border-[#DDC7A4] px-3 py-2">
            <ClipboardList size={16} className="text-[#7E0000]" />
            <span><strong className="text-[#7E0000]">{totalRecomendado}</strong> de <strong>{recomendaveis.length}</strong> atendimentos do mês com recomendação</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
        ) : !resp?.terapeuta ? (
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-8 text-center text-[#392617]/70">
            Este acesso não está vinculado a uma terapeuta.
          </div>
        ) : atends.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-8 text-center text-[#392617]/70">
            Nenhum atendimento neste mês ainda. Assim que os atendimentos entrarem, eles aparecem aqui. 🌸
          </div>
        ) : (
          <div className="space-y-3">
            {atends.map((a) => <CardAtendimento key={a.belleId} at={a} onMudou={carregar} />)}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Check-in da bola ("Cheguei") ───────────────────────────────────────────────
// A ação diária da terapeuta: marca presença e entra na fila do rodízio. Substitui
// o caderno da recepção. Turno/preferencial/sala vêm do Belle; aqui só a chegada.
function horaSP(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function CheckinBola() {
  const [carregando, setCarregando] = useState(true)
  const [marcando, setMarcando] = useState(false)
  const [naFila, setNaFila] = useState(false)
  const [posicao, setPosicao] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [chegada, setChegada] = useState<string | null>(null)

  const buscar = useCallback(async () => {
    try {
      const r = await fetch('/api/bola/meu-checkin', { cache: 'no-store' })
      const j = await r.json()
      if (j.terapeuta) { setNaFila(!!j.checkedIn); setPosicao(j.posicao); setTotal(j.totalNaFila); setChegada(j.chegadaEm) }
    } finally { setCarregando(false) }
  }, [])

  useEffect(() => { const t = setTimeout(buscar, 0); return () => clearTimeout(t) }, [buscar])

  async function cheguei() {
    setMarcando(true)
    try {
      const r = await fetch('/api/bola/checkin', { method: 'POST' })
      const j = await r.json()
      if (r.ok) { setNaFila(true); setPosicao(j.posicao); setTotal(j.totalNaFila); setChegada(j.chegadaEm) }
    } finally { setMarcando(false) }
  }

  if (carregando) return <div className="h-[76px] mb-4 rounded-2xl bg-white/60 border border-[#DDC7A4] animate-pulse" />

  if (naFila) {
    return (
      <div className="mb-4 rounded-2xl border border-[#425F1D]/40 bg-[#425F1D]/[0.08] px-4 py-3.5 flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-[#425F1D] text-white flex items-center justify-center">
          <CheckCircle2 size={22} />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-bold text-[#2f4a15]">Você está na bola</p>
          <p className="text-[13px] text-[#392617]/70 inline-flex items-center gap-1.5">
            {posicao != null && <span><strong>{posicao}ª</strong> de {total} na fila</span>}
            {chegada && <span className="inline-flex items-center gap-1"><Clock size={12} /> desde {horaSP(chegada)}</span>}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border border-[#DDC7A4] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-[#392617]">Chegou na unidade?</p>
          <p className="text-[13px] text-[#392617]/65">Toque para entrar na fila da bola de hoje.</p>
        </div>
        <button onClick={cheguei} disabled={marcando}
          className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-60 rounded-xl px-5 py-3 shadow-sm">
          {marcando ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />} Cheguei
        </button>
      </div>
    </div>
  )
}

// ─── Minha comissão (read-only, lida da Folha) ───────────────────────────────────
// A terapeuta vê "quanto vou receber" sem abrir o Folha. Fonte: /api/minha-comissao,
// que lê ao vivo a integração da Folha. Bruto por ora; líquido quando enriquecermos.
function MinhaComissao() {
  const [carregando, setCarregando] = useState(true)
  const [d, setD] = useState<{
    disponivel: boolean; encontrada?: boolean; comissaoBruta?: number
    nfEmitida?: boolean; nfNumero?: string | null; ano?: number; mes?: number; motivo?: string
  } | null>(null)

  const buscar = useCallback(async () => {
    try {
      const r = await fetch('/api/minha-comissao', { cache: 'no-store' })
      const j = await r.json()
      if (j.terapeuta) setD(j)
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { const t = setTimeout(buscar, 0); return () => clearTimeout(t) }, [buscar])

  if (carregando) return <div className="h-[64px] mb-4 rounded-2xl bg-white/60 border border-[#DDC7A4] animate-pulse" />
  if (!d) return null

  const meses = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const ref = d.mes ? `${meses[d.mes]}/${d.ano}` : 'do mês'
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (!d.disponivel || !d.encontrada) {
    return (
      <div className="mb-4 rounded-2xl border border-[#DDC7A4] bg-white px-4 py-3 flex items-center gap-2.5 text-[13px] text-[#392617]/60">
        <Wallet size={16} className="text-[#7E0000]/60" />
        <span>Comissão de {ref}: {d.motivo || 'indisponível no momento'}.</span>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border border-[#D78B18]/40 bg-[#D78B18]/[0.07] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-9 h-9 rounded-full bg-[#D78B18] text-white flex items-center justify-center"><Wallet size={18} /></div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#9a6410] font-bold">Minha comissão · {ref}</p>
            <p className="text-[18px] font-bold text-[#7E0000] leading-tight">
              {brl(d.comissaoBruta || 0)} <span className="text-[11px] font-medium text-[#392617]/55">(bruto)</span>
            </p>
          </div>
        </div>
        <div className="text-right text-[12px]">
          {d.nfEmitida
            ? <span className="inline-flex items-center gap-1 text-[#425F1D] font-semibold"><FileText size={13} /> NF nº {d.nfNumero}</span>
            : <span className="inline-flex items-center gap-1 text-[#9a6410] font-semibold"><FileText size={13} /> NF a emitir</span>}
        </div>
      </div>
    </div>
  )
}

function Pill({ tone, icon, children }: { tone: 'verde' | 'marsala' | 'ambar' | 'cinza'; icon?: React.ReactNode; children: React.ReactNode }) {
  const map: Record<string, string> = {
    verde: 'text-[#425F1D] bg-[#425F1D]/10',
    marsala: 'text-[#7E0000] bg-[#7E0000]/10',
    ambar: 'text-[#9a6410] bg-[#D78B18]/15',
    cinza: 'text-[#392617]/55 bg-[#392617]/[0.06]',
  }
  return <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${map[tone]}`}>{icon}{children}</span>
}

function CardAtendimento({ at, onMudou }: { at: Atendimento; onMudou: () => void }) {
  const [aberto, setAberto] = useState(false)
  const contestado = at.statusValidacao === 'CONTESTADO'
  const temRec = !!at.recomendacao

  return (
    <div className="bg-white rounded-2xl border border-[#DDC7A4] overflow-hidden">
      {/* Cliente + data do atendimento */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-bold text-[#392617]">{at.clienteNome}</p>
          <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-[#7E0000] bg-[#7E0000]/10 rounded-full px-2 py-1 capitalize">
            <CalendarDays size={12} /> {dataCard(at.data)}
          </span>
        </div>
        <p className="text-[13px] text-[#392617]/70">{at.servico || 'Atendimento'}{at.hora ? ` · ${at.hora}` : ''}</p>
      </div>

      {/* Bloco 1 — Atendimento (validação) */}
      <section className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#392617]/45">
            <ThumbsUp size={12} /> Atendimento
          </span>
          {at.statusValidacao === 'CONFIRMADO' && <Pill tone="verde" icon={<CheckCircle2 size={12} />}>Confirmado</Pill>}
          {contestado && <Pill tone="marsala" icon={<MessageSquareWarning size={12} />}>Contestado</Pill>}
          {at.statusValidacao === 'PENDENTE' && <Pill tone="cinza">A validar</Pill>}
        </div>
        <BlocoValidacao at={at} onMudou={onMudou} />
      </section>

      {/* Bloco 2 — Recomendação (MESMO peso da validação). Some se contestado. */}
      {contestado ? (
        <div className="mt-2 px-4 py-3 border-t border-[#DDC7A4]/60 text-[12px] text-[#392617]/50 italic">
          Atendimento contestado — recomendação não se aplica.
        </div>
      ) : (
        <section className="mt-2 border-t-2 border-[#D78B18]/30 bg-[#D78B18]/[0.07] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7E0000]">
              <ClipboardList size={13} /> Recomendação
            </span>
            {temRec ? <Pill tone="verde" icon={<CheckCircle2 size={12} />}>Registrada</Pill> : <Pill tone="ambar">A registrar</Pill>}
          </div>

          {aberto ? (
            <FormBloquinho at={at} onSalvo={() => { setAberto(false); onMudou() }} />
          ) : temRec ? (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {at.recomendacao!.itens.map((t) => (
                  <span key={t} className="text-[11px] bg-white border border-[#DDC7A4] rounded-full px-2 py-0.5 text-[#392617]/80">{LABEL[t] || t}</span>
                ))}
                {at.recomendacao!.temFoto && (
                  <span className="text-[11px] inline-flex items-center gap-1 bg-white border border-[#DDC7A4] rounded-full px-2 py-0.5 text-[#392617]/80"><Camera size={11} /> foto</span>
                )}
              </div>
              {at.recomendacao!.retorno && <p className="text-[12px] text-[#392617]/60 italic mt-1.5">“{at.recomendacao!.retorno}”</p>}
              <button onClick={() => setAberto(true)} className="mt-2 text-[13px] font-medium text-[#7E0000] underline">Editar recomendação</button>
            </div>
          ) : (
            <button onClick={() => setAberto(true)}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#D78B18] hover:bg-[#c07d13] rounded-lg px-4 py-3 shadow-sm">
              <ClipboardList size={17} /> Registrar recomendação
            </button>
          )}
        </section>
      )}
    </div>
  )
}

function BlocoValidacao({ at, onMudou }: { at: Atendimento; onMudou: () => void }) {
  const [modoContestar, setModoContestar] = useState(false)
  const [motivo, setMotivo] = useState(at.observacaoContestacao || '')
  const [salvando, setSalvando] = useState(false)

  async function validar(status: string, observacao?: string) {
    setSalvando(true)
    await fetch('/api/meus-atendimentos/validar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ belleId: at.belleId, status, observacaoContestacao: observacao }),
    })
    setSalvando(false); setModoContestar(false); onMudou()
  }

  if (at.statusValidacao === 'CONFIRMADO') {
    return (
      <button onClick={() => validar('PENDENTE')} disabled={salvando}
        className="mt-3 text-[12px] text-[#392617]/60 hover:text-[#7E0000] underline">
        desfazer confirmação
      </button>
    )
  }

  if (at.statusValidacao === 'CONTESTADO') {
    return (
      <div className="mt-3 text-[13px] text-[#7E0000]">
        <p className="italic">“{at.observacaoContestacao}”</p>
        <button onClick={() => validar('PENDENTE')} disabled={salvando} className="text-[12px] text-[#392617]/60 hover:text-[#7E0000] underline mt-1">reabrir</button>
      </div>
    )
  }

  if (modoContestar) {
    return (
      <div className="mt-3 space-y-2">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} autoFocus
          placeholder="O que está diferente neste atendimento?"
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
        <div className="flex gap-2">
          <button onClick={() => validar('CONTESTADO', motivo)} disabled={salvando || !motivo.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#7E0000] disabled:opacity-50 rounded-lg px-3 py-2">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <MessageSquareWarning size={15} />} Enviar contestação
          </button>
          <button onClick={() => setModoContestar(false)} className="px-3 py-2 text-sm text-[#392617]/70">Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button onClick={() => validar('CONFIRMADO')} disabled={salvando}
        className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#425F1D] hover:bg-[#374f18] disabled:opacity-50 rounded-lg px-3 py-2.5">
        {salvando ? <Loader2 size={15} className="animate-spin" /> : <ThumbsUp size={15} />} Confirmar
      </button>
      <button onClick={() => setModoContestar(true)} disabled={salvando}
        className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#7E0000] border border-[#7E0000]/30 hover:bg-[#7E0000]/5 rounded-lg px-3 py-2.5">
        <XCircle size={15} /> Contestar
      </button>
    </div>
  )
}

function Escala({ label, icone, valor, onChange }: { label: string; icone: React.ReactNode; valor: number | null; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 text-[13px] text-[#392617]/80">{icone} {label}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
              valor === n ? 'bg-[#7E0000] text-white border-[#7E0000]' : 'bg-white text-[#392617]/70 border-[#DDC7A4] hover:border-[#D78B18]'
            }`}>{n}</button>
        ))}
      </div>
    </div>
  )
}

function FormBloquinho({ at, onSalvo }: { at: Atendimento; onSalvo: () => void }) {
  const r = at.recomendacao
  const [sono, setSono] = useState<number | null>(r?.notaSono ?? null)
  const [energia, setEnergia] = useState<number | null>(r?.notaEnergia ?? null)
  const [estresse, setEstresse] = useState<number | null>(r?.notaEstresse ?? null)
  const [itens, setItens] = useState<Set<string>>(new Set(r?.itens ?? []))
  const [pontos, setPontos] = useState(r?.pontosTensao ?? '')
  const [retorno, setRetorno] = useState(r?.retorno ?? '')
  const [obs, setObs] = useState(r?.observacao ?? '')
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(r?.temFoto ? `/api/meus-atendimentos/foto?f=recomendacao/${at.belleId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg` : null)
  const [salvando, setSalvando] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  function toggle(tipo: string) {
    setItens((prev) => { const n = new Set(prev); n.has(tipo) ? n.delete(tipo) : n.add(tipo); return n })
  }
  function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFoto(f); setPreview(URL.createObjectURL(f)) }
  }

  async function salvar() {
    setSalvando(true)
    const fd = new FormData()
    fd.set('belleId', at.belleId)
    if (sono != null) fd.set('notaSono', String(sono))
    if (energia != null) fd.set('notaEnergia', String(energia))
    if (estresse != null) fd.set('notaEstresse', String(estresse))
    fd.set('pontosTensao', pontos)
    fd.set('retorno', retorno)
    fd.set('observacao', obs)
    fd.set('itens', JSON.stringify([...itens]))
    if (foto) fd.set('foto', foto)
    await fetch('/api/meus-atendimentos/recomendacao', { method: 'POST', body: fd })
    setSalvando(false); onSalvo()
  }

  const Chip = ({ tipo, label }: { tipo: string; label: string }) => (
    <button type="button" onClick={() => toggle(tipo)}
      className={`text-[13px] rounded-full px-3 py-1.5 border transition-colors ${
        itens.has(tipo) ? 'bg-[#D78B18] text-white border-[#D78B18]' : 'bg-white text-[#392617]/80 border-[#DDC7A4] hover:border-[#D78B18]'
      }`}>{label}</button>
  )

  return (
    <div className="space-y-4 pt-1">
      {/* Escalas 1..5 */}
      <div className="grid grid-cols-1 gap-3">
        <Escala label="Qualidade do sono" icone={<Moon size={14} className="text-[#7E0000]" />} valor={sono} onChange={setSono} />
        <Escala label="Nível de energia" icone={<Zap size={14} className="text-[#D78B18]" />} valor={energia} onChange={setEnergia} />
        <Escala label="Nível de estresse" icone={<Leaf size={14} className="text-[#425F1D]" />} valor={estresse} onChange={setEstresse} />
      </div>

      <label className="block">
        <span className="text-[13px] text-[#392617]/80">Pontos de tensão identificados</span>
        <textarea value={pontos} onChange={(e) => setPontos(e.target.value)} rows={2}
          className="mt-1 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      </label>

      <div>
        <p className="text-[13px] font-semibold text-[#7E0000] mb-1.5">Óleos essenciais</p>
        <div className="flex flex-wrap gap-1.5">{OLEOS.map((o) => <Chip key={o.tipo} tipo={o.tipo} label={o.label} />)}</div>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#7E0000] mb-1.5">Chás</p>
        <div className="flex flex-wrap gap-1.5">{CHAS.map((c) => <Chip key={c.tipo} tipo={c.tipo} label={c.label} />)}</div>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#7E0000] mb-1.5">Retorno / próximos passos</p>
        <div className="flex flex-wrap gap-1.5 mb-2">{RETORNOS.map((c) => <Chip key={c.tipo} tipo={c.tipo} label={c.label} />)}</div>
        <input value={retorno} onChange={(e) => setRetorno(e.target.value)} placeholder="Ex.: massagem relaxante a cada 15 dias"
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      </div>

      {/* Foto do bloquinho */}
      <div>
        <p className="text-[13px] font-semibold text-[#7E0000] mb-1.5">Foto do bloquinho (opcional)</p>
        <input ref={inputFoto} type="file" accept="image/*" capture="environment" onChange={onFoto} className="hidden" />
        {preview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Bloquinho" className="max-h-48 rounded-lg border border-[#DDC7A4]" />
            <button onClick={() => inputFoto.current?.click()} className="mt-1 block text-[12px] text-[#7E0000] underline">trocar foto</button>
          </div>
        ) : (
          <button type="button" onClick={() => inputFoto.current?.click()}
            className="inline-flex items-center gap-2 text-sm text-[#7E0000] border border-dashed border-[#7E0000]/40 rounded-lg px-4 py-3 hover:bg-[#7E0000]/5">
            <Camera size={18} /> Tirar / anexar foto
          </button>
        )}
      </div>

      <label className="block">
        <span className="text-[13px] text-[#392617]/80">Observação (opcional)</span>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
          className="mt-1 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      </label>

      <button onClick={salvar} disabled={salvando}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-3">
        {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Salvar recomendação
      </button>
    </div>
  )
}
