'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { AgendamentoPorHora } from '@/lib/belle/types'

interface AgendamentosChartProps {
  dados: AgendamentoPorHora[]
}

export function AgendamentosChart({ dados }: AgendamentosChartProps) {
  if (!dados.length) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0d5c8" />
        <XAxis dataKey="hora" tick={{ fontSize: 11, fill: '#7a6a5a' }} />
        <YAxis tick={{ fontSize: 11, fill: '#7a6a5a' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e0d5c8', fontSize: 12 }}
          cursor={{ fill: '#DDC7A4', fillOpacity: 0.3 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="total" name="Agendados" fill="#DDC7A4" radius={[3, 3, 0, 0]} />
        <Bar dataKey="atendidos" name="Atendidos" fill="#7E0000" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
