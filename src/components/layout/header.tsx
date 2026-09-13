'use client'

import { RefreshCw } from 'lucide-react'
import { format, startOfMonth, startOfWeek, subDays, startOfYear, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  dataIni: Date
  dataFim: Date
  unidade: string
  loading?: boolean
  onPeriodoChange: (ini: Date, fim: Date) => void
  onRefresh: () => void
}

const ATALHOS = [
  { label: 'Hoje',        getRange: () => { const h = new Date(); return [h, h] as [Date, Date] } },
  { label: 'Esta semana', getRange: () => [startOfWeek(new Date(), { weekStartsOn: 1 }), new Date()] as [Date, Date] },
  { label: 'Este mês',    getRange: () => [startOfMonth(new Date()), new Date()] as [Date, Date] }
]

export function Header({ dataIni, dataFim, unidade, loading, onPeriodoChange, onRefresh }: HeaderProps) {
  const iniStr = format(dataIni, 'yyyy-MM-dd')
  const fimStr = format(dataFim, 'yyyy-MM-dd')

  const periodoLabel = () => {
    const ini = format(dataIni, "dd/MM/yyyy")
    const fim = format(dataFim, "dd/MM/yyyy")
    if (ini === fim) return format(dataIni, "dd 'de' MMMM", { locale: ptBR })
    if (format(dataIni, 'MM/yyyy') === format(dataFim, 'MM/yyyy'))
      return `${format(dataIni, 'dd')} a ${format(dataFim, "dd 'de' MMMM", { locale: ptBR })}`
    return `${ini} a ${fim}`
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border px-4 md:px-6 py-3 space-y-2">
      {/* Linha 1: título + unidade + atualizar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#392617]">{periodoLabel()}</span>
          {loading && <RefreshCw size={13} className="animate-spin text-[#7E0000]" />}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Unidade:</span>
            <span className="text-xs font-semibold text-[#392617]">{unidade}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5 text-[#7E0000] h-7 text-xs">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Linha 2: inputs de data + atalhos */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Inputs */}
        <div className="flex items-center gap-1.5 bg-[#F5F0EB] rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">De</span>
          <input
            type="date"
            value={iniStr}
            max={fimStr}
            onChange={e => {
              const novaIni = new Date(e.target.value + 'T00:00:00')
              if (!isNaN(novaIni.getTime())) onPeriodoChange(novaIni, dataFim)
            }}
            className="text-xs font-semibold text-[#392617] bg-transparent border-none outline-none cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-[#F5F0EB] rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Até</span>
          <input
            type="date"
            value={fimStr}
            min={iniStr}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={e => {
              const novaFim = new Date(e.target.value + 'T00:00:00')
              if (!isNaN(novaFim.getTime())) onPeriodoChange(dataIni, novaFim)
            }}
            className="text-xs font-semibold text-[#392617] bg-transparent border-none outline-none cursor-pointer"
          />
        </div>

        {/* Atalhos */}
        <div className="flex gap-1 flex-wrap">
          {ATALHOS.map(({ label, getRange }) => {
            const [ini, fim] = getRange()
            const ativo = format(ini, 'yyyy-MM-dd') === iniStr && format(fim, 'yyyy-MM-dd') === fimStr
            return (
              <button
                key={label}
                onClick={() => onPeriodoChange(ini, fim)}
                className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                  ativo
                    ? 'bg-[#7E0000] text-white'
                    : 'bg-[#F5F0EB] text-[#392617] hover:bg-[#DDC7A4]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
