'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Terapeuta {
  profissional: string
  horasAtendimento: number
  percServicosFidelizados: number
  nps: number
  categoria: string | null            // categoria atual (RH): BRONZE/PRATA/OURO/DIAMANTE
  recomendacaoCliente: number | null
  horasTreinamento: number | null
  avaliacaoColegas: number | null
  avaliacaoGestor: number | null
}
interface Pesos {
  pesoProdutividade: number; pesoFidelizacao: number; pesoNps: number
  pesoRecomendacao: number; pesoTreinamento: number; pesoColegas: number
}
interface Faixas { minDiamante: number; minOuro: number; minPrata: number }
interface Resposta {
  periodo: string; podeVerRestrito: boolean; podeGerenciarPesos?: boolean; pesos: Pesos; faixas: Faixas; terapeutas: Terapeuta[]
  atualizadoEm?: string | null; atualizadoPor?: string | null
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
type SortCol = 'nome'|'prod'|'fid'|'nps'|'rec'|'trein'|'col'|'total'|'gestor'|'final'

// Os 6 pesos, na mesma ordem das colunas de indicador.
const PESO_ITENS: [keyof Pesos, string][] = [
  ['pesoProdutividade','Produtividade'], ['pesoFidelizacao','Fidelização'], ['pesoNps','NPS'],
  ['pesoRecomendacao','Recomendação'], ['pesoTreinamento','Horas Treino'], ['pesoColegas','Aval. Colegas'],
]

function ultimoMesFechado() {
  const hoje = new Date()
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}
const nota = (v: number, max: number) => (max > 0 ? (v / max) * 10 : 0)
function corNota(n: number) {
  if (n >= 9.95) return 'bg-[#425F1D] text-white'
  if (n >= 8) return 'text-[#425F1D]'
  if (n >= 6) return 'text-[#D78B18]'
  return 'text-[#7E0000]'
}
const capitaliza = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
function categoriaCalc(notaFinal: number, f: Faixas): string {
  if (notaFinal >= f.minDiamante) return 'Diamante'
  if (notaFinal >= f.minOuro) return 'Ouro'
  if (notaFinal >= f.minPrata) return 'Prata'
  return 'Bronze'
}
const CAT_COR: Record<string, string> = {
  Diamante: 'bg-[#B9D9EB] text-[#1B3A4B]', Ouro: 'bg-[#D78B18] text-white',
  Prata: 'bg-[#C0C0C0] text-[#392617]', Bronze: 'bg-[#8C6239] text-white',
}

export function TerapeutasView({ unidadeSlug }: { unidadeSlug: string }) {
  const [dados, setDados] = useState<Terapeuta[]>([])
  const [resp, setResp] = useState<Resposta | null>(null)
  const [pesosEdit, setPesosEdit] = useState<Pesos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mesSelecionado, setMesSelecionado] = useState('')
  const [salvandoPesos, setSalvandoPesos] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [atualizando, setAtualizando] = useState(false)
  const [erroAtualizar, setErroAtualizar] = useState<string | null>(null)

  const fechado = ultimoMesFechado()
  const maxMes = `${fechado.ano}-${String(fechado.mes).padStart(2,'0')}`
  const mesAtualNome = MESES[new Date().getMonth()]

  useEffect(() => { setMesSelecionado(maxMes) }, [maxMes])

  // Datas do período efetivo (semestre → último mês fechado selecionado).
  const datasPeriodo = useCallback(() => {
    const [ano, mes] = mesSelecionado.split('-').map(Number)
    const fut = ano > fechado.ano || (ano === fechado.ano && mes > fechado.mes)
    const anoEf = fut ? fechado.ano : ano
    const mesEf = fut ? fechado.mes : mes
    const ultimoDia = new Date(anoEf, mesEf, 0).getDate()
    return {
      dataIni: mesEf <= 6 ? `${anoEf}-01-01` : `${anoEf}-07-01`,
      dataFim: `${anoEf}-${String(mesEf).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`,
    }
  }, [mesSelecionado, fechado.ano, fechado.mes])

  // Leitura da tela = SEMPRE do cache (instantâneo, não bate no Belle).
  const carregar = useCallback(async () => {
    if (!mesSelecionado) return
    try {
      setLoading(true); setError(null)
      const { dataIni, dataFim } = datasPeriodo()
      const r = await fetch(`/api/belle/terapeutas?unidade=${unidadeSlug}&dataIni=${dataIni}&dataFim=${dataFim}`)
      if (!r.ok) throw new Error('Erro ao carregar dados')
      const j: Resposta = await r.json()
      setResp(j); setDados(j.terapeutas); setPesosEdit(j.pesos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally { setLoading(false) }
  }, [mesSelecionado, unidadeSlug, datasPeriodo])

  useEffect(() => { carregar() }, [carregar])

  // "Atualizar agora" = ÚNICA ação que consulta o Belle (e regrava o cache).
  const atualizarAgora = async () => {
    if (!mesSelecionado || atualizando) return
    setAtualizando(true); setErroAtualizar(null)
    try {
      const { dataIni, dataFim } = datasPeriodo()
      const r = await fetch('/api/terapeutas/atualizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade: unidadeSlug, dataIni, dataFim }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) { setErroAtualizar(j.error || 'Falha ao atualizar.'); return }
      await carregar() // recarrega do cache já atualizado
    } catch {
      setErroAtualizar('Falha ao atualizar.')
    } finally { setAtualizando(false) }
  }

  const atualizadoEm = resp?.atualizadoEm ?? null

  const periodoLabel = (() => {
    if (!mesSelecionado) return ''
    const [ano, mes] = mesSelecionado.split('-').map(Number)
    const fut = ano > fechado.ano || (ano === fechado.ano && mes > fechado.mes)
    const anoEf = fut ? fechado.ano : ano
    const mesEf = fut ? fechado.mes : mes
    return `${MESES[mesEf <= 6 ? 0 : 6]} a ${MESES[mesEf - 1]} ${anoEf}`
  })()

  const podeRestrito = resp?.podeVerRestrito ?? false
  const podeGerenciarPesos = resp?.podeGerenciarPesos ?? false
  const pesos = resp?.pesos ?? { pesoProdutividade:25,pesoFidelizacao:35,pesoNps:20,pesoRecomendacao:10,pesoTreinamento:0,pesoColegas:10 }
  const faixas = resp?.faixas ?? { minDiamante:9.5, minOuro:8.5, minPrata:7.5 }

  // Máximos para as notas (relativas ao melhor do período)
  const max = {
    prod: Math.max(0, ...dados.map(t => t.horasAtendimento)),
    fid: Math.max(0, ...dados.map(t => t.percServicosFidelizados)),
    nps: Math.max(0, ...dados.map(t => t.nps)),
    rec: Math.max(0, ...dados.map(t => t.recomendacaoCliente ?? 0)),
    trein: Math.max(0, ...dados.map(t => t.horasTreinamento ?? 0)),
    col: Math.max(0, ...dados.map(t => t.avaliacaoColegas ?? 0)),
  }
  const notasDe = (t: Terapeuta) => ({
    prod: nota(t.horasAtendimento, max.prod),
    fid: nota(t.percServicosFidelizados, max.fid),
    nps: nota(t.nps, max.nps),
    rec: nota(t.recomendacaoCliente ?? 0, max.rec),
    trein: nota(t.horasTreinamento ?? 0, max.trein),
    col: nota(t.avaliacaoColegas ?? 0, max.col),
  })
  const notaTotalDe = (t: Terapeuta) => {
    const n = notasDe(t)
    return (n.prod*pesos.pesoProdutividade + n.fid*pesos.pesoFidelizacao + n.nps*pesos.pesoNps
      + n.rec*pesos.pesoRecomendacao + n.trein*pesos.pesoTreinamento + n.col*pesos.pesoColegas) / 100
  }
  const notaFinalDe = (t: Terapeuta) => notaTotalDe(t) + (t.avaliacaoGestor ?? 0)

  // Ordenação
  const valorSort = (t: Terapeuta): string | number => {
    const n = notasDe(t)
    switch (sortCol) {
      case 'nome': return t.profissional.toLowerCase()
      case 'prod': return n.prod; case 'fid': return n.fid; case 'nps': return n.nps
      case 'rec': return n.rec; case 'trein': return n.trein; case 'col': return n.col
      case 'total': return notaTotalDe(t); case 'gestor': return t.avaliacaoGestor ?? -99
      case 'final': return notaFinalDe(t); default: return 0
    }
  }
  const ordenados = sortCol
    ? [...dados].sort((a,b) => {
        const va = valorSort(a), vb = valorSort(b)
        const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : dados
  const toggleSort = (c: SortCol) => {
    if (sortCol === c) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(c); setSortDir(c === 'nome' ? 'asc' : 'desc') }
  }
  const seta = (c: SortCol) => sortCol === c ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  // Salvar nota do gestor (inline)
  const salvarGestor = async (t: Terapeuta, valor: string) => {
    const v = valor.trim() === '' ? null : Number(valor)
    if (v !== null && (!Number.isFinite(v) || v < -1 || v > 1)) { alert('Avaliação do Gestor deve estar entre -1 e +1'); return }
    setDados(ds => ds.map(x => x.profissional === t.profissional ? { ...x, avaliacaoGestor: v } : x))
    await fetch('/api/terapeutas/avaliacao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: unidadeSlug, periodo: resp?.periodo, terapeutaNome: t.profissional, avaliacaoGestor: v }),
    }).catch(() => alert('Falha ao salvar a nota do gestor'))
  }

  // Salvar pesos (soma SÓ os 6 campos)
  const somaPesos = pesosEdit ? PESO_ITENS.reduce((s, [k]) => s + (Number(pesosEdit[k]) || 0), 0) : 0
  const salvarPesos = async () => {
    if (!pesosEdit) return
    if (Math.abs(somaPesos - 100) > 0.01) { alert(`A soma dos pesos deve ser 100 (atual: ${somaPesos})`); return }
    setSalvandoPesos(true)
    const r = await fetch('/api/terapeutas/pesos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: unidadeSlug, ...pesosEdit }),
    })
    setSalvandoPesos(false)
    if (r.ok) { setResp(x => x ? { ...x, pesos: pesosEdit } : x) }
    else { const e = await r.json().catch(() => ({})); alert(e.error || 'Falha ao salvar pesos') }
  }

  const thBase = 'px-3 py-3 text-center text-xs font-semibold cursor-pointer select-none hover:bg-[#920000]'

  const ultimaAtual = atualizadoEm ? new Date(atualizadoEm) : null
  const ultimaAtualLabel = ultimaAtual && !isNaN(ultimaAtual.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ultimaAtual)
    : null

  return (
    <div>
      {/* Filtro + pesos */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-[#392617] mb-2">Mês (fim do período)</label>
            <input type="month" value={mesSelecionado} max={maxMes} onChange={e => setMesSelecionado(e.target.value)}
              className="px-4 py-2 border border-[#DDC7A4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D78B18]" />
          </div>
          {mesSelecionado && (
            <div className="pb-1">
              <div><span className="text-sm text-[#392617]/70">Período: </span>
                <span className="text-base font-semibold text-[#7E0000]">{periodoLabel}</span></div>
              <p className="text-xs text-[#392617]/60 mt-1">
                O mês atual ({mesAtualNome}) está em curso e <strong>não é considerado</strong>.
              </p>
            </div>
          )}
          {podeGerenciarPesos && pesosEdit && (
            <div className="ml-auto flex items-center gap-3">
              <span className={`text-sm font-semibold ${Math.abs(somaPesos-100)<0.01 ? 'text-[#425F1D]' : 'text-[#7E0000]'}`}>
                Soma pesos: {somaPesos}%
              </span>
              <button onClick={salvarPesos} disabled={salvandoPesos || Math.abs(somaPesos-100)>0.01}
                className="text-sm px-4 py-2 rounded-lg bg-[#7E0000] text-white disabled:opacity-40">
                {salvandoPesos ? 'Salvando…' : 'Salvar pesos'}
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-[#DDC7A4]/40 flex flex-wrap items-center gap-3">
          <button onClick={atualizarAgora} disabled={atualizando}
            className="text-sm px-4 py-2 rounded-lg border border-[#7E0000] text-[#7E0000] hover:bg-[#7E0000]/5 disabled:opacity-50">
            {atualizando ? 'Atualizando do Belle…' : '↻ Atualizar agora'}
          </button>
          <span className="text-xs text-[#392617]/60">
            {atualizadoEm
              ? <>Última atualização: <strong>{ultimaAtualLabel}</strong>{resp?.atualizadoPor ? ` · por ${resp.atualizadoPor}` : ''}</>
              : 'Nunca atualizado — clique em “Atualizar agora” para buscar do Belle.'}
          </span>
          {atualizando && <span className="text-xs text-[#392617]/50">(pode levar até ~1 min em unidades grandes)</span>}
          {erroAtualizar && <span className="text-xs text-[#7E0000] font-medium">⚠ {erroAtualizar}</span>}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#392617]/70">Carregando dados...</div>
        ) : error ? (
          <div className="p-8 text-center text-[#7E0000]">{error}</div>
        ) : dados.length === 0 ? (
          <div className="p-8 text-center text-[#392617]/70">
            {atualizadoEm
              ? 'Nenhum terapeuta ativo encontrado para o período.'
              : 'Ainda não há dados. Clique em “Atualizar agora” para buscar do Belle.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#7E0000] text-white">
                {podeGerenciarPesos && pesosEdit && (
                  <tr className="bg-[#5E0000]">
                    <th className="px-4 py-1.5 text-left text-[10px] font-normal text-white/70">Peso →</th>
                    {PESO_ITENS.map(([k]) => (
                      <th key={k} className="px-2 py-1.5 text-center whitespace-nowrap">
                        <input type="number" min={0} max={100} value={pesosEdit[k]}
                          onChange={e => setPesosEdit(p => p ? { ...p, [k]: Number(e.target.value) } : p)}
                          className="w-12 px-1 py-0.5 text-center text-xs font-semibold text-[#392617] bg-white rounded border border-[#DDC7A4]" title="peso %" />
                        <span className="ml-0.5 text-[11px] font-semibold text-white">%</span>
                      </th>
                    ))}
                    <th colSpan={4}></th>
                  </tr>
                )}
                <tr>
                  <th onClick={() => toggleSort('nome')} className="px-4 py-3 text-left text-xs font-semibold cursor-pointer select-none hover:bg-[#920000]">Terapeuta{seta('nome')}</th>
                  <th onClick={() => toggleSort('prod')} className={thBase}>Produtividade{seta('prod')}</th>
                  <th onClick={() => toggleSort('fid')} className={thBase}>Fidelização{seta('fid')}</th>
                  <th onClick={() => toggleSort('nps')} className={thBase}>NPS{seta('nps')}</th>
                  <th onClick={() => toggleSort('rec')} className={thBase}>Recomendação{seta('rec')}</th>
                  <th onClick={() => toggleSort('trein')} className={thBase}>Horas Treino{seta('trein')}</th>
                  <th onClick={() => toggleSort('col')} className={thBase}>Aval. Colegas{seta('col')}</th>
                  {podeRestrito && <>
                    <th onClick={() => toggleSort('total')} className={thBase + ' bg-[#5E0000]'}>Nota Total{seta('total')}</th>
                    <th onClick={() => toggleSort('gestor')} className={thBase + ' bg-[#5E0000]'}>Aval. Gestor{seta('gestor')}</th>
                    <th onClick={() => toggleSort('final')} className={thBase + ' bg-[#5E0000]'}>Nota Final{seta('final')}</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold bg-[#5E0000]">Categoria</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDC7A4]/30">
                {ordenados.map((t, i) => {
                  const n = notasDe(t)
                  const nt = notaTotalDe(t), nf = notaFinalDe(t)
                  const catCalc = categoriaCalc(nf, faixas)
                  return (
                    <tr key={`${t.profissional}-${i}`} className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#392617]">{t.profissional}</div>
                        {t.categoria && (
                          <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${CAT_COR[capitaliza(t.categoria)] ?? 'bg-[#DDC7A4] text-[#392617]'}`}>
                            {capitaliza(t.categoria)}
                          </span>
                        )}
                      </td>
                      <Ind nota={n.prod} bruto={`${t.horasAtendimento.toFixed(1)}h`} />
                      <Ind nota={n.fid} bruto={`${t.percServicosFidelizados.toFixed(1)}%`} />
                      <Ind nota={n.nps} bruto={`${t.nps.toFixed(0)}%`} />
                      <Ind nota={n.rec} bruto={t.recomendacaoCliente == null ? '—' : String(t.recomendacaoCliente)} />
                      <Ind nota={n.trein} bruto={t.horasTreinamento == null ? '—' : String(t.horasTreinamento)} />
                      <Ind nota={n.col} bruto={t.avaliacaoColegas == null ? '—' : String(t.avaliacaoColegas)} />
                      {podeRestrito && <>
                        <td className={`px-3 py-3 text-center text-lg font-bold ${corNota(nt)}`}>{nt.toFixed(1)}</td>
                        <td className="px-3 py-3 text-center">
                          <input type="number" step={0.1} min={-1} max={1} defaultValue={t.avaliacaoGestor ?? ''}
                            onBlur={e => { if (String(t.avaliacaoGestor ?? '') !== e.target.value) salvarGestor(t, e.target.value) }}
                            placeholder="—"
                            className="w-16 px-2 py-1 text-center border border-[#DDC7A4] rounded" />
                        </td>
                        <td className={`px-3 py-3 text-center text-lg font-bold ${corNota(nf)}`}>{nf.toFixed(1)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${CAT_COR[catCalc]}`}>{catCalc}</span>
                        </td>
                      </>}
                    </tr>
                  )
                })}
                <tr className="bg-[#DDC7A4]/20">
                  <td className="px-4 py-2 text-sm font-semibold text-[#7E0000]">{dados.length} terapeutas</td>
                  <td colSpan={podeRestrito ? 10 : 6} className="px-3 py-2 text-xs text-[#392617]/60">
                    Notas de 0 a 10 relativas ao melhor do período. {podeRestrito && 'Nota Final = Nota Total + Avaliação do Gestor.'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {podeRestrito && (
        <p className="text-xs text-[#392617]/50 mt-3">
          Colunas Nota Total / Avaliação do Gestor / Nota Final / Categoria são visíveis apenas para DONA, RH e Financeiro.
          Categorias: Diamante ≥ {faixas.minDiamante} · Ouro ≥ {faixas.minOuro} · Prata ≥ {faixas.minPrata} · Bronze abaixo.
        </p>
      )}
    </div>
  )
}

// Célula de indicador: nota em destaque + valor de cálculo discreto embaixo.
function Ind({ nota, bruto }: { nota: number; bruto: string }) {
  return (
    <td className="px-3 py-3 text-center">
      <div className={`text-lg font-bold ${nota >= 9.95 ? 'inline-block rounded-md bg-[#425F1D] px-2 text-white' : corNota(nota)}`}>
        {nota.toFixed(1)}
      </div>
      <div className="text-[10px] text-[#392617]/45">{bruto}</div>
    </td>
  )
}
