'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'

// ─── Lista de Descontos e Cortesias (com coluna de justificativa) ────────────────
// Componente reutilizável: usado na página de Atendimentos (com cards/resumo) e no
// painel lateral da Conciliação Financeira. Busca /api/conciliacao/atendimentos e
// mostra TODOS os descontos/cortesias do mês, com a justificativa (auto/equipe/sugerida).

export interface ItemDC {
  id: number; data: string; horario: string | null; clienteNome: string; servico: string | null
  tempo: number | null; profissional: string | null; classificacao: string; valor: number
  justificado: boolean; origemDesconto: string | null; divergenciaId: number | null; divergenciaStatus: string | null
  justificativa: string | null; sugestao: string | null; motivoAuto: string | null; tratadaPorNome: string | null
  aprovada: boolean; aprovadaPorNome: string | null
}
export interface ResumoDC {
  total: number; justificados: number; sinalizados: number; valorAberto: number
  porClassificacao: Record<string, number>; divergenciasAbertas: number
}

const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const ABERTAS = ['ABERTA', 'EM_TRATAMENTO', 'REPROCESSADA']

const COR: Record<string, string> = {
  SEM_JUSTIFICATIVA: '#3A1010', CORTESIA: '#7E0000', DESCONTO: '#A63A3A', CORTESIA_COLABORADOR: '#8FA96B', CORTESIA_PROPRIETARIO: '#6E8E4E',
}
const CLASS_LABEL: Record<string, string> = {
  SEM_JUSTIFICATIVA: 'Sem justificativa',
  CORTESIA: 'Cortesia s/ autorização',
  CORTESIA_COLABORADOR: 'Cortesia colaborador',
  CORTESIA_PROPRIETARIO: 'Cortesia proprietário',
  DESCONTO: 'Desconto discricionário',
}

export function DescontosCortesias({ unidadeSlug, ano, mes, reloadKey = 0, onResumo }: {
  unidadeSlug: string; ano: number; mes: number; reloadKey?: number; onResumo?: (r: ResumoDC) => void
}) {
  const [itens, setItens] = useState<ItemDC[]>([])
  const [podeAprovar, setPodeAprovar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [justificandoId, setJustificandoId] = useState<number | null>(null)
  const [textoJust, setTextoJust] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/conciliacao/atendimentos?unidade=${unidadeSlug}&ano=${ano}&mes=${mes}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao carregar'); setItens([]); return }
      setItens(j.problemas ?? [])
      setPodeAprovar(!!j.podeAprovar)
      if (onResumo && j.resumo) onResumo(j.resumo)
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [unidadeSlug, ano, mes, onResumo])

  useEffect(() => { carregar() }, [carregar, reloadKey])

  const justificar = async (divergenciaId: number) => {
    if (!textoJust.trim()) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/conciliacao/divergencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: divergenciaId, acao: 'justificar', justificativa: textoJust.trim() }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao justificar'); return }
      setJustificandoId(null); setTextoJust(''); await carregar()
    } catch { setErro('Falha ao justificar') } finally { setSalvando(false) }
  }

  const aprovarReprovar = async (divergenciaId: number, acao: 'aprovar' | 'reprovar') => {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/conciliacao/divergencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: divergenciaId, acao }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro'); return }
      await carregar()
    } catch { setErro('Falha de conexão') } finally { setSalvando(false) }
  }

  const pend = itens.filter((p) => !p.justificado && !(p.divergenciaStatus && !ABERTAS.includes(p.divergenciaStatus))).length

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
        Descontos e cortesias ({itens.length})
        {pend > 0
          ? <span className="text-[#7E0000] font-normal">— {pend} a justificar</span>
          : itens.length > 0 && <span className="text-[#425F1D] font-normal">— tudo justificado ✓</span>}
        {carregando && <span className="text-xs text-muted-foreground font-normal">carregando…</span>}
      </h2>
      {erro && <div className="mb-2 rounded-md bg-[#7E0000]/10 text-[#7E0000] px-3 py-2 text-sm">{erro}</div>}
      <div className="space-y-1.5">
        {itens.map((p) => {
          const cor = COR[p.classificacao] ?? '#7E0000'
          const editando = justificandoId === p.divergenciaId
          const aguardando = p.divergenciaStatus === 'JUSTIFICADA' && !p.aprovada
          const verde = !!p.motivoAuto || (p.divergenciaStatus === 'JUSTIFICADA' && p.aprovada)
          const borda = aguardando ? '#7E0000' : cor // aguardando aprovação → borda vermelha
          return (
            <div key={p.id} className="rounded-lg border" style={{ borderLeftWidth: 3, borderLeftColor: borda }}>
              <div className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <div className="w-9 text-xs text-muted-foreground tabular-nums pt-0.5">{fmtData(p.data)}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{p.servico ?? 'Serviço'} {p.tempo ? <span className="text-muted-foreground font-normal">· {p.tempo}min</span> : null}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.clienteNome}{p.profissional ? ` · ${p.profissional}` : ''}</div>
                </div>
                <div className="w-24 text-right shrink-0">
                  <div className="text-xs font-medium" style={{ color: cor }}>{CLASS_LABEL[p.classificacao] ?? p.classificacao}</div>
                  <div className="text-xs text-muted-foreground">{p.valor ? brl(p.valor) : ''}</div>
                </div>
                <div className="w-52 shrink-0 text-xs">
                  {verde ? (
                    <span className="text-[#425F1D]">✓ {p.motivoAuto || p.justificativa}{p.aprovadaPorNome ? ` · aprovado: ${p.aprovadaPorNome}` : ''}</span>
                  ) : p.divergenciaStatus === 'IGNORADA' ? (
                    <span className="text-muted-foreground">Ignorado{p.tratadaPorNome ? ` — ${p.tratadaPorNome}` : ''}</span>
                  ) : aguardando ? (
                    <div className="flex flex-col gap-1 items-start">
                      <span className="bg-[#7E0000]/10 text-[#7E0000] rounded px-1.5 py-1 leading-snug">⏳ Aguardando aprovação<br/><span className="text-[#7E0000]/80">{p.justificativa}{p.tratadaPorNome ? ` — ${p.tratadaPorNome}` : ''}</span></span>
                      {podeAprovar && p.divergenciaId && (
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs bg-[#425F1D] hover:bg-[#344a17] text-white" disabled={salvando} onClick={() => aprovarReprovar(p.divergenciaId!, 'aprovar')}>Aprovar</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-[#7E0000]" disabled={salvando} onClick={() => aprovarReprovar(p.divergenciaId!, 'reprovar')}>Reprovar</Button>
                        </div>
                      )}
                    </div>
                  ) : p.divergenciaId ? (
                    <div className="flex flex-col gap-1 items-start">
                      {p.sugestao && <span className="bg-[#D78B18]/12 text-[#7a5200] rounded px-1.5 py-1 leading-snug">💡 {p.sugestao}</span>}
                      <Button size="sm" variant="outline" className="h-7 text-xs border-[#7E0000]/30 text-[#7E0000] hover:bg-[#7E0000]/5"
                        onClick={() => { setJustificandoId(editando ? null : p.divergenciaId); setTextoJust(editando ? '' : (p.sugestao ?? '')) }}>
                        {p.sugestao ? 'Justificar (sugerido)' : 'Justificar'}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              {editando && p.divergenciaId && (
                <div className="border-t px-3 py-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-[#E4E5E2]/20">
                  <input autoFocus value={textoJust} onChange={(e) => setTextoJust(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && textoJust.trim()) justificar(p.divergenciaId!) }}
                    placeholder="Motivo do desconto/cortesia…"
                    className="flex-1 rounded-md border px-2 py-1.5 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 bg-[#7E0000] hover:bg-[#5c0000] text-white" disabled={salvando || !textoJust.trim()} onClick={() => justificar(p.divergenciaId!)}>
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setJustificandoId(null); setTextoJust('') }}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!carregando && itens.length === 0 && <p className="text-sm text-[#425F1D]">Nenhum desconto ou cortesia neste mês. 🎉</p>}
      </div>
    </div>
  )
}
