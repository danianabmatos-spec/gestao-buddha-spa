import { cn } from '@/lib/utils'
import type { TerapeutaStats } from '@/lib/belle/types'

interface TerapeutasTableProps {
  dados: TerapeutaStats[]
}

export function TerapeutasTable({ dados }: TerapeutasTableProps) {
  if (!dados.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado disponível</p>
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terapeuta</th>
            <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
            <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atend.</th>
            <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Canc.</th>
            <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Receita Est.</th>
            <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Taxa</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((t, i) => (
            <tr key={t.nome} className={cn('border-b border-border/50 hover:bg-[#F5F0EB] transition-colors', i % 2 === 0 && 'bg-white')}>
              <td className="py-2.5 px-2 font-medium text-[#392617]">
                {primeiroNome(t.nome)}
              </td>
              <td className="py-2.5 px-2 text-center text-muted-foreground">{t.total}</td>
              <td className="py-2.5 px-2 text-center font-semibold text-[#7E0000]">{t.atendidos}</td>
              <td className="py-2.5 px-2 text-center text-muted-foreground hidden sm:table-cell">{t.cancelados}</td>
              <td className="py-2.5 px-2 text-center hidden md:table-cell">
                {t.receita > 0 ? `R$ ${t.receita.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
              </td>
              <td className="py-2.5 px-2 text-center">
                <span className={cn(
                  'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
                  t.taxa >= 80 ? 'bg-[#425F1D]/12 text-[#425F1D]' :
                  t.taxa >= 60 ? 'bg-[#D78B18]/12 text-[#D78B18]' :
                  'bg-[#7E0000]/12 text-[#7E0000]'
                )}>
                  {t.taxa}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function primeiroNome(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(' ')
  if (partes.length <= 2) return nomeCompleto
  return `${partes[0]} ${partes[1]}`
}
