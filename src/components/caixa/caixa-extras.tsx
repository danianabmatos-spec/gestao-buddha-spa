'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, Plus, Trash2, Camera, Banknote, Scale, ArrowDownCircle, X, Sun, Moon } from 'lucide-react'

export interface Saida { id: number; valor: number; descricao: string; fotoPath: string | null; criadoPorNome: string | null }

const brl = (v: number | null | undefined) => (v == null ? '—' : `R$ ${v.toFixed(2).replace('.', ',')}`)

// ─── Saídas do dia ──────────────────────────────────────────────────────────────
export function SecaoSaidas({ saidas, unidadeSlug, data, onMudou }: {
  saidas: Saida[]; unidadeSlug: string | null; data: string; onMudou: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const total = saidas.reduce((s, x) => s + x.valor, 0)
  return (
    <div className="mt-4 rounded-2xl border border-[#DDC7A4] bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <ArrowDownCircle size={17} className="text-[#7E0000]" />
        <h3 className="text-base font-bold text-[#392617]">Saídas do dia</h3>
        {saidas.length > 0 && <span className="text-[12px] text-[#7E0000] font-medium">− {brl(total)}</span>}
        <button onClick={() => setAberto(true)}
          className="ml-auto text-[12px] font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
          <Plus size={13} /> Adicionar
        </button>
      </div>
      {saidas.length === 0 ? (
        <p className="text-[13px] text-[#392617]/45 italic">Nenhuma saída (sangria/despesa) registrada hoje.</p>
      ) : (
        <ul className="divide-y divide-[#DDC7A4]/40">
          {saidas.map((s) => <LinhaSaida key={s.id} s={s} onMudou={onMudou} />)}
        </ul>
      )}
      {aberto && <ModalSaida unidadeSlug={unidadeSlug} data={data} onFechar={() => setAberto(false)} onCriado={() => { setAberto(false); onMudou() }} />}
    </div>
  )
}

function LinhaSaida({ s, onMudou }: { s: Saida; onMudou: () => void }) {
  const [verFoto, setVerFoto] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const fotoUrl = s.fotoPath ? `/api/rotinas/caixa/foto?f=${encodeURIComponent(s.fotoPath)}` : null
  async function remover() {
    setRemovendo(true)
    await fetch(`/api/rotinas/caixa/saida?id=${s.id}`, { method: 'DELETE' })
    onMudou()
  }
  return (
    <li className="flex items-center gap-3 py-2">
      {fotoUrl ? (
        <button onClick={() => setVerFoto(true)} className="shrink-0" title="Ver notinha">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoUrl} alt="notinha" className="w-10 h-10 rounded object-cover border border-[#DDC7A4]" />
        </button>
      ) : (
        <span className="w-10 h-10 rounded bg-[#F5F0EB] flex items-center justify-center text-[#392617]/30 shrink-0"><Camera size={16} /></span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#392617] truncate">{s.descricao}</p>
        {s.criadoPorNome && <p className="text-[11px] text-[#392617]/50">{s.criadoPorNome}</p>}
      </div>
      <span className="text-sm font-semibold text-[#7E0000] shrink-0">− {brl(s.valor)}</span>
      <button onClick={remover} disabled={removendo} className="text-[#392617]/30 hover:text-[#7E0000] shrink-0" title="Remover">
        {removendo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
      {verFoto && fotoUrl && <ModalFoto src={fotoUrl} onFechar={() => setVerFoto(false)} />}
    </li>
  )
}

function ModalSaida({ unidadeSlug, data, onFechar, onCriado }: {
  unidadeSlug: string | null; data: string; onFechar: () => void; onCriado: () => void
}) {
  const [valor, setValor] = useState('')
  const [desc, setDesc] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setFoto(r.result as string)
    r.readAsDataURL(f)
  }
  async function salvar() {
    const num = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(num) || num <= 0) { setErro('Informe um valor válido.'); return }
    if (!desc.trim()) { setErro('Descreva a saída.'); return }
    setSalvando(true); setErro(null)
    const r = await fetch('/api/rotinas/caixa/saida', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: unidadeSlug, data, valor: num, descricao: desc, fotoBase64: foto }),
    })
    setSalvando(false)
    if (r.ok) onCriado()
    else setErro((await r.json().catch(() => ({}))).error || 'Não foi possível salvar.')
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl border border-[#DDC7A4] w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-[#7E0000]">Nova saída</p>
          <button onClick={onFechar} className="text-[#392617]/40 hover:text-[#7E0000]"><X size={18} /></button>
        </div>
        <label className="block">
          <span className="text-[12px] text-[#392617]/70">Valor</span>
          <div className="flex items-center mt-0.5 border border-[#DDC7A4] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#D78B18]">
            <span className="px-3 py-2 bg-[#F5F0EB] text-[#392617]/60 text-sm">R$</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus className="flex-1 px-3 py-2 text-sm focus:outline-none" />
          </div>
        </label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição — ex.: compra de água, sangria p/ cofre…"
          className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
        <div>
          <span className="text-[12px] text-[#392617]/70">Foto da notinha (opcional)</span>
          {foto ? (
            <div className="mt-1 relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="prévia" className="max-h-40 rounded-lg border border-[#DDC7A4]" />
              <button onClick={() => setFoto(null)} className="absolute -top-2 -right-2 bg-[#7E0000] text-white rounded-full p-0.5"><X size={13} /></button>
            </div>
          ) : (
            <label className="mt-1 flex items-center gap-2 justify-center border border-dashed border-[#DDC7A4] rounded-lg px-3 py-3 text-sm text-[#7E0000] cursor-pointer hover:bg-[#F5F0EB]">
              <Camera size={16} /> Tirar foto / anexar
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
          )}
        </div>
        {erro && <p className="text-[11px] text-[#7E0000] font-medium">{erro}</p>}
        <button onClick={salvar} disabled={salvando || !valor.trim() || !desc.trim()}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2.5">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Salvar saída
        </button>
      </div>
    </div>
  )
}

function ModalFoto({ src, onFechar }: { src: string; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onFechar}>
      <button className="absolute top-4 right-4 text-white"><X size={24} /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="notinha" className="max-h-[90vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

// ─── Conferência (sobra/falta) ──────────────────────────────────────────────────
export function Conferencia({ fundo, recebimento, totalSaidas, contado, esperado, diferenca }: {
  fundo: number | null; recebimento: number | null; totalSaidas: number; contado: number | null; esperado: number | null; diferenca: number | null
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#DDC7A4] bg-white p-4">
      <h3 className="text-base font-bold text-[#392617] flex items-center gap-2 mb-1"><Scale size={17} className="text-[#7E0000]" /> Conferência do caixa</h3>
      <p className="text-[11px] text-[#392617]/50 mb-3">O dinheiro acumula dia a dia — valores desde o dia 01 do mês.</p>
      <div className="space-y-1.5 text-sm">
        <LinhaConf icone={<Sun size={14} className="text-[#D78B18]" />} label="Fundo inicial (dia 01)" valor={fundo} />
        <LinhaConf icone={<Banknote size={14} className="text-[#425F1D]" />} label="Recebido em dinheiro (Belle, desde 01)" valor={recebimento} />
        <LinhaConf icone={<ArrowDownCircle size={14} className="text-[#7E0000]" />} label="Saídas (desde 01)" valor={totalSaidas ? -totalSaidas : 0} />
        <div className="h-px bg-[#DDC7A4]/50 my-1" />
        <LinhaConf label="Esperado em caixa" valor={esperado} negrito />
        <LinhaConf icone={<Moon size={14} className="text-[#7E0000]" />} label="Contado hoje (fechamento)" valor={contado} negrito />
      </div>
      <DiferencaBox diferenca={diferenca} />
      {recebimento == null && (
        <p className="text-[11px] text-[#D78B18] mt-2">Não consegui puxar o recebido em dinheiro do Belle agora — a conferência fica incompleta.</p>
      )}
    </div>
  )
}

function LinhaConf({ icone, label, valor, negrito }: { icone?: React.ReactNode; label: string; valor: number | null; negrito?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 shrink-0">{icone}</span>
      <span className={`text-[#392617]/70 ${negrito ? 'font-semibold text-[#392617]' : ''}`}>{label}</span>
      <span className={`ml-auto ${negrito ? 'font-bold text-[#392617]' : 'text-[#392617]/80'}`}>{brl(valor)}</span>
    </div>
  )
}

function DiferencaBox({ diferenca }: { diferenca: number | null }) {
  if (diferenca == null) {
    return <div className="mt-3 rounded-lg bg-[#F5F0EB] text-[#392617]/55 text-[13px] px-3 py-2">Preencha abertura, fechamento e as saídas para ver a diferença.</div>
  }
  const zero = Math.abs(diferenca) < 0.005
  const sobra = diferenca > 0
  const cor = zero ? '#425F1D' : sobra ? '#D78B18' : '#7E0000'
  const texto = zero ? 'Bateu certinho! 🎉' : sobra ? `Sobra de ${brl(diferenca)}` : `Falta de ${brl(Math.abs(diferenca))}`
  return (
    <div className="mt-3 rounded-lg px-3 py-2.5 flex items-center gap-2 font-bold" style={{ backgroundColor: `${cor}14`, color: cor }}>
      <Scale size={16} /> {texto}
    </div>
  )
}
