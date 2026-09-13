'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SerieDia {
  data: string
  contatos: number
  conversoes: number
}

interface TaxaGrupo {
  grupo: string
  total: number
  convertidos: number
  taxa: number
}

interface UltimoContato {
  id: number
  nomeCliente: string
  unidadeSlug: string
  motivoContato: string
  criadoEm: string
  converteu: boolean
  tipoConversao: string | null
  dataConversao: string | null
}

interface Resultados {
  acoes: {
    hoje: number
    semana: number
    mes: number
    porMotivo: Record<string, number>
    porUnidade: Record<string, number>
  }
  conversoes: {
    totalContatados30d: number
    totalConvertidos30d: number
    taxaGeral: number
    taxaPorGrupo: TaxaGrupo[]
  }
  series: {
    diaria: SerieDia[]
    semanal: SerieDia[]
  }
  ultimosContatos: UltimoContato[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIDADES: Record<string, string> = {
  'shopping-metropole':     'Shp. Metrópole',
  'tatuape-gomescardim':    'Tatuapé',
  'mooca-plaza':            'Mooca Plaza',
  'analia-franco':          'Anália Franco',
  'perdizes':               'Perdizes',
  'shopping-analia-franco': 'Shp. Anália',
  'higienopolis':           'Higienópolis',
}

const MOTIVO_LABEL: Record<string, string> = {
  PACOTE_A_VENCER:        'A Vencer',
  PACOTE_ATIVO:           'Ativo',
  PACOTE_FINALIZADO_30:   'Finalizado ≤30d',
  PACOTE_FINALIZADO_90:   'Finalizado ≤90d',
  PACOTE_FINALIZADO_180:  'Finalizado ≤180d',
  PACOTE_FINALIZADO_PLUS: 'Finalizado +180d',
  PACOTE_VENCIDO_ATE30:   'Vencido ≤30d (grátis)',
  PACOTE_VENCIDO_MAIS30:  'Vencido +30d (20%)',
  EM_RISCO:            'Em Risco',
  FREQUENTE_SEM_PACOTE: 'Frequente s/ Pacote',
  NOVO:                'Novo',
  PERDIDO:             'Perdido',
  // históricos (registros antigos)
  PACOTE_FINALIZADO:   'Finalizado',
  PACOTE_VENCIDO_30:   'Vencido ≤30d',
  PACOTE_VENCIDO_90:   'Vencido ≤90d',
  PACOTE_VENCIDO_180:  'Vencido ≤180d',
  PACOTE_VENCIDO_PLUS: 'Vencido +180d',
}

// Cores dentro da paleta Buddha (sem azul/lilás) — espelham a Fila do Dia.
const MOTIVO_COR: Record<string, string> = {
  PACOTE_A_VENCER:        '#8B6914',
  PACOTE_ATIVO:           '#425F1D',
  PACOTE_FINALIZADO_30:   '#8a5a3c',
  PACOTE_FINALIZADO_90:   '#6f4630',
  PACOTE_FINALIZADO_180:  '#553526',
  PACOTE_FINALIZADO_PLUS: '#392617',
  PACOTE_VENCIDO_ATE30:   '#a85a1e',
  PACOTE_VENCIDO_MAIS30:  '#7E0000',
  EM_RISCO:            '#D78B18',
  FREQUENTE_SEM_PACOTE: '#557A1E',
  NOVO:                '#425F1D',
  PERDIDO:             '#7E0000',
  // históricos
  PACOTE_FINALIZADO:   '#6f4630',
  PACOTE_VENCIDO_30:   '#a85a1e',
  PACOTE_VENCIDO_90:   '#6b2a2a',
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const TODAS_UNIDADES = [
  { slug: 'shopping-metropole',     nome: 'Shopping Metrópole' },
  { slug: 'tatuape-gomescardim',    nome: 'Tatuapé' },
  { slug: 'mooca-plaza',            nome: 'Mooca Plaza' },
  { slug: 'analia-franco',          nome: 'Anália Franco' },
  { slug: 'perdizes',               nome: 'Perdizes' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália' },
  { slug: 'higienopolis',           nome: 'Higienópolis' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ResultadosPage() {
  const [unidade, setUnidade] = useState('')          // '' = todas
  const [dados, setDados]     = useState<Resultados | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'atividade' | 'conversoes'>('atividade')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = unidade ? `?unidade=${unidade}` : ''
      const r = await fetch(`/api/inteligencia/resultados${qs}`)
      setDados(await r.json())
    } finally {
      setLoading(false)
    }
  }, [unidade])

  useEffect(() => { carregar() }, [carregar])

  if (!dados && loading) {
    return <div className="flex items-center justify-center h-64 text-[#392617]/40">Carregando...</div>
  }

  const d = dados!

  // Últimos 14 dias da série diária (mais legível no gráfico)
  const serie14d = d?.series.diaria.slice(-14) ?? []
  const serieSem = d?.series.semanal ?? []

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#392617]">Resultados & Atividade</h1>
          <p className="text-sm text-[#392617]/60 mt-0.5">Monitoramento de ações da recepção e taxas de conversão</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={unidade} onChange={e => setUnidade(e.target.value)}
            className="text-sm border border-[#DDC7A4] rounded-lg px-3 py-2 bg-white text-[#392617]"
          >
            <option value="">Todas as unidades</option>
            {TODAS_UNIDADES.map(u => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
          </select>
          <button
            onClick={carregar}
            className="text-sm border border-[#DDC7A4] text-[#392617] px-3 py-2 rounded-lg hover:bg-[#DDC7A4]/20"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#DDC7A4]/20 p-1 rounded-xl w-fit">
        {(['atividade', 'conversoes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white text-[#7E0000] shadow-sm' : 'text-[#392617]/60 hover:text-[#392617]'
            }`}
          >
            {t === 'atividade' ? '📊 Atividade da Recepção' : '🎯 Resultados & Conversões'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'atividade' && (
        <div className="space-y-5">

          {/* KPIs de ações */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
              <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Hoje</p>
              <p className="text-4xl font-bold text-[#7E0000] mt-1">{d.acoes.hoje}</p>
              <p className="text-xs text-[#392617]/40 mt-0.5">mensagens enviadas</p>
            </div>
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
              <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Esta semana</p>
              <p className="text-4xl font-bold text-[#D78B18] mt-1">{d.acoes.semana}</p>
              <p className="text-xs text-[#392617]/40 mt-0.5">desde domingo</p>
            </div>
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5 col-span-2 sm:col-span-1">
              <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Este mês</p>
              <p className="text-4xl font-bold text-[#425F1D] mt-1">{d.acoes.mes}</p>
              <p className="text-xs text-[#392617]/40 mt-0.5">total acumulado</p>
            </div>
          </div>

          {/* Gráfico diário */}
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
            <h2 className="font-semibold text-[#392617] mb-4">Contatos por dia (últimos 14 dias)</h2>
            {serie14d.every(d => d.contatos === 0)
              ? <p className="text-center text-[#392617]/40 py-12 text-sm">Nenhum contato registrado ainda.<br/>Os contatos aparecerão aqui conforme a recepção enviar mensagens pelo painel.</p>
              : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serie14d} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DDC7A4" opacity={0.4} />
                  <XAxis dataKey="data" tickFormatter={formatarData} tick={{ fontSize: 11, fill: '#392617' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#392617' }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderColor: '#DDC7A4' }}
                  />
                  <Bar dataKey="contatos"  fill="#7E0000"  radius={[4,4,0,0]} name="Contatos" />
                  <Bar dataKey="conversoes" fill="#D78B18" radius={[4,4,0,0]} name="Conversões" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Por grupo e por unidade lado a lado */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Por grupo */}
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
              <h2 className="font-semibold text-[#392617] mb-3">Por grupo (este mês)</h2>
              {Object.keys(d.acoes.porMotivo).length === 0
                ? <p className="text-[#392617]/40 text-sm py-4 text-center">Sem dados ainda</p>
                : (
                <div className="space-y-2.5">
                  {Object.entries(d.acoes.porMotivo)
                    .sort((a, b) => b[1] - a[1])
                    .map(([motivo, n]) => {
                      const max = Math.max(...Object.values(d.acoes.porMotivo))
                      const pct = max > 0 ? (n / max) * 100 : 0
                      return (
                        <div key={motivo}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#392617]/70">{MOTIVO_LABEL[motivo] ?? motivo}</span>
                            <span className="font-medium text-[#392617]">{n}</span>
                          </div>
                          <div className="h-1.5 bg-[#DDC7A4]/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: MOTIVO_COR[motivo] ?? '#7E0000' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Por unidade */}
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
              <h2 className="font-semibold text-[#392617] mb-3">Por unidade (este mês)</h2>
              {Object.keys(d.acoes.porUnidade).length === 0
                ? <p className="text-[#392617]/40 text-sm py-4 text-center">Sem dados ainda</p>
                : (
                <div className="space-y-2.5">
                  {Object.entries(d.acoes.porUnidade)
                    .sort((a, b) => b[1] - a[1])
                    .map(([slug, n]) => {
                      const max = Math.max(...Object.values(d.acoes.porUnidade))
                      const pct = max > 0 ? (n / max) * 100 : 0
                      return (
                        <div key={slug}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#392617]/70">{UNIDADES[slug] ?? slug}</span>
                            <span className="font-medium text-[#392617]">{n}</span>
                          </div>
                          <div className="h-1.5 bg-[#DDC7A4]/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#7E0000] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Feed de últimos contatos */}
          <div className="bg-white rounded-xl border border-[#DDC7A4] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDC7A4]/50">
              <h2 className="font-semibold text-[#392617]">Últimos contatos</h2>
            </div>
            {d.ultimosContatos.length === 0
              ? <p className="text-center text-[#392617]/40 py-12 text-sm">Nenhum contato registrado ainda.</p>
              : (
              <div className="divide-y divide-[#DDC7A4]/30">
                {d.ultimosContatos.slice(0, 20).map(c => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#392617] truncate">{c.nomeCliente}</p>
                      <p className="text-xs text-[#392617]/50">
                        {UNIDADES[c.unidadeSlug] ?? c.unidadeSlug} · {MOTIVO_LABEL[c.motivoContato] ?? c.motivoContato} · {formatarDataHora(c.criadoEm)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
                      c.converteu
                        ? 'bg-[#425F1D]/12 text-[#425F1D]'
                        : 'bg-[#DDC7A4]/30 text-[#392617]/50'
                    }`}>
                      {c.converteu ? `✓ ${c.tipoConversao === 'nova_sessao' ? 'Nova sessão' : c.tipoConversao === 'renovacao_pacote' ? 'Renovou' : 'Novo pacote'}` : 'Aguardando'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'conversoes' && (
        <div className="space-y-5">

          {/* KPIs de conversão */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
              <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Contatados (30d)</p>
              <p className="text-4xl font-bold text-[#392617] mt-1">{d.conversoes.totalContatados30d}</p>
              <p className="text-xs text-[#392617]/40 mt-0.5">clientes abordados</p>
            </div>
            <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
              <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Convertidos (30d)</p>
              <p className="text-4xl font-bold text-[#425F1D] mt-1">{d.conversoes.totalConvertidos30d}</p>
              <p className="text-xs text-[#392617]/40 mt-0.5">agendaram ou renovaram</p>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-[#7E0000] to-[#5c0000] rounded-xl p-5 text-white">
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">Taxa de Conversão</p>
              <p className="text-5xl font-bold mt-1">{d.conversoes.taxaGeral}%</p>
              <p className="text-xs opacity-60 mt-0.5">nos últimos 30 dias</p>
            </div>
          </div>

          {/* Gráfico semanal contatos vs conversões */}
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
            <h2 className="font-semibold text-[#392617] mb-4">Contatos vs Conversões por semana</h2>
            {serieSem.every(s => s.contatos === 0)
              ? <p className="text-center text-[#392617]/40 py-12 text-sm">Histórico semanal aparecerá conforme os dados forem acumulando.</p>
              : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serieSem} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DDC7A4" opacity={0.4} />
                  <XAxis dataKey="semana" tickFormatter={formatarData} tick={{ fontSize: 11, fill: '#392617' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#392617' }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderColor: '#DDC7A4' }}
                  />
                  <Legend formatter={(v) => v === 'contatos' ? 'Contatos' : 'Conversões'} />
                  <Bar dataKey="contatos"   fill="#DDC7A4" radius={[4,4,0,0]} name="contatos" />
                  <Bar dataKey="conversoes" fill="#7E0000" radius={[4,4,0,0]} name="conversoes" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Taxa por grupo */}
          <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
            <h2 className="font-semibold text-[#392617] mb-4">Taxa de conversão por grupo (30 dias)</h2>
            {d.conversoes.taxaPorGrupo.length === 0
              ? <p className="text-center text-[#392617]/40 py-12 text-sm">
                  Dados de conversão aparecem automaticamente no próximo sync (3h).<br/>
                  O sistema detecta se clientes contatados agendaram ou renovaram o pacote.
                </p>
              : (
              <div className="space-y-3">
                {d.conversoes.taxaPorGrupo.map(({ grupo, total, convertidos, taxa }) => (
                  <div key={grupo} className="flex items-center gap-4">
                    <div className="w-40 shrink-0">
                      <p className="text-sm text-[#392617]/70">{MOTIVO_LABEL[grupo] ?? grupo}</p>
                      <p className="text-xs text-[#392617]/40">{convertidos}/{total} clientes</p>
                    </div>
                    <div className="flex-1 h-5 bg-[#DDC7A4]/20 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(taxa, 4)}%`, backgroundColor: MOTIVO_COR[grupo] ?? '#7E0000' }}
                      />
                    </div>
                    <span className="text-sm font-bold text-[#392617] w-10 text-right">{taxa}%</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-[#392617]/40 mt-4">
              Conversão = cliente que agendou nova sessão, renovou ou adquiriu pacote nos 30 dias após o contato.
              Detectado automaticamente a cada sync (3h).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
