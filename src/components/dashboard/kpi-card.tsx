import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  titulo: string
  valor: string | number
  icon: LucideIcon
  cor?: 'marsala' | 'dourado' | 'flora' | 'terra' | 'neutro'
  tendencia?: 'up' | 'down' | 'neutro'
  descricao?: string
}

const cores = {
  marsala: 'border-l-[#7E0000] bg-white',
  dourado: 'border-l-[#D78B18] bg-white',
  flora: 'border-l-[#425F1D] bg-white',
  terra: 'border-l-[#392617] bg-white',
  neutro: 'border-l-[#DDC7A4] bg-white',
}

const iconCores = {
  marsala: 'bg-[#7E0000]/10 text-[#7E0000]',
  dourado: 'bg-[#D78B18]/10 text-[#D78B18]',
  flora: 'bg-[#425F1D]/10 text-[#425F1D]',
  terra: 'bg-[#392617]/10 text-[#392617]',
  neutro: 'bg-[#DDC7A4]/30 text-[#392617]',
}

export function KpiCard({ titulo, valor, icon: Icon, cor = 'neutro', tendencia, descricao }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border-l-4 shadow-sm p-4 md:p-5', cores[cor])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{titulo}</p>
          <p className="text-2xl md:text-3xl font-bold text-[#392617] mt-1 leading-none">{valor}</p>
          {descricao && <p className="text-xs text-muted-foreground mt-1.5">{descricao}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg shrink-0', iconCores[cor])}>
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>
      {tendencia && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {tendencia === 'up' && <TrendingUp size={13} className="text-[#425F1D]" />}
          {tendencia === 'down' && <TrendingDown size={13} className="text-[#7E0000]" />}
          {tendencia === 'neutro' && <Minus size={13} className="text-[#392617]/55" />}
        </div>
      )}
    </div>
  )
}
