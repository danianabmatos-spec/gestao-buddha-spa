'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { addMonths, subMonths } from 'date-fns'
import { RemuneracaoCoordenadora } from '@/components/dashboard/remuneracao-coordenadora'
import { BonificacaoRecepcao } from '@/components/dashboard/bonificacao-recepcao'
import type { FaturamentoMensalResponse } from '@/lib/belle/types'

interface MetaResponse {
  ano: number
  mes: number
  metaFaturamento: number
  metaHoras: number
  metaVendas: number
}

export default function MetasPage() {
  const [mesRef, setMesRef] = useState<Date>(new Date())
  const [faturamento, setFaturamento] = useState<FaturamentoMensalResponse | null>(null)
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const buscar = useCallback(async (d: Date) => {
    setLoading(true)
    setErro(null)
    setFaturamento(null)
    setMeta(null)
    try {
      const mes = format(startOfMonth(d), 'yyyy-MM')
      const [fatResp, metaResp] = await Promise.all([
        fetch(`/api/belle/faturamento?unidade=shopping-metropole&mes=${mes}`),
        fetch(`/api/metas?unidade=shopping-metropole&mes=${mes}`),
      ])
      if (fatResp.ok) setFaturamento(await fatResp.json())
      if (metaResp.ok) setMeta(await metaResp.json())
      else setErro('Meta não configurada para este mês.')
    } catch {
      setErro('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { buscar(mesRef) }, [mesRef, buscar])

  const mesLabel = format(mesRef, 'MMMM yyyy', { locale: ptBR })
    .replace(/^\w/, c => c.toUpperCase())

  return (
    <div className="flex-1 flex flex-col">
      {/* Header da página */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-[#392617]">Metas & Premiações</h1>
          <p className="text-xs text-muted-foreground">Shopping Metrópole</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 bg-[#F5F0EB] rounded-lg p-1">
            <button
              onClick={() => setMesRef(subMonths(mesRef, 1))}
              className="p-1.5 rounded hover:bg-[#DDC7A4] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-semibold text-[#392617] min-w-[130px] text-center">
              {mesLabel}
            </span>
            <button
              onClick={() => setMesRef(addMonths(mesRef, 1))}
              className="p-1.5 rounded hover:bg-[#DDC7A4] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => buscar(mesRef)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[#7E0000] font-medium px-3 py-2 rounded-lg hover:bg-[#F5F0EB] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-6">
        {erro && (
          <div className="bg-[#D78B18]/8 border border-[#D78B18]/20 text-[#D78B18] rounded-lg px-4 py-3 text-sm">
            {erro}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-64 bg-white rounded-xl animate-pulse" />
            <div className="h-64 bg-white rounded-xl animate-pulse" />
          </div>
        )}

        {/* Remuneração Coordenadora */}
        {!loading && faturamento && meta && (
          <RemuneracaoCoordenadora
            faturamentoAtual={faturamento.caixa + faturamento.parcelasComerciais}
            metaFaturamento={meta.metaFaturamento}
            horasAtual={faturamento.horasAtendimento}
            metaHoras={meta.metaHoras}
          />
        )}

        {/* Bonificação Recepção */}
        {!loading && faturamento && meta && (
          <BonificacaoRecepcao
            vendasAtual={faturamento.vendasRecepcao}
            metaVendas={meta.metaVendas}
          />
        )}

        {/* Empty state — mês sem meta configurada */}
        {!loading && !meta && !erro && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Metas não configuradas</p>
            <p className="text-sm mt-1">Este mês ainda não possui metas definidas.</p>
          </div>
        )}
      </main>
    </div>
  )
}
