'use client'

import { DollarSign, Users, ShoppingBag, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FaturamentoCategoriasProps {
  caixa: number
  totalPass: number
  gympass: number
  voucherSite?: number
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const categorias = (data: FaturamentoCategoriasProps) => [
  {
    label: 'Recebido em Caixa',
    valor: data.caixa,
    icon: DollarSign,
    cor: 'bg-[#7E0000]/10 text-[#7E0000] border-[#7E0000]',
    desc: 'Dinheiro, Pix, Cartões',
  },
  {
    label: 'Total Pass',
    valor: data.totalPass,
    icon: Users,
    cor: 'bg-[#425F1D]/10 text-[#425F1D] border-[#425F1D]',
    desc: 'Parceria comercial',
  },
  {
    label: 'Gympass',
    valor: data.gympass,
    icon: Users,
    cor: 'bg-[#D78B18]/10 text-[#D78B18] border-[#D78B18]',
    desc: 'Parceria comercial',
  },
  {
    label: 'Voucher Site',
    valor: data.voucherSite ?? null,
    icon: Ticket,
    cor: 'bg-[#392617]/10 text-[#392617] border-[#392617]',
    desc: 'E-commerce',
    pendente: data.voucherSite === undefined,
  },
]

export function FaturamentoCategorias(props: FaturamentoCategoriasProps) {
  const total = props.caixa + props.totalPass + props.gympass + (props.voucherSite ?? 0)

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
          Faturamento por Categoria
        </h2>
        <span className="text-xs text-muted-foreground">
          Total: <span className="font-semibold text-[#392617]">{fmt(total)}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categorias(props).map(({ label, valor, icon: Icon, cor, desc, pendente }) => (
          <div
            key={label}
            className={cn('rounded-lg border-l-4 p-3', cor.replace('text-', 'border-').replace('bg-', ''))}
            style={{ borderLeftColor: cor.match(/border-\[(.+?)\]/)?.[1] }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn('p-1.5 rounded', cor.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' '))}>
                <Icon size={14} strokeWidth={2} />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                {label}
              </span>
            </div>
            {pendente ? (
              <p className="text-sm text-muted-foreground italic">Em breve</p>
            ) : (
              <p className="text-lg font-bold text-[#392617]">{fmt(valor ?? 0)}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
