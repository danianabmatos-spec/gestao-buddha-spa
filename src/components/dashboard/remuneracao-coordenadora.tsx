'use client'

import { cn } from '@/lib/utils'
import {
  FIXO_COORDENADORA,
  BONIF_COORD_FATURAMENTO,
  BONIF_COORD_HORAS,
  getFaixaCoord,
  calcPct,
  type FaixaBonificacao,
} from '@/config/metas'

interface RemuneracaoCoordProps {
  faturamentoAtual: number
  metaFaturamento: number
  horasAtual: number
  metaHoras: number
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const COR_FAIXA: Record<string, string> = {
  '< 90%':    'bg-[#392617]/12 text-[#392617]/55 border-[#392617]/20',
  '90–99%':   'bg-[#D78B18]/8 text-[#D78B18] border-[#D78B18]/20',
  '100–109%': 'bg-[#425F1D]/8 text-[#425F1D] border-[#425F1D]/20',
  '110–119%': 'bg-[#425F1D]/8 text-[#425F1D] border-[#425F1D]/20',
  '≥ 120%':   'bg-[#425F1D]/10 text-[#425F1D] border-[#425F1D]/30',
}

const COR_ATIVA: Record<string, string> = {
  '< 90%':    'bg-[#392617]/20 text-[#392617] border-[#392617]/55 ring-2 ring-[#392617]/35',
  '90–99%':   'bg-[#D78B18]/12 text-[#D78B18] border-[#D78B18]/55 ring-2 ring-[#D78B18]/35',
  '100–109%': 'bg-[#425F1D]/12 text-[#425F1D] border-[#425F1D]/75 ring-2 ring-[#425F1D]/35',
  '110–119%': 'bg-[#425F1D]/12 text-[#425F1D] border-[#425F1D]/75 ring-2 ring-[#425F1D]/35',
  '≥ 120%':   'bg-[#425F1D]/20 text-[#425F1D] border-[#425F1D] ring-2 ring-[#425F1D]/40',
}

function BandasMeta({
  faixas,
  pctAtual,
  titulo,
  cor,
}: {
  faixas: FaixaBonificacao[]
  pctAtual: number
  titulo: string
  cor: string
}) {
  const faixaAtiva = getFaixaCoord(faixas, pctAtual)
  const bonusAtivo = faixaAtiva.valor

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#392617]">{titulo}</span>
        <span className={cn('text-sm font-bold px-2 py-0.5 rounded-full', cor)}>
          {pctAtual}% atingido
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 bg-[#E4E5E2] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', cor.includes('green') ? 'bg-[#425F1D]/75' : cor.includes('yellow') ? 'bg-[#D78B18]' : 'bg-[#7E0000]')}
          style={{ width: `${Math.min(pctAtual, 120)}%`, maxWidth: '100%' }}
        />
      </div>

      {/* Faixas de bonificação */}
      <div className="grid grid-cols-5 gap-1 mt-2">
        {faixas.map((f) => {
          const ativa = f.label === faixaAtiva.label
          return (
            <div
              key={f.label}
              className={cn(
                'rounded-lg border px-1.5 py-2 text-center transition-all',
                ativa ? COR_ATIVA[f.label] : COR_FAIXA[f.label]
              )}
            >
              <p className="text-[10px] font-semibold leading-tight">{f.label}</p>
              <p className="text-xs font-bold mt-0.5">
                {f.valor === 0 ? '—' : fmt(f.valor)}
              </p>
              {ativa && <p className="text-[9px] mt-0.5 font-medium">← atual</p>}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-right text-muted-foreground">
        Bônus variável atual:{' '}
        <span className="font-semibold text-[#392617]">{fmt(bonusAtivo)}</span>
      </p>
    </div>
  )
}

export function RemuneracaoCoordenadora({
  faturamentoAtual,
  metaFaturamento,
  horasAtual,
  metaHoras,
}: RemuneracaoCoordProps) {
  const pctFat = calcPct(faturamentoAtual, metaFaturamento)
  const pctHoras = calcPct(horasAtual, metaHoras)

  const bonusFat = getFaixaCoord(BONIF_COORD_FATURAMENTO, pctFat).valor
  const bonusHoras = getFaixaCoord(BONIF_COORD_HORAS, pctHoras).valor
  const totalEstimado = FIXO_COORDENADORA + bonusFat + bonusHoras
  const totalMaximo = FIXO_COORDENADORA + 1800 + 1200

  const corPct = (pct: number) =>
    pct >= 120 ? 'bg-[#425F1D]/10 text-[#425F1D]' :
    pct >= 100 ? 'bg-[#425F1D]/8 text-[#425F1D]' :
    pct >= 90  ? 'bg-[#D78B18]/8 text-[#D78B18]' :
    'bg-[#392617]/12 text-[#392617]/75'

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
            Remuneração — Coordenadora
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Faixas variáveis por atingimento</p>
        </div>
        {/* Card de remuneração estimada */}
        <div className="text-right bg-[#F5F0EB] rounded-lg px-3 py-2 min-w-[140px]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estimativa do mês</p>
          <p className="text-xl font-bold text-[#7E0000]">{fmt(totalEstimado)}</p>
          <p className="text-[10px] text-muted-foreground">de {fmt(totalMaximo)} possível</p>
        </div>
      </div>

      {/* Resumo fixo */}
      <div className="flex gap-2 mb-5">
        <div className="flex-1 bg-[#F5F0EB] rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fixo (PJ)</p>
          <p className="text-sm font-bold text-[#392617]">{fmt(FIXO_COORDENADORA)}</p>
        </div>
        <div className="flex-1 bg-[#425F1D]/8 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Variável Faturamento</p>
          <p className="text-sm font-bold text-[#425F1D]">{fmt(bonusFat)}</p>
        </div>
        <div className="flex-1 bg-[#D78B18]/8 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Variável Horas</p>
          <p className="text-sm font-bold text-[#D78B18]">{fmt(bonusHoras)}</p>
        </div>
      </div>

      <div className="space-y-5">
        <BandasMeta
          faixas={BONIF_COORD_FATURAMENTO}
          pctAtual={pctFat}
          titulo="Faturamento"
          cor={corPct(pctFat)}
        />
        <div className="border-t border-border" />
        <BandasMeta
          faixas={BONIF_COORD_HORAS}
          pctAtual={pctHoras}
          titulo="Horas de Atendimento"
          cor={corPct(pctHoras)}
        />
      </div>
    </div>
  )
}
