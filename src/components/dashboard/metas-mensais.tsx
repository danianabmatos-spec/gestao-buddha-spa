'use client'

import { Target, Clock, ShoppingBag, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetaItem {
  label: string
  atual: number
  meta: number
  premio: number
  icon: React.ElementType
  formato: 'moeda' | 'horas'
  cor: string
}

interface MetasMensaisProps {
  faturamentoAtual: number
  metaFaturamento: number
  premioFaturamento: number
  horasAtual: number
  metaHoras: number
  premioHoras: number
  vendasAtual: number
  metaVendas: number
  premioVendas: number
  mes: string // ex: "Junho 2026"
}

function fmt(v: number, formato: 'moeda' | 'horas') {
  if (formato === 'horas') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}h`
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function BarraMeta({ item }: { item: MetaItem }) {
  const pct = Math.min(Math.round((item.atual / item.meta) * 100), 100)
  const bateu = item.atual >= item.meta
  const Icon = item.icon

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded', item.cor)}>
            <Icon size={14} strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-[#392617]">{item.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {bateu && (
            <span className="flex items-center gap-1 text-xs font-semibold text-[#425F1D] bg-[#425F1D]/8 px-2 py-0.5 rounded-full">
              <Trophy size={11} /> Meta batida!
            </span>
          )}
          <span className="text-xs font-bold text-[#7E0000]">{pct}%</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-2.5 bg-[#E4E5E2] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            bateu ? 'bg-[#425F1D]/75' : pct >= 70 ? 'bg-[#D78B18]' : 'bg-[#7E0000]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Valores */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-[#392617]">{fmt(item.atual, item.formato)}</span>
          {' '}de {fmt(item.meta, item.formato)}
        </span>
        <span>
          Faltam: <span className="font-medium">{fmt(Math.max(item.meta - item.atual, 0), item.formato)}</span>
        </span>
      </div>

      {/* Prêmio (se configurado) */}
      {item.premio > 0 && (
        <div className={cn(
          'flex items-center justify-between rounded-lg px-3 py-1.5 text-xs',
          bateu ? 'bg-[#425F1D]/8 text-[#425F1D]' : 'bg-[#F5F0EB] text-[#7a6a5a]'
        )}>
          <span>🏆 Prêmio pelo atingimento</span>
          <span className="font-bold">{fmt(item.premio, 'moeda')}</span>
        </div>
      )}
    </div>
  )
}

export function MetasMensais({
  faturamentoAtual, metaFaturamento, premioFaturamento,
  horasAtual, metaHoras, premioHoras,
  vendasAtual, metaVendas, premioVendas,
  mes,
}: MetasMensaisProps) {
  const itens: MetaItem[] = [
    {
      label: 'Faturamento',
      atual: faturamentoAtual,
      meta: metaFaturamento,
      premio: premioFaturamento,
      icon: Target,
      formato: 'moeda',
      cor: 'bg-[#7E0000]/10 text-[#7E0000]',
    },
    {
      label: 'Horas de Atendimento',
      atual: horasAtual,
      meta: metaHoras,
      premio: premioHoras,
      icon: Clock,
      formato: 'horas',
      cor: 'bg-[#D78B18]/10 text-[#D78B18]',
    },
    {
      label: 'Vendas da Recepção',
      atual: vendasAtual,
      meta: metaVendas,
      premio: premioVendas,
      icon: ShoppingBag,
      formato: 'moeda',
      cor: 'bg-[#425F1D]/10 text-[#425F1D]',
    },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
          Metas do Mês
        </h2>
        <span className="text-xs font-medium text-muted-foreground bg-[#F5F0EB] px-2 py-1 rounded">
          {mes} — acumulado
        </span>
      </div>
      <div className="space-y-5">
        {itens.map(item => <BarraMeta key={item.label} item={item} />)}
      </div>
    </div>
  )
}
