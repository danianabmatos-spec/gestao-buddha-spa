'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2, MessageCircle, ShoppingBag, XCircle, CheckCircle2, LogOut, HeartHandshake,
  CalendarDays, RotateCcw, ClipboardList, ChevronDown, ChevronRight,
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
// Conversões que pedem QUANTIDADE (com rótulo e aviso claros na tela). NOVO_AGENDAMENTO
// é sempre 1. A quantidade É a pontuação: PACOTE = nº de sessões pagas; VOUCHER/PRODUTO = qtd.
const QTD_INFO: Record<string, { label: string; nota?: string }> = {
  PACOTE: {
    label: 'Quantas sessões PAGAS o cliente comprou no pacote?',
    nota: '⚠️ Só as sessões pagas pontuam — cortesias/bônus NÃO entram na pontuação.',
  },
  VOUCHER: {
    label: 'Quantos vouchers o cliente levou?',
    nota: 'Se levou mais de um, informe a quantidade — cada voucher conta 1 ponto.',
  },
  PRODUTO: { label: 'Quantos produtos o cliente levou?' },
}

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
  { key: 'SEM_RECOMENDACAO', label: 'Sem recomendação' },
  { key: 'VENDIDA', label: 'Vendidas' },
  { key: 'SEM_VENDA', label: 'Sem venda' },
  { key: 'TODOS', label: 'Todas' },
]

// Catálogo do bloquinho (p/ a recepção incluir o que a terapeuta indicou verbalmente).
const ITENS_REC: Record<string, { t: string; l: string }[]> = {
  'Óleos essenciais': [{ t: 'OLEO_CALMA', l: 'Óleo Calma' }, { t: 'OLEO_ENERGIA', l: 'Óleo Energia' }, { t: 'OLEO_SONO', l: 'Óleo Sono' }],
  'Chás': [{ t: 'CHA_INDIANO', l: 'Chá Indiano' }, { t: 'CHA_DETOX', l: 'Chá Detox' }, { t: 'CHA_ENERGIA', l: 'Chá Energia' }, { t: 'CHA_RELAX', l: 'Chá Relax' }],
  'Retorno / próximos passos': [{ t: 'PACOTE', l: 'Pacote de sessões' }, { t: 'VOUCHER', l: 'Voucher' }, { t: 'NOVO_AGENDAMENTO', l: 'Novo agendamento' }],
}

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  PENDENTE_VENDA: { txt: 'A trabalhar', cls: 'text-[#9a6410] bg-[#D78B18]/15' },
  VENDIDA: { txt: 'Vendida', cls: 'text-[#425F1D] bg-[#425F1D]/10' },
  SEM_VENDA: { txt: 'Sem venda', cls: 'text-[#392617]/55 bg-[#392617]/[0.06]' },
  SEM_RECOMENDACAO: { txt: 'Sem recomendação', cls: 'text-[#9a6410] bg-[#D78B18]/15' },
}

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
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

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
  const fila = resp?.fila ?? []
  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return q ? fila.filter((x) => x.clienteNome.toLowerCase().includes(q) || x.terapeutaNome.toLowerCase().includes(q)) : fila
  }, [fila, filtro])

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
        ) : !r || fila.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-8 text-center text-[#392617]/70">
            Nenhuma recomendação nesta lista. 🌸
          </div>
        ) : (
          <>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar cliente ou terapeuta…"
              className="mb-2 w-full sm:w-72 border border-[#DDC7A4] bg-white rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
            <div className="rounded-xl border border-[#DDC7A4] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-[#7E0000] text-white text-xs">
                      <th className="w-6"></th>
                      <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                      <th className="px-2 py-2 text-left font-semibold">Data</th>
                      <th className="px-3 py-2 text-left font-semibold">Terapeuta</th>
                      <th className="px-3 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDC7A4]/30">
                    {filtrados.map((rec) => {
                      const aberto = expandido === rec.belleId
                      const st = STATUS_LABEL[rec.status] ?? { txt: rec.status, cls: 'text-[#392617]/55 bg-[#392617]/[0.06]' }
                      return (
                        <Fragment key={rec.belleId}>
                          <tr className="hover:bg-[#FBF6EF] cursor-pointer" onClick={() => setExpandido(aberto ? null : rec.belleId)}>
                            <td className="px-1 text-center text-[#7E0000]">{aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                            <td className="px-3 py-2 font-medium text-[#392617] whitespace-nowrap">{rec.clienteNome}</td>
                            <td className="px-2 py-2 text-[#392617]/70 whitespace-nowrap">{dataBR(rec.dataAtendimento)}</td>
                            <td className="px-3 py-2 text-[#392617]/80 whitespace-nowrap">{rec.terapeutaNome.split(' ')[0]}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.txt}</span>
                            </td>
                          </tr>
                          {aberto && (
                            <tr className="bg-[#F5F0EB]/50">
                              <td colSpan={5} className="px-4 py-3">
                                <CardPosVenda rec={rec} unidadeNome={r.unidadeAtual.nome} onMudou={() => carregar(slug, status)} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    {filtrados.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[#392617]/50">Nenhum cliente com esse filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
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

  // Mensagem do convite — editável pela recepção antes de enviar pelo WhatsApp.
  const [msg, setMsg] = useState(() => montarMensagem(rec, unidadeNome))
  const [editarMsg, setEditarMsg] = useState(false)

  // Excluir lançamento feito errado → zera os pontos e volta pra "A trabalhar".
  async function excluirVenda() {
    if (!confirm('Excluir este lançamento de venda? Os pontos são zerados e a recomendação volta pra "A trabalhar".')) return
    await fetch('/api/pos-venda/excluir-venda', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ belleId: rec.belleId }),
    })
    onMudou()
  }

  // Atendimento sem bloquinho → a recepção inclui a recomendação que a terapeuta indicou.
  if (rec.status === 'SEM_RECOMENDACAO') {
    return <FormIncluirRec rec={rec} onSalvo={onMudou} />
  }

  // Conteúdo expandido da linha (o cliente/data/terapeuta/status vêm na linha-resumo).
  return (
    <div>
      {rec.servico && <p className="text-[12px] text-[#392617]/60 mb-2">{rec.servico}</p>}
      {/* O que a terapeuta recomendou */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rec.itens.map((t) => <span key={t} className="text-[11px] bg-[#D78B18]/10 border border-[#D78B18]/30 rounded-full px-2 py-0.5 text-[#9a6410]">{LABEL[t] || t}</span>)}
      </div>
      {rec.retorno && <p className="text-[12px] text-[#392617]/70 italic mt-1.5">Retorno: “{rec.retorno}”</p>}

      {/* WhatsApp — convite com mensagem EDITÁVEL antes de enviar */}
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <button type="button" onClick={() => setEditarMsg((v) => !v)} className="text-[12px] text-[#7E0000] underline">
            {editarMsg ? 'ocultar mensagem' : 'editar mensagem'}
          </button>
        </div>
        {editarMsg && (
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5}
            className="mt-2 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]"
            placeholder="Mensagem que vai pro cliente no WhatsApp" />
        )}
      </div>

      {/* Ação: registrar venda / sem venda */}
      {vendida ? (
        <div className="mt-3 border-t border-[#DDC7A4]/60 pt-3">
          <p className="text-[12px] text-[#392617]/70">Convertido em: <strong className="text-[#425F1D]">{(rec.venda?.itens ?? []).map((i) => `${LABEL[i.tipo] || i.tipo}${i.tipo === 'PACOTE' || i.quantidade > 1 ? ` (${i.quantidade})` : ''}`).join(', ')}</strong></p>
          <div className="flex items-center gap-4 mt-1">
            <FormVenda rec={rec} onSalvo={onMudou} compacto />
            <button onClick={excluirVenda} className="text-[13px] font-medium text-[#7E0000] underline inline-flex items-center gap-1">
              <XCircle size={13} /> Excluir venda
            </button>
          </div>
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
          return (
            <button key={c.tipo} type="button" onClick={() => toggle(c.tipo)}
              className={`text-[13px] rounded-full px-3 py-1.5 border ${ativo ? 'bg-[#425F1D] text-white border-[#425F1D]' : 'bg-white text-[#392617]/80 border-[#DDC7A4] hover:border-[#D78B18]'}`}>
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Quantidade (= pontuação) p/ os itens que precisam — com rótulo e aviso claros. */}
      {[...sel.keys()].filter((t) => QTD_INFO[t]).map((t) => (
        <div key={t} className="mt-2.5 rounded-lg border border-[#D78B18]/40 bg-[#D78B18]/[0.06] px-3 py-2.5">
          <label className="block text-[12px] font-semibold text-[#392617] mb-1.5">{QTD_INFO[t].label}</label>
          <input type="number" min={1} value={sel.get(t) ?? 1}
            onChange={(e) => setQtd(t, Math.floor(Number(e.target.value) || 1))}
            className="w-20 border border-[#DDC7A4] rounded-lg px-3 py-1.5 text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          {QTD_INFO[t].nota && <p className="text-[11px] text-[#9a6410] mt-1.5 leading-snug">{QTD_INFO[t].nota}</p>}
        </div>
      ))}

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

// A recepção inclui a recomendação que a terapeuta indicou verbalmente (não preencheu
// o bloquinho). Ao salvar, o atendimento entra na fila "A trabalhar" do pós-venda.
function FormIncluirRec({ rec, onSalvo }: { rec: Rec; onSalvo: () => void }) {
  const [itens, setItens] = useState<Set<string>>(new Set())
  const [retorno, setRetorno] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  function toggle(t: string) {
    setItens((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })
  }
  async function salvar() {
    setSalvando(true)
    await fetch('/api/pos-venda/incluir-recomendacao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ belleId: rec.belleId, itens: [...itens], retorno, observacao: obs }),
    })
    setSalvando(false); onSalvo()
  }

  return (
    <div className="mt-3 border-t border-[#DDC7A4]/60 pt-3">
      <p className="text-[12px] text-[#392617]/70 mb-2">A terapeuta indicou <strong>verbalmente</strong>? Inclua a recomendação dela aqui:</p>
      {Object.entries(ITENS_REC).map(([grupo, lista]) => (
        <div key={grupo} className="mb-2.5">
          <p className="text-[12px] font-semibold text-[#7E0000] mb-1">{grupo}</p>
          <div className="flex flex-wrap gap-1.5">
            {lista.map((i) => (
              <button key={i.t} type="button" onClick={() => toggle(i.t)}
                className={`text-[13px] rounded-full px-3 py-1.5 border ${itens.has(i.t) ? 'bg-[#D78B18] text-white border-[#D78B18]' : 'bg-white text-[#392617]/80 border-[#DDC7A4] hover:border-[#D78B18]'}`}>
                {i.l}
              </button>
            ))}
          </div>
        </div>
      ))}
      <input value={retorno} onChange={(e) => setRetorno(e.target.value)} placeholder="Retorno / próximos passos (opcional)"
        className="mt-1 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)"
        className="mt-2 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
      <button onClick={salvar} disabled={salvando || (itens.size === 0 && !retorno.trim())}
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2.5">
        {salvando ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />} Incluir recomendação
      </button>
    </div>
  )
}
