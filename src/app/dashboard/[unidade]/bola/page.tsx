'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, ArrowLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUnidadeNome } from '@/lib/belle/unidades-config'

interface FilaItem {
  terapeutaId: string
  nome: string
  chegada: string
  rodadas: number
  status: 'LIVRE' | 'EM_ATENDIMENTO' | 'RESERVADA' | 'FORA_DE_TURNO'
  detalhe: { ate?: string; cliente?: string | null; inicio?: string } | null
}
interface PainelResp { unidade: string; data: string; agora: string; fila: FilaItem[] }
interface Ordem { nome: string; rodadas: number; elegivel: boolean; motivo: string }
interface Escolha { escolhida: { id: string; nome: string } | null; salaBelle: string | null; motivo: string; ordem: Ordem[] }

const DURACOES = [20, 30, 45, 50, 60, 75, 90]
const MARSALA = '#7E0000'
const FLORA = '#425F1D'
const DOURADO = '#D78B18'

// entre os LIVRE, quem é a vez (menos rodadas, depois quem chegou antes)
function idxNaBola(fila: FilaItem[]): number {
  let melhor = -1
  fila.forEach((f, i) => {
    if (f.status !== 'LIVRE') return
    if (melhor === -1) { melhor = i; return }
    const m = fila[melhor]
    if (f.rodadas < m.rodadas || (f.rodadas === m.rodadas && f.chegada < m.chegada)) melhor = i
  })
  return melhor
}

function Chip({ item }: { item: FilaItem }) {
  const base = 'text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap'
  if (item.status === 'EM_ATENDIMENTO')
    return <span className={base} style={{ background: '#F3EEE3', color: '#7C6A58' }}>em atendimento{item.detalhe?.ate ? ` · até ${item.detalhe.ate}` : ''}</span>
  if (item.status === 'RESERVADA')
    return <span className={base} style={{ background: 'rgba(215,139,24,.14)', color: '#8a5a0c' }}>reservada · preferencial {item.detalhe?.inicio}</span>
  if (item.status === 'FORA_DE_TURNO')
    return <span className={base} style={{ background: '#EFEBE2', color: '#9C8E7C' }}>fora de turno</span>
  return <span className={base} style={{ background: 'rgba(66,95,29,.12)', color: FLORA }}>livre</span>
}

export default function BolaPage() {
  const params = useParams()
  const unidadeSlug = params.unidade as string
  const [painel, setPainel] = useState<PainelResp | null>(null)
  const [agora, setAgora] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // form "chegou cliente"
  const [servicoNome, setServicoNome] = useState('Relaxante 60')
  const [duracao, setDuracao] = useState(60)
  const [genero, setGenero] = useState<'' | 'F' | 'M'>('')
  const [escolha, setEscolha] = useState<Escolha | null>(null)
  const [passando, setPassando] = useState(false)
  const [passe, setPasse] = useState<{ mensagem: string; enviado: boolean; motivo: string } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const qs = new URLSearchParams({ unidade: unidadeSlug })
      if (agora) qs.set('agora', agora)
      const r = await fetch(`/api/bola/painel?${qs}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao carregar')
      setPainel(j)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setCarregando(false) }
  }, [unidadeSlug, agora])

  useEffect(() => {
    const t = setTimeout(() => { carregar() }, 0)
    return () => clearTimeout(t)
  }, [carregar])

  const chegouCliente = useCallback(async () => {
    setEscolha(null); setPasse(null)
    const r = await fetch(`/api/bola/painel?unidade=${unidadeSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: agora || undefined, servicoNome, duracaoMin: duracao, generoPref: genero || undefined }),
    })
    const j = await r.json()
    if (r.ok) setEscolha(j)
  }, [unidadeSlug, agora, servicoNome, duracao, genero])

  const passarBola = useCallback(async () => {
    if (!escolha?.escolhida) return
    setPassando(true); setPasse(null)
    try {
      const r = await fetch(`/api/bola/passar?unidade=${unidadeSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agora: agora || undefined, servicoNome, duracaoMin: duracao, generoPref: genero || undefined, terapeutaCod: escolha.escolhida.id }),
      })
      const j = await r.json()
      if (r.ok) { setPasse({ mensagem: j.mensagem, enviado: !!j.whatsapp?.enviado, motivo: j.whatsapp?.motivo || '' }); carregar() }
      else setPasse({ mensagem: j.error || 'Erro ao passar a bola', enviado: false, motivo: 'erro' })
    } finally { setPassando(false) }
  }, [escolha, unidadeSlug, agora, servicoNome, duracao, genero, carregar])

  const naBola = painel ? idxNaBola(painel.fila) : -1

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href={`/dashboard/${unidadeSlug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-semibold" style={{ color: MARSALA }}>Controle da Bola</h1>
        <span className="text-muted-foreground">{getUnidadeNome(unidadeSlug)}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Fila montada pelos check-ins · turno, preferencial e sala vêm do Belle ao vivo.
      </p>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" /> horário
          <input type="time" value={agora} onChange={(e) => setAgora(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm" />
        </label>
        <span className="text-xs text-muted-foreground">(vazio = agora)</span>
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`w-4 h-4 mr-1 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
        {painel && <span className="text-sm text-muted-foreground ml-auto">bola às <b>{painel.agora}</b> · {painel.data}</span>}
      </div>

      {erro && <div className="rounded-md bg-[#7E0000]/10 text-[#7E0000] px-3 py-2 text-sm mb-4">{erro}</div>}

      <div className="grid md:grid-cols-[1.1fr_.9fr] gap-6 items-start">
        {/* FILA */}
        <div>
          <h2 className="font-semibold mb-2">A fila</h2>
          {painel && painel.fila.length === 0 && (
            <p className="text-sm text-muted-foreground">Ninguém fez check-in ainda hoje.</p>
          )}
          <div className="flex flex-col gap-2">
            {painel?.fila.map((f, i) => (
              <div key={f.terapeutaId}
                className="flex items-center gap-3 border rounded-xl px-3 py-2.5"
                style={i === naBola ? { borderColor: DOURADO, boxShadow: '0 4px 14px rgba(126,0,0,.08)' } : undefined}>
                <div className="w-6 text-center text-muted-foreground tabular-nums">
                  {f.status === 'FORA_DE_TURNO' ? '—' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    chegou {f.chegada} · {f.rodadas} atend.
                    {f.status === 'EM_ATENDIMENTO' && f.detalhe?.cliente ? ` · ${f.detalhe.cliente}` : ''}
                    {f.status === 'RESERVADA' && f.detalhe?.cliente ? ` · ${f.detalhe.cliente}` : ''}
                  </div>
                </div>
                {i === naBola
                  ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: MARSALA }}>na bola</span>
                  : <Chip item={f} />}
              </div>
            ))}
          </div>
        </div>

        {/* CHEGOU CLIENTE */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Chegou cliente</h2>
          <div className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="text-muted-foreground">Terapia</span>
              <input value={servicoNome} onChange={(e) => setServicoNome(e.target.value)}
                className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm" />
            </label>
            <div className="flex gap-3">
              <label className="text-sm flex-1">
                <span className="text-muted-foreground">Duração</span>
                <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}
                  className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm">
                  {DURACOES.map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </label>
              <label className="text-sm flex-1">
                <span className="text-muted-foreground">Preferência</span>
                <select value={genero} onChange={(e) => setGenero(e.target.value as '' | 'F' | 'M')}
                  className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm">
                  <option value="">Indiferente</option>
                  <option value="F">Feminina</option>
                  <option value="M">Masculino</option>
                </select>
              </label>
            </div>
            <Button onClick={chegouCliente} style={{ background: MARSALA }} className="text-white">
              Ver próxima da bola
            </Button>
          </div>

          {escolha && (
            <div className="mt-4 border-t pt-3">
              {escolha.escolhida ? (
                <>
                  <div className="text-xs uppercase tracking-wide text-[#8a5a0c] font-bold">próxima da vez</div>
                  <div className="text-xl font-semibold" style={{ color: MARSALA }}>{escolha.escolhida.nome}</div>
                  {escolha.salaBelle && <div className="text-sm text-muted-foreground">Sala: {escolha.salaBelle}</div>}
                </>
              ) : (
                <div className="text-sm font-medium text-[#7E0000]">{escolha.motivo}</div>
              )}
              <ul className="mt-3 flex flex-col gap-1 text-xs">
                {escolha.ordem.map((c, i) => (
                  <li key={i} className={c.elegivel ? '' : 'text-muted-foreground'}>
                    {c.nome === escolha.escolhida?.nome ? '✔' : c.elegivel ? '·' : '✗'} {c.nome} · {c.rodadas}r
                    {c.motivo ? ` — ${c.motivo}` : ''}
                  </li>
                ))}
              </ul>

              {escolha.escolhida && !passe && (
                <button onClick={passarBola} disabled={passando}
                  className="mt-3 w-full text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                  style={{ background: MARSALA }}>
                  {passando ? 'Passando…' : 'Passar a bola e avisar o grupo'}
                </button>
              )}
              {passe && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: DOURADO, background: '#FBF6EC' }}>
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#8a5a0c' }}>mensagem no grupo</div>
                  <pre className="text-[13px] whitespace-pre-wrap mt-1" style={{ color: MARSALA, fontFamily: 'inherit' }}>{passe.mensagem}</pre>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {passe.enviado ? '✓ enviado ao grupo' : `dry-run (envio desligado): ${passe.motivo}`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
