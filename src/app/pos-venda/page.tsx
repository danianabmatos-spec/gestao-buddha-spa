'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, MessageCircle, ShoppingBag, XCircle, CheckCircle2, LogOut, HeartHandshake,
  CalendarDays, RotateCcw,
} from 'lucide-react'

const LABEL: Record<string, string> = {
  OLEO_CALMA: 'Óleo Calma', OLEO_ENERGIA: 'Óleo Energia', OLEO_SONO: 'Óleo Sono',
  CHA_INDIANO: 'Chá Indiano', CHA_DETOX: 'Chá Detox', CHA_ENERGIA: 'Chá Energia', CHA_RELAX: 'Chá Relax',
  PACOTE: 'Pacote', VOUCHER: 'Voucher', NOVO_AGENDAMENTO: 'Novo agendamento', PRODUTO_OUTRO: 'Produto', RETORNO: 'Retorno',
}
const CONVERSOES = [
  { tipo: 'VOUCHER', label: 'Voucher' },
  { tipo: 'NOVO_AGENDAMENTO', label: 'Novo agendamento' },
  { tipo: 'PRODUTO', label: 'Produto' },
  { tipo: 'PACOTE', label: 'Pacote' },
]

interface Unidade { slug: string; nome: string }
interface Item { tipo: string; quantidade: number }
interface Rec {
  belleId: string; recomendacaoId: number; clienteNome: string; clienteTelefone: string | null
  terapeutaNome: string; dataAtendimento: string; servico: string | null; retorno: string | null
  itens: string[]; status: string; venda: { itens: Item[] } | null
}
interface ApiResp { unidadeAtual: Unidade; unidades: Unidade[]; status: string; fila: Rec[] }

const STATUS_TABS = [
  { key: 'PENDENTE_VENDA', label: 'A trabalhar' },
  { key: 'VENDIDA', label: 'Vendidas' },
  { key: 'SEM_VENDA', label: 'Sem venda' },
  { key: 'TODOS', label: 'Todas' },
]

function dataBR(iso: string) { return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` }

function resumoRecomendacao(r: Rec): string {
  const partes = r.itens.map((t) => LABEL[t] || t)
  if (r.retorno) partes.push(r.retorno)
  return partes.join(', ')
}
function montarMensagem(r: Rec, unidadeNome: string): string {
  const primeiro = r.clienteNome.split(' ')[0]
  const rec = resumoRecomendacao(r) || 'um momento de cuidado só seu'
  const terapeuta = r.terapeutaNome.split(' ')[0]
  return `Olá, ${primeiro}! 🌿 Aqui é do Buddha Spa ${unidadeNome}. Foi um prazer receber você. A ${terapeuta} preparou uma recomendação especial pra você seguir cuidando de você: ${rec}. Que tal reservar esse momento que você merece? Vou adorar te receber de novo 💆✨`
}
function linkWhatsapp(tel: string, msg: string): string {
  const num = tel.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

export default function PosVendaPage() {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)
  const [status, setStatus] = useState('PENDENTE_VENDA')

  const carregar = useCallback(async (u?: string | null, st?: string) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (u) p.set('unidade', u)
    if (st) p.set('status', st)
    const r = await fetch(`/api/pos-venda?${p.toString()}`, { cache: 'no-store' })
    const j: ApiResp = await r.json()
    setResp(j); setSlug(j.unidadeAtual?.slug ?? null); setStatus(j.status ?? 'PENDENTE_VENDA')
    setLoading(false)
  }, [])

  useEffect(() => {
    // A unidade vem do menu (?unidade=slug) e fica TRAVADA — sem seletor.
    const u = new URLSearchParams(window.location.search).get('unidade')
    carregar(u, 'PENDENTE_VENDA')
  }, [carregar])

  const r = resp

  return (
    <div className="min-h-screen bg-[#E4E5E2]">
      <header className="bg-[#7E0000] text-white px-4 py-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#DDC7A4]">Buddha Spa · Recepção</p>
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2"><HeartHandshake size={20} /> Pós-venda</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-white/80 hover:text-white text-sm">← Painel</a>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login' }}
              className="text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"><LogOut size={16} /> Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {r && <span className="text-sm font-bold text-[#7E0000] inline-flex items-center">{r.unidadeAtual.nome}</span>}
          <div className="flex gap-1 bg-white border border-[#DDC7A4] rounded-lg p-1">
            {STATUS_TABS.map((t) => (
              <button key={t.key} onClick={() => { setStatus(t.key); carregar(slug, t.key) }}
                className={`text-[13px] px-3 py-1.5 rounded-md font-medium ${status === t.key ? 'bg-[#7E0000] text-white' : 'text-[#392617]/70 hover:bg-[#7E0000]/5'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
        ) : !r || r.fila.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-8 text-center text-[#392617]/70">
            Nenhuma recomendação nesta lista. 🌸
          </div>
        ) : (
          <div className="space-y-3">
            {r.fila.map((rec) => <CardPosVenda key={rec.belleId} rec={rec} unidadeNome={r.unidadeAtual.nome} onMudou={() => carregar(slug, status)} />)}
          </div>
        )}
      </main>
    </div>
  )
}

function CardPosVenda({ rec, unidadeNome, onMudou }: { rec: Rec; unidadeNome: string; onMudou: () => void }) {
  const [tel, setTel] = useState(rec.clienteTelefone ?? '')
  const [registrando, setRegistrando] = useState(false)
  const vendida = rec.status === 'VENDIDA'
  const semVenda = rec.status === 'SEM_VENDA'

  const msg = montarMensagem(rec, unidadeNome)

  return (
    <div className="bg-white rounded-2xl border border-[#DDC7A4] p-4">
      {/* Cliente + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] font-bold text-[#392617]">{rec.clienteNome}</p>
          <p className="text-[12px] text-[#392617]/60 flex items-center gap-1.5">
            <CalendarDays size={12} /> {dataBR(rec.dataAtendimento)} · terapeuta {rec.terapeutaNome.split(' ')[0]}
          </p>
        </div>
        {vendida && <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-[#425F1D] bg-[#425F1D]/10 rounded-full px-2 py-1"><CheckCircle2 size={13} /> Vendida</span>}
        {semVenda && <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-[#392617]/60 bg-[#392617]/[0.06] rounded-full px-2 py-1">Sem venda</span>}
      </div>

      {/* O que a terapeuta recomendou */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rec.itens.map((t) => <span key={t} className="text-[11px] bg-[#D78B18]/10 border border-[#D78B18]/30 rounded-full px-2 py-0.5 text-[#9a6410]">{LABEL[t] || t}</span>)}
      </div>
      {rec.retorno && <p className="text-[12px] text-[#392617]/70 italic mt-1.5">Retorno: “{rec.retorno}”</p>}

      {/* WhatsApp */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!rec.clienteTelefone && (
          <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="WhatsApp do cliente (DDD + número)" inputMode="tel"
            className="flex-1 min-w-[180px] border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
        )}
        <a
          href={tel.replace(/\D/g, '').length >= 10 ? linkWhatsapp(tel, msg) : undefined}
          target="_blank" rel="noopener noreferrer"
          onClick={(e) => { if (tel.replace(/\D/g, '').length < 10) e.preventDefault() }}
          className={`inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-4 py-2.5 ${
            tel.replace(/\D/g, '').length >= 10 ? 'text-white bg-[#25D366] hover:bg-[#1eb658]' : 'text-[#392617]/40 bg-[#392617]/[0.06] cursor-not-allowed'
          }`}>
          <MessageCircle size={16} /> Convidar pelo WhatsApp
        </a>
      </div>

      {/* Ação: registrar venda / sem venda */}
      {vendida ? (
        <div className="mt-3 border-t border-[#DDC7A4]/60 pt-3">
          <p className="text-[12px] text-[#392617]/70">Convertido em: <strong className="text-[#425F1D]">{(rec.venda?.itens ?? []).map((i) => `${LABEL[i.tipo] || i.tipo}${i.tipo === 'PACOTE' || i.quantidade > 1 ? ` (${i.quantidade})` : ''}`).join(', ')}</strong></p>
          <FormVenda rec={rec} onSalvo={onMudou} compacto />
        </div>
      ) : (
        <div className="mt-3 border-t border-[#DDC7A4]/60 pt-3">
          {!registrando ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setRegistrando(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] rounded-lg px-4 py-2.5">
                <ShoppingBag size={16} /> Registrar venda
              </button>
              {!semVenda ? (
                <button onClick={async () => { await fetch('/api/pos-venda/sem-venda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ belleId: rec.belleId }) }); onMudou() }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#392617]/70 border border-[#DDC7A4] hover:bg-[#392617]/[0.03] rounded-lg px-4 py-2.5">
                  <XCircle size={15} /> Sem venda
                </button>
              ) : (
                <button onClick={async () => { await fetch('/api/pos-venda/sem-venda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ belleId: rec.belleId, reabrir: true }) }); onMudou() }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#7E0000] border border-[#7E0000]/30 hover:bg-[#7E0000]/5 rounded-lg px-4 py-2.5">
                  <RotateCcw size={15} /> Reabrir
                </button>
              )}
            </div>
          ) : (
            <FormVenda rec={rec} onSalvo={() => { setRegistrando(false); onMudou() }} onCancelar={() => setRegistrando(false)} />
          )}
        </div>
      )}
    </div>
  )
}

function FormVenda({ rec, onSalvo, onCancelar, compacto }: { rec: Rec; onSalvo: () => void; onCancelar?: () => void; compacto?: boolean }) {
  const inicial = new Map((rec.venda?.itens ?? []).map((i) => [i.tipo, i.quantidade]))
  const [sel, setSel] = useState<Map<string, number>>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(!compacto)

  function toggle(tipo: string) {
    setSel((prev) => { const n = new Map(prev); n.has(tipo) ? n.delete(tipo) : n.set(tipo, 1); return n })
  }
  function setQtd(tipo: string, q: number) {
    setSel((prev) => { const n = new Map(prev); n.set(tipo, Math.max(1, q)); return n })
  }

  async function salvar() {
    const itens = [...sel.entries()].map(([tipo, quantidade]) => ({ tipo, quantidade }))
    if (itens.length === 0) return
    setSalvando(true)
    await fetch('/api/pos-venda/venda', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ belleId: rec.belleId, itens }),
    })
    setSalvando(false); onSalvo()
  }

  if (compacto && !aberto) {
    return <button onClick={() => setAberto(true)} className="mt-1 text-[13px] font-medium text-[#7E0000] underline">Editar venda</button>
  }

  return (
    <div className={compacto ? 'mt-2' : ''}>
      <p className="text-[12px] text-[#392617]/70 mb-1.5">O que o cliente comprou?</p>
      <div className="flex flex-wrap gap-2">
        {CONVERSOES.map((c) => {
          const ativo = sel.has(c.tipo)
          const precisaQtd = ativo && (c.tipo === 'PACOTE' || c.tipo === 'PRODUTO')
          return (
            <div key={c.tipo} className="flex items-center gap-1">
              <button type="button" onClick={() => toggle(c.tipo)}
                className={`text-[13px] rounded-full px-3 py-1.5 border ${ativo ? 'bg-[#425F1D] text-white border-[#425F1D]' : 'bg-white text-[#392617]/80 border-[#DDC7A4] hover:border-[#D78B18]'}`}>
                {c.label}
              </button>
              {precisaQtd && (
                <input type="number" min={1} value={sel.get(c.tipo) ?? 1} onChange={(e) => setQtd(c.tipo, Math.floor(Number(e.target.value) || 1))}
                  title={c.tipo === 'PACOTE' ? 'Nº de sessões pagas' : 'Quantidade'}
                  className="w-14 border border-[#DDC7A4] rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
              )}
            </div>
          )
        })}
      </div>
      {sel.has('PACOTE') && <p className="text-[11px] text-[#392617]/50 mt-1">Pacote: informe o nº de sessões pagas (cortesias não contam).</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={salvar} disabled={salvando || sel.size === 0}
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2.5">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Salvar venda
        </button>
        {onCancelar && <button onClick={onCancelar} className="px-3 py-2 text-sm text-[#392617]/70">Cancelar</button>}
      </div>
    </div>
  )
}
