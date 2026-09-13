'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarCheck2, RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { HeatmapHorarios } from '@/components/dashboard/heatmap-horarios'
import { HeatmapSalas } from '@/components/dashboard/heatmap-salas'
import { FaturamentoCategorias } from '@/components/dashboard/faturamento-categorias'
import { VendasRecepcao } from '@/components/dashboard/vendas-recepcao'
import { NPSCards } from '@/components/dashboard/nps-cards'
import { GoogleReviewsCard } from '@/components/dashboard/google-reviews-card'
import type { AgendamentosResponse } from '@/lib/belle/types'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { useGoogleReviews } from '@/hooks/use-google-reviews'

// Bundle consolidado servido pelo /api/dashboard-unidade (cache-first)
interface DashboardBundle {
  faturamento: { caixa: number; totalPass: number; gympass: number; horasAtendimento: number; voucherSite: number }
  vendas: any
  nps: any
  caixaDiario: { data: string; valor: number }[]
  atualizadoEm?: string | null
}

export default function DashboardUnidadePage() {
  const params = useParams()
  const router = useRouter()
  const unidadeSlug = params.unidade as string

  const unidadeConfig = getUnidadeCredenciais(unidadeSlug)

  const hoje = new Date()
  const [dataIni, setDataIni] = useState<Date>(startOfMonth(hoje))
  const [dataFim, setDataFim] = useState<Date>(hoje)

  // Bloco pesado (faturamento + vendas + nps + caixa diário) via cache-first
  const [bundle, setBundle] = useState<DashboardBundle | null>(null)
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)

  // Agenda (heatmaps do último dia) — rápida, segue ao vivo
  const [dados, setDados] = useState<AgendamentosResponse | null>(null)
  const [loadingAgenda, setLoadingAgenda] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fetchingAgenda = useRef(false)

  // Google Reviews — rápido (~0,1s), segue via hook próprio
  const { data: googleReviews, loading: loadingGoogle } = useGoogleReviews(unidadeSlug)

  useEffect(() => {
    if (!unidadeConfig) router.push('/dashboard/shopping-metropole')
  }, [unidadeConfig, router])

  // Bundle cache-first: instantâneo quando há cache
  const buscarBundle = useCallback(async (ini: Date, fim: Date) => {
    setLoadingBundle(true)
    try {
      const iniStr = format(ini, 'yyyy-MM-dd')
      const fimStr = format(fim, 'yyyy-MM-dd')
      const resp = await fetch(`/api/dashboard-unidade?unidade=${unidadeSlug}&dataIni=${iniStr}&dataFim=${fimStr}`)
      if (resp.ok) {
        const d = await resp.json()
        setBundle(d)
        setAtualizadoEm(d.atualizadoEm ?? null)
      }
    } catch {
      // secundário
    } finally {
      setLoadingBundle(false)
    }
  }, [unidadeSlug])

  // Agenda: mostra o último dia do período
  const buscarAgenda = useCallback(async (fim: Date) => {
    if (fetchingAgenda.current) return
    fetchingAgenda.current = true
    setLoadingAgenda(true)
    setErro(null)
    try {
      const dataStr = format(fim, 'yyyy-MM-dd')
      const resp = await fetch(`/api/belle/agendamentos?data=${dataStr}&unidade=${unidadeSlug}`)
      if (!resp.ok) throw new Error('Falha')
      setDados(await resp.json())
    } catch {
      setErro('Não foi possível carregar os dados. Verifique a conexão com o Belle.')
    } finally {
      setLoadingAgenda(false)
      fetchingAgenda.current = false
    }
  }, [unidadeSlug])

  // "Atualizar agora": recalcula o bundle no servidor (POST) e recarrega
  const atualizarAgora = useCallback(async () => {
    setAtualizando(true)
    try {
      const iniStr = format(dataIni, 'yyyy-MM-dd')
      const fimStr = format(dataFim, 'yyyy-MM-dd')
      await fetch(`/api/dashboard-unidade?unidade=${unidadeSlug}&dataIni=${iniStr}&dataFim=${fimStr}`, { method: 'POST' })
      await Promise.all([buscarBundle(dataIni, dataFim), buscarAgenda(dataFim)])
    } finally {
      setAtualizando(false)
    }
  }, [unidadeSlug, dataIni, dataFim, buscarBundle, buscarAgenda])

  useEffect(() => {
    if (!unidadeConfig) return
    const timeoutId = setTimeout(() => {
      buscarBundle(dataIni, dataFim)
      buscarAgenda(dataFim)
    }, 200)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataIni, dataFim, unidadeConfig])

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

  const faturamento = bundle?.faturamento
  const vendas = bundle?.vendas
  const npsData = bundle?.nps
  const loading = loadingBundle || loadingAgenda || loadingGoogle

  if (!unidadeConfig) {
    return <div className="flex items-center justify-center h-screen">Redirecionando...</div>
  }

  return (
    <>
      <Header
        dataIni={dataIni}
        dataFim={dataFim}
        unidade={unidadeConfig.nome}
        loading={loading}
        onPeriodoChange={handlePeriodoChange}
        onRefresh={atualizarAgora}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Barra de atualização (cache-first) */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {atualizadoEm
              ? `Atualizado ${format(new Date(atualizadoEm), "dd/MM 'às' HH:mm", { locale: ptBR })}`
              : loadingBundle ? 'Carregando…' : ''}
          </span>
          <button
            onClick={atualizarAgora}
            disabled={atualizando}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7E0000] hover:text-[#5c0000] disabled:opacity-50"
          >
            <RefreshCw size={13} className={atualizando ? 'animate-spin' : ''} />
            {atualizando ? 'Atualizando…' : 'Atualizar agora'}
          </button>
        </div>

        {erro && (
          <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 text-sm">
            {erro}
          </div>
        )}

        {/* Faturamento por Categoria */}
        {loadingBundle && !faturamento ? (
          <div className="h-32 bg-white rounded-xl animate-pulse" />
        ) : faturamento ? (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Faturamento do Período — {periodoLabel()}
            </p>
            <FaturamentoCategorias
              caixa={faturamento.caixa}
              totalPass={faturamento.totalPass}
              gympass={faturamento.gympass}
              voucherSite={faturamento.voucherSite}
            />
          </section>
        ) : null}

        {/* Vendas da Recepção */}
        {loadingBundle && !vendas ? (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Vendas da Recepção — {periodoLabel()}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="h-40 bg-white rounded-xl animate-pulse" />
              <div className="h-40 bg-white rounded-xl animate-pulse" />
              <div className="h-40 bg-white rounded-xl animate-pulse" />
            </div>
            <div className="h-24 bg-white rounded-xl animate-pulse" />
          </section>
        ) : vendas ? (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Vendas da Recepção — {periodoLabel()}
            </p>
            <VendasRecepcao
              vouchers={vendas.vouchers}
              planos={vendas.planos}
              produtos={vendas.produtos}
              total={vendas.total}
              caixa={faturamento?.caixa}
              caixaDiario={bundle?.caixaDiario}
            />
          </section>
        ) : null}

        {/* NPS - Indicadores de Satisfação */}
        {loadingBundle && !npsData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-52 bg-white rounded-xl animate-pulse" />
            <div className="h-52 bg-white rounded-xl animate-pulse" />
            <div className="h-52 bg-white rounded-xl animate-pulse" />
          </div>
        ) : npsData ? (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Indicadores de Satisfação (NPS) — {periodoLabel()}
            </p>
            <NPSCards data={npsData} />
          </section>
        ) : null}

        {/* Avaliações Google */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Reputação Online
          </p>
          <GoogleReviewsCard data={googleReviews} loading={loadingGoogle} />
        </section>

        {/* Heatmaps — agenda do último dia do período */}
        {loadingAgenda && !dados ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-52 bg-white rounded-xl animate-pulse" />
            <div className="h-52 bg-white rounded-xl animate-pulse" />
          </div>
        ) : dados ? (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Mapa de Calor — {format(dataFim, "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HeatmapHorarios
                agendamentos={dados.agendamentos}
                dataLabel={format(dataFim, "dd/MM/yyyy")}
                usarMapaSemanal={false}
              />
              <HeatmapSalas
                agendamentos={dados.agendamentos}
                dataLabel={format(dataFim, "dd/MM/yyyy")}
              />
            </div>
          </section>
        ) : null}

        {!loadingAgenda && dados && dados.kpis.totalAgendamentos === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarCheck2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum agendamento neste dia</p>
            <p className="text-sm mt-1">Selecione outro período ou verifique o Belle.</p>
          </div>
        )}
      </main>
    </>
  )
}
