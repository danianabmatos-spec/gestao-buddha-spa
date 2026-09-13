'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const STATUS_CORES: Record<string, string> = {
  Atendido: '#7E0000',
  Confirmado: '#425F1D',
  Aguardando: '#D78B18',
  Marcado: '#DDC7A4',
  Cancelado: '#9e9e9e',
  Faltou: '#c62828',
}

interface StatusDonutProps {
  dados: { status: string; count: number }[]
}

export function StatusDonut({ dados }: StatusDonutProps) {
  if (!dados.length) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={2}
        >
          {dados.map((entry) => (
            <Cell key={entry.status} fill={STATUS_CORES[entry.status] ?? '#bbb'} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e0d5c8', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
