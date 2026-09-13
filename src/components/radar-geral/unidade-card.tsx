import { Star, TrendingUp, Clock, ThumbsUp } from 'lucide-react'
import type { IndicadoresUnidade } from '@/types/radar-geral'

interface UnidadeCardProps {
  unidade: IndicadoresUnidade
  cor?: string
}

export function UnidadeCard({ unidade, cor = '#7E0000' }: UnidadeCardProps) {
  const { nome, faturamento, horasAtendimento, nps, notaGoogle, status } = unidade

  // Formata valores em reais
  const formatReal = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Cor do NPS baseado no valor
  const getNPSColor = (valor: number) => {
    if (valor >= 75) return 'text-[#425F1D]' // Verde - Excelente
    if (valor >= 50) return 'text-[#D78B18]' // Dourado - Muito bom
    if (valor >= 0) return 'text-[#392617]' // Terra - Bom
    return 'text-[#7E0000]' // Marsala - Precisa melhorar
  }

  // Cor da nota do Google
  const getGoogleColor = (valor: number) => {
    if (valor >= 4.7) return 'text-[#425F1D]'
    if (valor >= 4.3) return 'text-[#D78B18]'
    if (valor >= 4.0) return 'text-[#392617]'
    return 'text-[#7E0000]'
  }

  if (status === 'sem-dados') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 border border-[#DDC7A4]/30 opacity-60">
        <div className="border-l-4 pl-3" style={{ borderColor: cor }}>
          <h3 className="font-bold text-[#392617] mb-1">{nome}</h3>
          <p className="text-xs text-[#392617]/60">Aguardando configuração</p>
        </div>
        <div className="mt-4 text-center py-8">
          <p className="text-sm text-[#392617]/40">Dados não disponíveis</p>
        </div>
      </div>
    )
  }

  if (status === 'erro') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 border border-[#7E0000]/20">
        <div className="border-l-4 border-[#7E0000]/75 pl-3">
          <h3 className="font-bold text-[#392617] mb-1">{nome}</h3>
          <p className="text-xs text-[#7E0000]">Erro ao carregar dados</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-[#DDC7A4]/30 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="border-l-4 pl-3 mb-4" style={{ borderColor: cor }}>
        <h3 className="font-bold text-[#392617] text-sm">{nome}</h3>
      </div>

      {/* KPIs Grid */}
      <div className="space-y-3">
        {/* Faturamento */}
        <div className="bg-[#F5F0EB] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-[#7E0000]" />
            <span className="text-xs font-semibold text-[#392617]/70 uppercase tracking-wide">
              Faturamento
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[#392617]/60">Total</span>
              <span className="text-sm font-bold text-[#7E0000]">
                {formatReal(faturamento.total)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-[#392617]/50">Caixa</span>
              <span className="text-xs text-[#392617]">
                {formatReal(faturamento.caixa)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-[#392617]/50">Parcerias</span>
              <span className="text-xs text-[#392617]">
                {formatReal(faturamento.parcerias)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-[#392617]/50">Vouchers</span>
              <span className="text-xs text-[#392617]">
                {formatReal(faturamento.voucherSite)}
              </span>
            </div>
          </div>
        </div>

        {/* Horas de Atendimento */}
        <div className="flex items-center justify-between p-2 bg-[#F5F0EB] rounded-lg">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#425F1D]" />
            <span className="text-xs text-[#392617]/70">Horas</span>
          </div>
          <span className="text-sm font-bold text-[#392617]">
            {horasAtendimento.toFixed(1)}h
          </span>
        </div>

        {/* NPS */}
        <div className="flex items-center justify-between p-2 bg-[#F5F0EB] rounded-lg">
          <div className="flex items-center gap-2">
            <ThumbsUp size={14} className="text-[#D78B18]" />
            <span className="text-xs text-[#392617]/70">NPS</span>
          </div>
          <span className={`text-sm font-bold ${getNPSColor(nps)}`}>
            {nps}
          </span>
        </div>

        {/* Google Rating */}
        <div className="flex items-center justify-between p-2 bg-[#F5F0EB] rounded-lg">
          <div className="flex items-center gap-2">
            <Star size={14} className="fill-[#D78B18] text-[#D78B18]" />
            <span className="text-xs text-[#392617]/70">Google</span>
          </div>
          <span className={`text-sm font-bold ${getGoogleColor(notaGoogle)}`}>
            {notaGoogle.toFixed(1)} ★
          </span>
        </div>
      </div>
    </div>
  )
}
