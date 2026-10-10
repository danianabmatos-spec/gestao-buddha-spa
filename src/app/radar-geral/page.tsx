'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import type { RadarGeralData } from '@/types/radar-geral'
import { UNIDADES_CONFIG } from '@/types/radar-geral'
import { getMetasUnidade } from '@/lib/metas/config'

// Status da meta (mesmas faixas/cores da tela de Metas e Premiações).
function statusMeta(pct: number): { label: string; cor: string } {
  if (pct < 70) return { label: 'Crítico', cor: '#7E0000' }
  if (pct < 86) return { label: 'Fraco', cor: '#D78B18' }
  if (pct < 100) return { label: 'Atenção', cor: '#B8860B' }
  if (pct < 111) return { label: 'No ritmo', cor: '#8BC34A' }
  if (pct < 121) return { label: 'Muito bom', cor: '#689F38' }
  return { label: 'Excelente', cor: '#33691E' }
}

interface MetaUnidade { u: number; r: number; h: number }

export default function RadarGeralPage() {
  const hoje = new Date()
  const [dataIni, setDataIni] = useState<Date>(startOfMonth(hoje))
  const [dataFim, setDataFim] = useState<Date>(hoje)
  const [dados, setDados] = useState<RadarGeralData | null>(null)
  const [loading, setLoading] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [pontos, setPontos] = useState<Record<string, number>>({})
  const [metas, setMetas] = useState<Record<string, MetaUnidade>>({})

  // Visão de MÊS: os status de meta só aparecem quando o período é um mês (começa no
  // dia 1 e fecha no mesmo mês). Em período solto (semana, intervalo custom), esconde.
  const mesmoMes = dataIni.getDate() === 1 && dataIni.getMonth() === dataFim.getMonth() && dataIni.getFullYear() === dataFim.getFullYear()
  const anoM = dataIni.getFullYear()
  const mesM = dataIni.getMonth() + 1
  const diasNoMes = new Date(anoM, mesM, 0).getDate()
  const diasDecorridos = dataFim.getDate()
  const mesCompleto = anoM < hoje.getFullYear() || (anoM === hoje.getFullYear() && mesM < hoje.getMonth() + 1) || diasDecorridos >= diasNoMes

  const buscarDados = useCallback(async (ini: Date, fim: Date) => {
    setLoading(true)
    try {
      const iniStr = format(ini, 'yyyy-MM-dd')
      const fimStr = format(fim, 'yyyy-MM-dd')

      const resp = await fetch(`/api/radar-geral?dataIni=${iniStr}&dataFim=${fimStr}`)
      if (resp.ok) {
        const data = await resp.json()
        setDados(data)
        setAtualizadoEm(data.atualizadoEm ?? null)
      } else {
        console.error('Erro ao buscar dados do radar geral:', resp.status)
      }
    } catch (error) {
      console.error('Erro ao buscar dados do radar geral:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Recalcula ao vivo (pesado) e atualiza o cache, depois relê.
  const atualizarAgora = useCallback(async () => {
    setAtualizando(true)
    try {
      const iniStr = format(dataIni, 'yyyy-MM-dd')
      const fimStr = format(dataFim, 'yyyy-MM-dd')
      await fetch(`/api/radar-geral?dataIni=${iniStr}&dataFim=${fimStr}`, { method: 'POST' })
      await buscarDados(dataIni, dataFim)
    } finally {
      setAtualizando(false)
    }
  }, [dataIni, dataFim, buscarDados])

  useEffect(() => {
    buscarDados(dataIni, dataFim)
  }, [dataIni, dataFim, buscarDados])

  // Pontuação do Programa de Recomendação (por unidade) do mês do período.
  useEffect(() => {
    const ref = format(dataFim, 'yyyy-MM')
    fetch(`/api/pontuacao?geral=1&ref=${ref}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const m: Record<string, number> = {}
        if (j && j.unidades) for (const u of j.unidades) m[u.slug] = u.totalUnidade
        setPontos(m)
      })
      .catch(() => setPontos({}))
  }, [dataFim])

  // Metas do mês (Folha, com fallback no config) — base dos status no Radar. Só busca
  // quando é visão de mês; em período solto zera (não mostra bolinha).
  useEffect(() => {
    if (!mesmoMes) { setMetas({}); return }
    fetch(`/api/metas-folha?ano=${anoM}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((folha) => {
        const m: Record<string, MetaUnidade> = {}
        for (const cfg of UNIDADES_CONFIG) {
          const fm = folha?.porSlug?.[cfg.slug]?.metas?.find((x: { mes: number }) => x.mes === mesM)
          const c = getMetasUnidade(cfg.slug, anoM)?.metas.find((x) => x.mes === mesM)
          m[cfg.slug] = {
            u: fm ? fm.metaFaturamento : (c?.metaUnidade ?? 0),
            r: fm ? fm.metaRecepcao : (c?.metaRecepcao ?? 0),
            h: fm ? fm.metaHoras : (c?.metaHoras ?? 0),
          }
        }
        setMetas(m)
      })
      .catch(() => setMetas({}))
  }, [anoM, mesM, mesmoMes])

  const handlePeriodoChange = (ini: Date, fim: Date) => {
    setDataIni(ini)
    setDataFim(fim)
  }

  const periodoLabel = () => {
    const ini = format(dataIni, 'MMMM yyyy', { locale: ptBR })
    const fim = format(dataFim, 'MMMM yyyy', { locale: ptBR })
    return ini === fim
      ? ini.replace(/^\w/, c => c.toUpperCase())
      : `${format(dataIni, 'dd/MM')} a ${format(dataFim, 'dd/MM/yyyy')}`
  }

  const formatReal = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)
  }

  // Bolinha de status da meta (projeção do mês vs meta). Retorna null quando não é visão
  // de mês ou a meta não está configurada (aí não polui).
  const statusDot = (realizado: number, meta: number | undefined, formato: 'moeda' | 'horas') => {
    if (!mesmoMes || !meta || meta <= 0) return null
    const projecao = mesCompleto ? realizado : (diasDecorridos > 0 ? (realizado / diasDecorridos) * diasNoMes : 0)
    const s = statusMeta((projecao / meta) * 100)
    const fmt = (v: number) => (formato === 'horas' ? `${v.toFixed(0)}h` : formatReal(v))
    const titulo = `Meta ${fmt(meta)} · Realizado ${fmt(realizado)} (${Math.round((realizado / meta) * 100)}%) · Projeção ${fmt(projecao)} → ${s.label}`
    return <span title={titulo} aria-label={s.label} className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle shrink-0" style={{ backgroundColor: s.cor }} />
  }

  const formatRealDetalhado = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor)
  }

  return (
    <>
      <Header
        dataIni={dataIni}
        dataFim={dataFim}
        unidade="Radar Geral - 7 Unidades"
        loading={loading}
        onPeriodoChange={handlePeriodoChange}
        onRefresh={() => buscarDados(dataIni, dataFim)}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6 bg-[#F5F0EB]">
        {/* Título */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#7E0000]">Radar Geral</h1>
            <p className="text-sm text-[#392617]/60 mt-1">
              Visão consolidada das 7 unidades Buddha Spa — {periodoLabel()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {atualizadoEm && (
              <span className="text-xs text-[#392617]/50">
                Atualizado {new Date(atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={atualizarAgora} disabled={atualizando || loading}
              className="px-3 py-2 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-sm font-medium hover:bg-[#5c0000] disabled:opacity-50 flex items-center gap-2">
              <RefreshCw size={15} className={atualizando ? 'animate-spin' : ''} /> {atualizando ? 'Atualizando…' : 'Atualizar agora'}
            </button>
          </div>
        </div>


        {/* Tabela Consolidada */}
        <div>
          <h2 className="text-lg font-bold text-[#392617] mb-4">
            Indicadores por Unidade
          </h2>

          {/* Aviso quando alguma unidade não carregou: em vez de sumir/virar 0
              silencioso, o Radar avisa qual unidade faltou e que os totais estão incompletos. */}
          {dados && dados.unidades.some(u => u.status !== 'ativo') && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Não foi possível carregar:</strong>{' '}
                {dados.unidades.filter(u => u.status !== 'ativo').map(u => u.nome).join(', ')}.
                {' '}Os totais abaixo <strong>não incluem</strong>{' '}
                {dados.unidades.filter(u => u.status !== 'ativo').length > 1 ? 'essas unidades' : 'essa unidade'}.
                {' '}Clique em <strong>Atualizar agora</strong> para tentar de novo.
              </div>
            </div>
          )}

          {loading && !dados ? (
            <div className="bg-white rounded-xl h-96 animate-pulse" />
          ) : dados ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#7E0000] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 bg-[#7E0000] z-10">
                        Indicador
                      </th>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => {
                          const config = UNIDADES_CONFIG.find(c => c.slug === unidade.slug)
                          return (
                            <th key={unidade.slug} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                              <div className="flex items-center justify-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: config?.cor || '#7E0000' }}
                                />
                                <span className="whitespace-nowrap">{unidade.nome}</span>
                              </div>
                            </th>
                          )
                        })}
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider bg-[#5c0000]">
                        Total Geral
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDC7A4]/30">
                    {/* Recebido em Caixa */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        Recebido em Caixa
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                            {statusDot(unidade.faturamento.caixa, metas[unidade.slug]?.u, 'moeda')}{formatReal(unidade.faturamento.caixa)}
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {formatReal(dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) => sum + u.faturamento.caixa, 0))}
                      </td>
                    </tr>

                    {/* Vendas da Recepção */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        Vendas da Recepção
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                            {statusDot(unidade.vendasRecepcao, metas[unidade.slug]?.r, 'moeda')}{formatReal(unidade.vendasRecepcao)}
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {formatReal(dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) => sum + u.vendasRecepcao, 0))}
                      </td>
                    </tr>

                    {/* TotalPass */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        TotalPass
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                            {formatReal(unidade.faturamento.totalPass)}
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {formatReal(dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) => sum + u.faturamento.totalPass, 0))}
                      </td>
                    </tr>

                    {/* Gympass */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        Gympass
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                            {formatReal(unidade.faturamento.gympass)}
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {formatReal(dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) => sum + u.faturamento.gympass, 0))}
                      </td>
                    </tr>

                    {/* Voucher Site */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        Voucher Site
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                            {formatReal(unidade.faturamento.voucherSite)}
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {formatReal(dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) => sum + u.faturamento.voucherSite, 0))}
                      </td>
                    </tr>

                    {/* Faturamento Total */}
                    <tr className="bg-[#DDC7A4]/30 hover:bg-[#DDC7A4]/40 transition-colors">
                      <td className="px-4 py-4 text-sm font-bold text-[#7E0000] sticky left-0 bg-[#DDC7A4]/30 z-10">
                        FATURAMENTO TOTAL
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => {
                          const total = unidade.faturamento.caixa +
                                       unidade.faturamento.totalPass +
                                       unidade.faturamento.gympass +
                                       unidade.faturamento.voucherSite
                          return (
                            <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                              {formatReal(total)}
                            </td>
                          )
                        })}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000] bg-[#DDC7A4]/40">
                        {formatReal(dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) =>
                          sum + u.faturamento.caixa + u.faturamento.totalPass + u.faturamento.gympass + u.faturamento.voucherSite, 0
                        ))}
                      </td>
                    </tr>

                    {/* Pontuação — Programa de Recomendação */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#7E0000] sticky left-0 bg-white z-10">
                        🏆 Pontuação
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#7E0000]">
                            {pontos[unidade.slug] ?? 0} pts
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {dados.unidades.filter(u => u.status === 'ativo').reduce((sum, u) => sum + (pontos[u.slug] ?? 0), 0)} pts
                      </td>
                    </tr>

                    {/* Horas de Atendimento */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        Horas de Atendimento
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#425F1D]">
                            {statusDot(unidade.horasAtendimento, metas[unidade.slug]?.h, 'horas')}{unidade.horasAtendimento.toFixed(1)}h
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {dados.totalizadores.horasTotais.toFixed(1)}h
                      </td>
                    </tr>

                    {/* NPS */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        NPS
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className={`px-4 py-4 text-sm text-center font-semibold ${
                            unidade.nps >= 90
                              ? 'text-[#425F1D]'
                              : unidade.nps >= 70
                              ? 'text-[#D78B18]'
                              : 'text-[#7E0000]'
                          }`}>
                            {unidade.nps}
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {dados.totalizadores.npsMedia}
                      </td>
                    </tr>

                    {/* Google */}
                    <tr className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-[#392617] sticky left-0 bg-white z-10">
                        Nota Google
                      </td>
                      {dados.unidades
                        .filter(u => u.status === 'ativo')
                        .map((unidade) => (
                          <td key={unidade.slug} className="px-4 py-4 text-sm text-center font-semibold text-[#D78B18]">
                            {unidade.notaGoogle.toFixed(1)} ★
                          </td>
                        ))}
                      <td className="px-4 py-4 text-sm text-center font-bold text-[#7E0000]">
                        {dados.totalizadores.notaGoogleMedia.toFixed(1)} ★
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-[#392617]/60">Carregando dados...</p>
            </div>
          )}
        </div>

        {/* Legenda */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-[#DDC7A4]/30">
          <h3 className="text-sm font-semibold text-[#392617] mb-3">Legenda</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#392617]/70">
            <div>
              <p className="font-semibold mb-1">Status:</p>
              <p>• <span className="text-[#425F1D]">Ativo:</span> Dados sendo exibidos</p>
              <p>• <span className="text-[#392617]/40">Sem dados:</span> Aguardando configuração</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Faturamento:</p>
              <p>• Caixa: Recebido em caixa (Belle)</p>
              <p>• Parcerias: TotalPass + Gympass</p>
              <p>• Vouchers: Vouchers do site</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Indicadores:</p>
              <p>• NPS: Net Promoter Score (0-100)</p>
              <p>• Google: Rating do Google (0-5)</p>
              <p>• Horas: Horas de atendimento</p>
            </div>
          </div>
          {mesmoMes && (
            <div className="mt-4 pt-3 border-t border-[#DDC7A4]/40">
              <p className="font-semibold text-xs text-[#392617]/70 mb-2">
                Status da meta <span className="font-normal">(bolinha ao lado de Recebido em Caixa, Vendas da Recepção e Horas — projeção do mês vs meta)</span>:
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#392617]/80">
                {[
                  { c: '#7E0000', l: 'Crítico', f: '< 70%' },
                  { c: '#D78B18', l: 'Fraco', f: '70-85%' },
                  { c: '#B8860B', l: 'Atenção', f: '86-99%' },
                  { c: '#8BC34A', l: 'No ritmo', f: '100-110%' },
                  { c: '#689F38', l: 'Muito bom', f: '111-120%' },
                  { c: '#33691E', l: 'Excelente', f: '> 120%' },
                ].map((s) => (
                  <span key={s.l} className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.c }} />
                    <b className="font-medium">{s.l}</b> <span className="text-[#392617]/50">{s.f}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
