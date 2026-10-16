'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, ArrowLeft, Clock, Plus, X, Info, ChevronDown, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUnidadeNome } from '@/lib/belle/unidades-config'

interface FilaItem {
  terapeutaId: string
  terapeutaIdDb: number | null
  nome: string
  chegada: string
  rodadas: number
  status: 'LIVRE' | 'EM_ATENDIMENTO' | 'RESERVADA'
  detalhe: { ate?: string; cliente?: string | null; inicio?: string } | null
}
interface Disponivel { cod: string; terapeutaId: number; nome: string; escalada: boolean }
interface Cliente {
  codConsulta: number | string; hora: string; cliente: string
  servicoNome: string; servicoCod: number; duracaoMin: number; salaNome: string
  generoPref: 'F' | 'M' | null; preferencial: boolean; preferencialCod: string | null; preferencialNome: string | null
}
interface Atendido { id: number; cliente: string | null; terapeuta: string; servicoNome: string | null; salaNome: string | null; duracaoMin: number; horaEnvio: string; iniciado: boolean; inicioReal: string | null; terminaPrev: string | null }
interface Aguardando { cod: string; terapeutaId: number | null; nome: string; turno: number; chegada: string }
interface PainelResp { unidade: string; data: string; agora: string; turnoAtivo: number; fila: FilaItem[]; aguardando: Aguardando[]; disponiveis: Disponivel[]; clientes: Cliente[]; atendidos: Atendido[] }
interface Ordem { nome: string; rodadas: number; elegivel: boolean; motivo: string }
interface Escolha { escolhida: { id: string; nome: string } | null; salaBelle: string | null; motivo: string; ordem: Ordem[] }

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
  return <span className={base} style={{ background: 'rgba(66,95,29,.12)', color: FLORA }}>livre</span>
}

export default function BolaPage() {
  const params = useParams()
  const unidadeSlug = params.unidade as string
  const [painel, setPainel] = useState<PainelResp | null>(null)
  const [agora, setAgora] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [regrasAbertas, setRegrasAbertas] = useState(true)
  const [turnoSel, setTurnoSel] = useState<1 | 2>(1) // turno em que a próxima chegada entra

  // cliente selecionado (da agenda do Belle) + decisão
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null)
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

  // Recepção marca a chegada de uma terapeuta (entra no fim da fila) / remove quem saiu.
  const marcarChegada = useCallback(async (terapeutaId: number) => {
    const r = await fetch(`/api/bola/fila?unidade=${unidadeSlug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terapeutaId, turno: turnoSel }),
    })
    if (r.ok) carregar()
  }, [unidadeSlug, carregar, turnoSel])

  const removerDaFila = useCallback(async (terapeutaId: number | null) => {
    if (!terapeutaId) return
    const r = await fetch(`/api/bola/fila?unidade=${unidadeSlug}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terapeutaId }),
    })
    if (r.ok) carregar()
  }, [unidadeSlug, carregar])

  // Encerra TODAS as terapeutas de um turno de uma vez → a bola avança pro próximo turno.
  const encerrarTurno = useCallback(async (turno: number, temProximo: boolean) => {
    if (!confirm(`Encerrar o turno ${turno}? As terapeutas do turno ${turno} saem da fila${temProximo ? ' e o próximo turno entra na bola' : ''}.`)) return
    const r = await fetch(`/api/bola/encerrar-turno?unidade=${unidadeSlug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno }),
    })
    if (r.ok) carregar()
    else { const j = await r.json().catch(() => ({})); setErro(j.error || 'Erro ao encerrar o turno') }
  }, [unidadeSlug, carregar])

  // decide a próxima da vez para um cliente NÃO preferencial (usa serviço/duração/gênero do agendamento)
  const decidirCliente = useCallback(async (c: Cliente) => {
    const r = await fetch(`/api/bola/painel?unidade=${unidadeSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: agora || undefined, servicoCod: c.servicoCod, servicoNome: c.servicoNome, duracaoMin: c.duracaoMin, generoPref: c.generoPref || undefined, salaNome: c.salaNome }),
    })
    const j = await r.json()
    if (r.ok) setEscolha(j)
  }, [unidadeSlug, agora])

  // recepção toca no cliente que chegou
  const selecionarCliente = useCallback((c: Cliente) => {
    setClienteSel(c); setEscolha(null); setPasse(null)
    if (!c.preferencial) decidirCliente(c) // preferencial = terapeuta fixa (verde), sem decisão
  }, [decidirCliente])

  const passarBola = useCallback(async () => {
    if (!clienteSel) return
    const terapeutaCod = clienteSel.preferencial ? clienteSel.preferencialCod : escolha?.escolhida?.id
    if (!terapeutaCod) return
    setPassando(true); setPasse(null)
    try {
      const r = await fetch(`/api/bola/passar?unidade=${unidadeSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agora: agora || undefined, terapeutaCod, servicoCod: clienteSel.servicoCod, servicoNome: clienteSel.servicoNome, duracaoMin: clienteSel.duracaoMin, salaNome: clienteSel.salaNome, clienteNome: clienteSel.cliente, codConsulta: clienteSel.codConsulta }),
      })
      const j = await r.json()
      if (r.ok) { setPasse({ mensagem: j.mensagem, enviado: !!j.whatsapp?.enviado, motivo: j.whatsapp?.motivo || '' }); carregar() }
      else setPasse({ mensagem: j.error || 'Erro ao passar a bola', enviado: false, motivo: 'erro' })
    } finally { setPassando(false) }
  }, [clienteSel, escolha, unidadeSlug, agora, carregar])

  const cancelarBola = useCallback(async (atendimentoId: number) => {
    if (!confirm('Cancelar esta bola? A terapeuta é avisada no grupo (❌) e o cliente volta pra "Chegou cliente".')) return
    const r = await fetch(`/api/bola/cancelar?unidade=${unidadeSlug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atendimentoId }),
    })
    if (r.ok) carregar()
    else { const j = await r.json().catch(() => ({})); setErro(j.error || 'Erro ao cancelar a bola') }
  }, [unidadeSlug, carregar])

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
      <p className="text-sm text-muted-foreground mb-3">
        A recepção marca a chegada e toca no cliente que chega · serviço, sala e preferencial vêm do Belle ao vivo.
      </p>

      {/* Regras da bola — critérios de decisão, visíveis p/ clareza */}
      <div className="mb-5 border rounded-xl overflow-hidden">
        <button onClick={() => setRegrasAbertas((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold" style={{ color: MARSALA }}>
          <span className="inline-flex items-center gap-2"><Info className="w-4 h-4" /> Regras da bola</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${regrasAbertas ? 'rotate-180' : ''}`} />
        </button>
        {regrasAbertas && (
          <div className="px-4 pb-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#392617] border-t pt-3">
            <div><b>1. Ordem da vez:</b> atende quem tem <b>menos atendimentos</b>; em empate, quem <b>chegou primeiro</b>.</div>
            <div><b>2. 20 e 30 min mantêm a vez:</b> atendimento curto não conta rodada; 45 min ou mais, roda.</div>
            <div><b>3. Em atendimento sai da bola:</b> volta à fila quando termina.</div>
            <div><b>4. Preferencial (<span style={{ color: FLORA }}>verde</span>):</b> o cliente vai <b>direto com a terapeuta dele</b>, fora da bola.</div>
            <div><b>5. Gênero:</b> respeita ♀/♂ pedido no agendamento (Tipo Obs); sem marca = indiferente.</div>
            <div><b>6. Capacidade:</b> só entra na vez quem <b>faz aquela terapia</b> (cadastro do Belle).</div>
            <div><b>7. Sala:</b> é a que já está no agendamento do Belle.</div>
            <div><b>8. Presença:</b> a recepção <b>marca a chegada</b> e <b>tira</b> quem sai — só quem está na fila entra.</div>
          </div>
        )}
      </div>

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
        {/* FILA + marcar chegada */}
        <div>
          {/* Terapeutas de hoje — a recepção marca a chegada na ordem */}
          {painel && painel.disponiveis.length > 0 && (
            <div className="mb-4">
              <h2 className="font-semibold mb-2">Terapeutas de hoje</h2>
              <p className="text-xs text-muted-foreground mb-2">Toque pra marcar a chegada (entra na fila na ordem).</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">Marcar no:</span>
                {[1, 2].map((t) => (
                  <button key={t} onClick={() => setTurnoSel(t as 1 | 2)}
                    className="text-xs rounded-full border px-2.5 py-1 transition-colors"
                    style={turnoSel === t ? { background: MARSALA, color: '#fff', borderColor: MARSALA } : { color: '#392617' }}>
                    Turno {t}
                  </button>
                ))}
              </div>
              {turnoSel === 2 && (
                <p className="text-[11px] text-muted-foreground mb-2">Quem fez o turno 1 e emenda o turno 2 entra como <b>1ª da bola</b> (mantém a ordem de quem está desde cedo).</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {painel.disponiveis.map((d) => (
                  <button key={d.cod} onClick={() => marcarChegada(d.terapeutaId)}
                    className="inline-flex items-center gap-1 text-xs rounded-full border px-2.5 py-1 hover:bg-[#425F1D]/5 transition-colors"
                    style={{ borderColor: d.escalada ? 'rgba(66,95,29,.4)' : 'var(--border)', color: '#392617' }}
                    title={d.escalada ? 'Escalada hoje' : 'Não escalada no Belle (mas presente)'}>
                    <Plus className="w-3 h-3" style={{ color: FLORA }} /> {d.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h2 className="font-semibold">A fila{painel && painel.fila.length > 0 ? ` — Turno ${painel.turnoAtivo}` : ''}</h2>
            {painel && painel.fila.length > 0 && (
              <button onClick={() => encerrarTurno(painel.turnoAtivo, painel.aguardando.length > 0)}
                className="text-xs font-semibold inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-white shrink-0"
                style={{ background: MARSALA }}
                title={painel.aguardando.length > 0 ? `Tira todas do turno ${painel.turnoAtivo} e abre o turno ${painel.turnoAtivo + 1}` : `Tira todas do turno ${painel.turnoAtivo} da fila`}>
                Encerrar turno {painel.turnoAtivo}{painel.aguardando.length > 0 ? ` → abrir turno ${painel.turnoAtivo + 1}` : ''}
              </button>
            )}
          </div>
          {painel && painel.fila.length === 0 && (
            <p className="text-sm text-muted-foreground">Ninguém na bola ainda — marque a chegada acima.</p>
          )}
          <div className="flex flex-col gap-2">
            {painel?.fila.map((f, i) => (
              <div key={f.terapeutaId}
                className="flex items-center gap-3 border rounded-xl px-3 py-2.5"
                style={i === naBola ? { borderColor: DOURADO, boxShadow: '0 4px 14px rgba(126,0,0,.08)' } : undefined}>
                <div className="w-6 text-center text-muted-foreground tabular-nums">{i + 1}</div>
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
                <button onClick={() => removerDaFila(f.terapeutaIdDb)} title="Tirar da fila (saiu)"
                  className="text-muted-foreground hover:text-[#7E0000] transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {painel && painel.aguardando.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Aguardando próximo turno</h3>
              <p className="text-xs text-muted-foreground mb-2">Entram na bola quando o turno {painel.turnoAtivo} sair. Acabou a manhã? Toque em <b>“Encerrar turno {painel.turnoAtivo}”</b> acima — só finalizar o atendimento não tira a terapeuta da fila.</p>
              <div className="flex flex-col gap-1.5">
                {painel.aguardando.map((a) => (
                  <div key={a.cod} className="flex items-center gap-3 border rounded-lg px-3 py-2 opacity-70">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(126,0,0,.08)', color: MARSALA }}>Turno {a.turno}</span>
                    <div className="flex-1 min-w-0 text-sm truncate">{a.nome}</div>
                    <button onClick={() => removerDaFila(a.terapeutaId)} title="Tirar da fila"
                      className="text-muted-foreground hover:text-[#7E0000] transition-colors shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CHEGOU CLIENTE — lista da agenda do Belle */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-1">Chegou cliente</h2>
          <p className="text-xs text-muted-foreground mb-3">Toque no cliente que chegou — o sistema decide a vez.</p>

          {clienteSel && (
            <div className="mb-3 rounded-lg border p-3" style={{ borderColor: DOURADO, background: '#FBF6EC' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{clienteSel.hora} · {clienteSel.cliente}</div>
                <button onClick={() => { setClienteSel(null); setEscolha(null); setPasse(null) }} className="text-muted-foreground hover:text-[#7E0000]"><X className="w-4 h-4" /></button>
              </div>
              <div className="text-xs text-muted-foreground">{clienteSel.servicoNome} · {clienteSel.duracaoMin}min{clienteSel.salaNome ? ` · Sala ${clienteSel.salaNome}` : ''}</div>

              {clienteSel.preferencial ? (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wide font-bold" style={{ color: FLORA }}>preferencial (verde)</div>
                  <div className="text-xl font-semibold" style={{ color: MARSALA }}>{clienteSel.preferencialNome}</div>
                  <div className="text-xs text-muted-foreground">Cliente pediu essa terapeuta — vai direto com ela.</div>
                </div>
              ) : escolha ? (
                <div className="mt-2">
                  {escolha.escolhida ? (
                    <>
                      <div className="text-xs uppercase tracking-wide text-[#8a5a0c] font-bold">próxima da vez</div>
                      <div className="text-xl font-semibold" style={{ color: MARSALA }}>{escolha.escolhida.nome}</div>
                    </>
                  ) : <div className="text-sm font-medium text-[#7E0000]">{escolha.motivo}</div>}
                  <ul className="mt-2 flex flex-col gap-1 text-xs">
                    {escolha.ordem.map((c, i) => (
                      <li key={i} className={c.elegivel ? '' : 'text-muted-foreground'}>
                        {c.nome === escolha.escolhida?.nome ? '✔' : c.elegivel ? '·' : '✗'} {c.nome} · {c.rodadas}r{c.motivo ? ` — ${c.motivo}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <div className="mt-2 text-xs text-muted-foreground">decidindo…</div>}

              {!passe && (clienteSel.preferencial || escolha?.escolhida) && (
                <button onClick={passarBola} disabled={passando}
                  className="mt-3 w-full text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60" style={{ background: MARSALA }}>
                  {passando ? 'Passando…' : 'Passar a bola e avisar o grupo'}
                </button>
              )}
              {passe && (
                <div className="mt-3 rounded-lg border p-3 bg-white" style={{ borderColor: DOURADO }}>
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#8a5a0c' }}>mensagem no grupo</div>
                  <pre className="text-[13px] whitespace-pre-wrap mt-1" style={{ color: MARSALA, fontFamily: 'inherit' }}>{passe.mensagem}</pre>
                  <div className="text-[11px] text-muted-foreground mt-2">{passe.enviado ? '✓ enviado ao grupo' : `dry-run (envio desligado): ${passe.motivo}`}</div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto">
            {painel && painel.clientes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente na agenda hoje.</p>}
            {painel?.clientes.map((c) => (
              <button key={String(c.codConsulta) + c.hora} onClick={() => selecionarCliente(c)}
                className="text-left border rounded-lg px-3 py-2 hover:bg-[#7E0000]/5 transition-colors"
                style={clienteSel && String(clienteSel.codConsulta) === String(c.codConsulta) ? { borderColor: DOURADO } : undefined}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs tabular-nums text-muted-foreground w-10 shrink-0">{c.hora}</span>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{c.cliente}</span>
                  {c.preferencial && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(66,95,29,.14)', color: FLORA }}>🟢 {c.preferencialNome?.split(' ')[0]}</span>}
                  {c.generoPref === 'F' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(126,0,0,.08)', color: MARSALA }}>♀ feminina</span>}
                  {c.generoPref === 'M' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(126,0,0,.08)', color: MARSALA }}>♂ masculino</span>}
                </div>
                <div className="text-xs text-muted-foreground ml-12">{c.servicoNome}{c.salaNome ? ` · ${c.salaNome}` : ''}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CLIENTE ATENDIDO — bolas já passadas hoje (a hora é o AVISO à terapeuta, não o início da massagem) */}
      {painel && painel.atendidos.length > 0 && (
        <div className="mt-6 border rounded-xl p-4">
          <h2 className="font-semibold mb-1" style={{ color: FLORA }}>Cliente atendido</h2>
          <p className="text-xs text-muted-foreground mb-3">Bolas passadas hoje · <b>avisada</b> = hora que a terapeuta recebeu a bola; a <b>terapeuta marca o início</b> ao entrar na sala. Se ela esquecer, a recepção pode <b>incluir/editar o horário</b> (até retroativo) — senão ela fica presa e não recebe novas bolas.</p>
          <div className="flex flex-col gap-1.5">
            {painel.atendidos.map((a) => (
              <LinhaAtendido key={a.id} a={a} onMudou={carregar} onCancelar={cancelarBola} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Linha do "Cliente atendido" (com editor de horário pela recepção) ───────────
// Se a terapeuta esquece de marcar o início, a recepção inclui/edita aqui (até
// retroativo). Isso destrava a terapeuta (ocupada → livre quando o término passa).
function LinhaAtendido({ a, onMudou, onCancelar }: {
  a: Atendido; onMudou: () => void; onCancelar: (id: number) => void
}) {
  const [editando, setEditando] = useState(false)
  const [inicio, setInicio] = useState(a.inicioReal || a.horaEnvio || '')
  const [fim, setFim] = useState(a.terminaPrev || '')
  const [salvando, setSalvando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/bola/horario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendimentoId: a.id, inicio, fim: fim || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setEditando(false); onMudou() }
      else setErro(j.error || 'Erro ao salvar o horário')
    } finally { setSalvando(false) }
  }

  async function finalizarAgora() {
    setFinalizando(true); setErro(null)
    try {
      const r = await fetch('/api/bola/horario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendimentoId: a.id, finalizarAgora: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) onMudou()
      else setErro(j.error || 'Erro ao finalizar')
    } finally { setFinalizando(false) }
  }

  return (
    <div className="border rounded-lg px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums w-14 shrink-0 text-muted-foreground" title="Hora em que a terapeuta foi avisada">avisada<br />{a.horaEnvio}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{a.cliente || '—'} <span className="text-muted-foreground font-normal">→ {a.terapeuta}</span></div>
          <div className="text-xs text-muted-foreground truncate">{a.servicoNome}{a.salaNome ? ` · ${a.salaNome}` : ''}</div>
          {a.iniciado ? (
            <div className="text-xs font-semibold mt-0.5" style={{ color: FLORA }}>▶ iniciado {a.inicioReal} · termina ~{a.terminaPrev}</div>
          ) : (
            <div className="text-xs font-semibold mt-0.5 inline-flex items-center gap-1" style={{ color: '#8a5a0c' }}>
              <Clock className="w-3 h-3" /> aguardando a terapeuta iniciar
            </div>
          )}
        </div>
        <button onClick={finalizarAgora} disabled={finalizando} title="Finaliza agora e libera a terapeuta pra bola"
          className="text-xs font-semibold inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-white bg-[#425F1D] hover:bg-[#374f18] disabled:opacity-50 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" /> {finalizando ? '…' : 'Finalizar agora'}
        </button>
        <button onClick={() => setEditando((v) => !v)}
          className="text-xs inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[#392617]/80 hover:bg-[#392617]/5 shrink-0">
          <Clock className="w-3.5 h-3.5" /> {a.iniciado ? 'Editar' : 'Horário'}
        </button>
        <button onClick={() => onCancelar(a.id)} title="Cancelar esta bola"
          className="text-xs inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[#7E0000] hover:bg-[#7E0000]/5 shrink-0">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
      {editando && (
        <div className="mt-2 pt-2 border-t flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-muted-foreground">Início
            <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)}
              className="block mt-0.5 border rounded px-2 py-1 text-sm" />
          </label>
          <label className="text-[11px] text-muted-foreground">Fim <span className="opacity-60">(opcional)</span>
            <input type="time" value={fim} onChange={(e) => setFim(e.target.value)}
              className="block mt-0.5 border rounded px-2 py-1 text-sm" />
          </label>
          <span className="text-[11px] text-muted-foreground mb-1.5">vazio = início + {a.duracaoMin}min</span>
          <button onClick={salvar} disabled={salvando || !inicio}
            className="text-xs font-semibold text-white bg-[#425F1D] hover:bg-[#374f18] disabled:opacity-50 rounded-lg px-3 py-1.5">
            {salvando ? 'Salvando…' : 'Salvar horário'}
          </button>
          <button onClick={() => { setEditando(false); setErro(null) }} className="text-xs text-muted-foreground px-2 py-1.5">Cancelar</button>
          {erro && <span className="text-[11px] text-[#7E0000] w-full">{erro}</span>}
        </div>
      )}
    </div>
  )
}
