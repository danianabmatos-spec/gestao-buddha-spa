'use client'

import { useCallback, useEffect, useState } from 'react'
import { Wallet, Sun, Moon, Loader2, CheckCircle2, Pencil, History, ChevronLeft, ChevronRight } from 'lucide-react'
import { SecaoSaidas, Conferencia } from '@/components/caixa/caixa-extras'

interface Unidade { id: number; nome: string; slug: string }
interface Registro {
  data: string
  fundoAbertura: number | null; abertoPorNome: string | null; abertoContadoPor: string | null; abertoEm: string | null; obsAbertura: string | null
  valorFechamento: number | null; fechadoPorNome: string | null; fechadoContadoPor: string | null; fechadoEm: string | null; obsFechamento: string | null
}
interface Saida { id: number; valor: number; descricao: string; fotoPath: string | null; criadoPorNome: string | null }
interface ApiResp {
  perfil: string
  unidadeAtual: Unidade
  unidades: Unidade[]
  data: string
  registro: Registro | null
  historico: Registro[]
  saidas: Saida[]
  recebimentoDinheiro: number | null
  totalSaidas: number
  saidasAcumuladas: number
  fundoInicial: number | null
  esperado: number | null
  diferenca: number | null
}

const brl = (v: number | null | undefined) =>
  v == null ? '—' : `R$ ${v.toFixed(2).replace('.', ',')}`
function dataLonga(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}
function dataCurta(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}
function hora(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function hojeLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function somaDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CaixaPage() {
  const [resp, setResp] = useState<ApiResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)
  const [dataAtiva, setDataAtiva] = useState<string>(hojeLocalISO())
  const [focoInicial, setFocoInicial] = useState<'abertura' | 'fechamento' | null>(null)

  const carregar = useCallback(async (unidadeSlug: string | null, dataISO?: string) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (unidadeSlug) p.set('unidade', unidadeSlug)
    if (dataISO) p.set('data', dataISO)
    const r = await fetch(`/api/rotinas/caixa?${p.toString()}`, { cache: 'no-store' })
    const j: ApiResp = await r.json()
    setResp(j)
    setSlug(j.unidadeAtual?.slug ?? null)
    setDataAtiva(j.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const tipo = p.get('tipo')
    if (tipo === 'abertura' || tipo === 'fechamento') setFocoInicial(tipo)
    carregar(p.get('unidade'), p.get('data') || undefined)
  }, [carregar])

  const hoje = hojeLocalISO()
  const reg = resp?.registro

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#7E0000] flex items-center gap-2">
            <Wallet size={24} /> Controle de Caixa
          </h1>
          {resp && <p className="text-sm text-[#392617]/60 mt-0.5">{resp.unidadeAtual.nome}</p>}
        </div>
        {resp && resp.unidades.length > 1 && (
          <select value={slug ?? ''} onChange={(e) => carregar(e.target.value, dataAtiva)}
            className="bg-white border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] font-medium focus:outline-none focus:ring-2 focus:ring-[#D78B18]">
            {resp.unidades.map((u) => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
          </select>
        )}
      </div>

      {/* Navegador de data — preencha dia a dia (a partir de 01/09) */}
      {resp && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => carregar(slug, somaDias(dataAtiva, -1))} disabled={loading} aria-label="Dia anterior"
            className="p-2 rounded-lg text-[#7E0000] hover:bg-[#7E0000]/5 disabled:opacity-40"><ChevronLeft size={20} /></button>
          <input type="date" value={dataAtiva} max={hoje} onChange={(e) => e.target.value && carregar(slug, e.target.value)}
            className="border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] font-medium focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          <button onClick={() => carregar(slug, somaDias(dataAtiva, 1))} disabled={loading || dataAtiva >= hoje} aria-label="Próximo dia"
            className="p-2 rounded-lg text-[#7E0000] hover:bg-[#7E0000]/5 disabled:opacity-30"><ChevronRight size={20} /></button>
          <span className="text-sm text-[#392617]/60 capitalize hidden sm:inline">{dataLonga(dataAtiva)}</span>
          {dataAtiva !== hoje && (
            <button onClick={() => carregar(slug, hoje)} className="ml-auto text-sm font-medium text-[#7E0000] hover:underline">Ir para hoje</button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#7E0000]"><Loader2 className="animate-spin" size={28} /></div>
      )}

      {!loading && resp && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CartaoCaixa
              key={`abertura-${resp.data}`}
              tipo="abertura" titulo="Abertura" subtitulo="Fundo de troco inicial"
              icone={<Sun size={18} className="text-[#D78B18]" />}
              valor={reg?.fundoAbertura ?? null} porNome={reg?.abertoPorNome ?? null} contadoPor={reg?.abertoContadoPor ?? null} em={reg?.abertoEm ?? null} obs={reg?.obsAbertura ?? null}
              unidadeSlug={slug} data={resp.data} abrirEmEdicao={focoInicial === 'abertura'}
              onSalvo={() => carregar(slug)}
            />
            <CartaoCaixa
              key={`fechamento-${resp.data}`}
              tipo="fechamento" titulo="Fechamento" subtitulo="Valor contado ao fechar"
              icone={<Moon size={18} className="text-[#7E0000]" />}
              valor={reg?.valorFechamento ?? null} porNome={reg?.fechadoPorNome ?? null} contadoPor={reg?.fechadoContadoPor ?? null} em={reg?.fechadoEm ?? null} obs={reg?.obsFechamento ?? null}
              unidadeSlug={slug} data={resp.data} abrirEmEdicao={focoInicial === 'fechamento'}
              onSalvo={() => carregar(slug)}
            />
          </div>

          {/* Saídas do dia */}
          <SecaoSaidas saidas={resp.saidas} unidadeSlug={slug} data={resp.data} onMudou={() => carregar(slug)} />

          {/* Conferência (sobra/falta) — acumulada no mês */}
          <Conferencia
            fundo={resp.fundoInicial} recebimento={resp.recebimentoDinheiro}
            totalSaidas={resp.saidasAcumuladas} contado={reg?.valorFechamento ?? null}
            esperado={resp.esperado} diferenca={resp.diferenca}
          />

          {/* Histórico */}
          {resp.historico.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-[#7E0000] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <History size={15} /> Últimos dias
              </h2>
              <div className="rounded-xl border border-[#DDC7A4] bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F5F0EB] text-[#392617]/60 text-[11px] uppercase">
                      <th className="text-left font-semibold px-3 py-2">Dia</th>
                      <th className="text-right font-semibold px-3 py-2">Abertura</th>
                      <th className="text-right font-semibold px-3 py-2">Fechamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDC7A4]/40">
                    {resp.historico.map((h) => (
                      <tr key={h.data} className={h.data === resp.data ? 'bg-[#D78B18]/[0.06]' : ''}>
                        <td className="px-3 py-2 text-[#392617]">{dataCurta(h.data)}</td>
                        <td className="px-3 py-2 text-right text-[#392617]/80">{brl(h.fundoAbertura)}</td>
                        <td className="px-3 py-2 text-right font-medium text-[#392617]">{brl(h.valorFechamento)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CartaoCaixa({
  tipo, titulo, subtitulo, icone, valor, porNome, contadoPor, em, obs, unidadeSlug, data, abrirEmEdicao, onSalvo,
}: {
  tipo: 'abertura' | 'fechamento'; titulo: string; subtitulo: string; icone: React.ReactNode
  valor: number | null; porNome: string | null; contadoPor: string | null; em: string | null; obs: string | null
  unidadeSlug: string | null; data: string; abrirEmEdicao: boolean; onSalvo: () => void
}) {
  const registrado = valor != null
  const [editando, setEditando] = useState(abrirEmEdicao || !registrado)
  const [valorTxt, setValorTxt] = useState(valor != null ? String(valor).replace('.', ',') : '')
  const [contadoPorTxt, setContadoPorTxt] = useState(contadoPor ?? '')
  const [obsTxt, setObsTxt] = useState(obs ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (abrirEmEdicao) setEditando(true) }, [abrirEmEdicao])

  async function salvar() {
    const num = Number(valorTxt.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(num) || num < 0) { setErro('Informe um valor válido.'); return }
    setSalvando(true); setErro(null)
    const r = await fetch('/api/rotinas/caixa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: unidadeSlug, data, tipo, valor: num, obs: obsTxt, contadoPor: contadoPorTxt }),
    })
    setSalvando(false)
    if (r.ok) { setEditando(false); onSalvo() }
    else setErro((await r.json().catch(() => ({}))).error || 'Não foi possível salvar.')
  }

  return (
    <div className={`rounded-2xl border p-4 ${registrado && !editando ? 'border-[#425F1D]/40 bg-[#425F1D]/[0.04]' : 'border-[#DDC7A4] bg-white'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icone}
        <h3 className="text-base font-bold text-[#392617]">{titulo}</h3>
        {registrado && !editando && <CheckCircle2 size={16} className="text-[#425F1D] ml-auto" />}
      </div>
      <p className="text-[12px] text-[#392617]/55 mb-3">{subtitulo}</p>

      {registrado && !editando ? (
        <div>
          <p className="text-3xl font-bold text-[#7E0000]">{brl(valor)}</p>
          {contadoPor && <p className="text-[13px] text-[#392617]/80 mt-1 font-medium">Contagem: {contadoPor}</p>}
          <p className="text-[12px] text-[#392617]/55 mt-0.5">
            {porNome ? `Registrado por ${porNome}` : ''}{em ? ` · ${hora(em)}` : ''}
          </p>
          {obs && <p className="text-[13px] text-[#392617]/70 mt-1 italic">“{obs}”</p>}
          <button onClick={() => setEditando(true)} className="mt-2 text-[12px] text-[#7E0000] hover:underline inline-flex items-center gap-1">
            <Pencil size={12} /> Corrigir
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[12px] text-[#392617]/70">Valor em dinheiro</span>
            <div className="flex items-center mt-0.5 border border-[#DDC7A4] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#D78B18]">
              <span className="px-3 py-2 bg-[#F5F0EB] text-[#392617]/60 text-sm">R$</span>
              <input value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus
                className="flex-1 px-3 py-2 text-sm focus:outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="text-[12px] text-[#392617]/70">Quem fez a contagem</span>
            <input value={contadoPorTxt} onChange={(e) => setContadoPorTxt(e.target.value)} placeholder="Nome de quem contou o caixa"
              className="mt-0.5 w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          </label>
          <textarea value={obsTxt} onChange={(e) => setObsTxt(e.target.value)} rows={2} placeholder="Observações (opcional) — ex.: sangria de R$100, sobra de troco…"
            className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          {erro && <p className="text-[11px] text-[#7E0000] font-medium">{erro}</p>}
          <button onClick={salvar} disabled={salvando || !valorTxt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 rounded-lg px-4 py-2.5">
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Salvar {titulo.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  )
}
