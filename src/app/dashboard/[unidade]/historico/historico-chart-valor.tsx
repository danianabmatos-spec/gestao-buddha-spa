'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ValorData {
  mes: string
  ano: number
  valor: number
}

interface HistoricoChartValorProps {
  historico: ValorData[]
}

// Regressão linear (mínimos quadrados) sobre os pontos com valor. Retorna um array
// do tamanho de `pontos` com o valor da reta em cada mês do intervalo com dado, e
// null fora dele (não projeta sobre meses vazios).
function calcularTendencia(pontos: Array<{ x: number; y: number | null }>): Array<number | null> {
  const validos = pontos.filter((p): p is { x: number; y: number } => p.y !== null && p.y > 0)
  const resultado: Array<number | null> = pontos.map(() => null)
  if (validos.length < 2) return resultado

  const n = validos.length
  const sx = validos.reduce((s, p) => s + p.x, 0)
  const sy = validos.reduce((s, p) => s + p.y, 0)
  const sxx = validos.reduce((s, p) => s + p.x * p.x, 0)
  const sxy = validos.reduce((s, p) => s + p.x * p.y, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return resultado
  const b = (n * sxy - sx * sy) / denom
  const a = (sy - b * sx) / n

  const xMin = validos[0].x
  const xMax = validos[validos.length - 1].x
  return pontos.map(p => (p.x >= xMin && p.x <= xMax ? a + b * p.x : null))
}

// Gráfico de linha de um valor em R$ ao longo dos anos (uma linha por ano). Genérico:
// usado por Gympass e TotalPass. Segue a estética do HistoricoChart (caixa): ano
// corrente em preto + linha de tendência tracejada, eixo Y em R$.
export function HistoricoChartValor({ historico }: HistoricoChartValorProps) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const anos = [...new Set(historico.map(h => h.ano))].sort()
  const anoCorrente = new Date().getFullYear()

  // Linha de tendência (regressão) do ano corrente, só no intervalo com dado.
  const tendencia = calcularTendencia(meses.map((mes, i) => ({
    x: i,
    y: historico.find(h => h.mes === mes && h.ano === anoCorrente)?.valor ?? null,
  })))

  const chartData = meses.map((mes, i) => {
    const dataPoint: Record<string, number | string | null> = { mes, tendencia: tendencia[i] }
    anos.forEach(ano => {
      dataPoint[`${ano}`] = historico.find(h => h.mes === mes && h.ano === ano)?.valor || null
    })
    return dataPoint
  })

  const todosValores = historico.map(h => h.valor).filter(v => v > 0)
  const valorMinimo = todosValores.length ? Math.min(...todosValores) : 0
  const valorMaximo = todosValores.length ? Math.max(...todosValores) : 0
  const padding = (valorMaximo - valorMinimo) * 0.1
  const yMin = Math.max(0, Math.floor((valorMinimo - padding) / 1000) * 1000)
  const yMax = Math.ceil((valorMaximo + padding) / 1000) * 1000

  const cores = ['#DC2626', '#2563EB', '#16A34A', '#EA580C', '#9333EA', '#0891B2']
  const corDoAno = (ano: number, index: number) => (ano === anoCorrente ? '#000000' : cores[index % cores.length])

  const formatarValor = (value: number) => {
    if (value === null || value === undefined) return '-'
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | null; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-[#392617]/35 rounded shadow-lg">
          <p className="font-semibold text-[#392617] mb-2">{label}</p>
          {payload.map((entry, index) => (
            entry.value !== null && (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {entry.name}: {formatarValor(entry.value)}
              </p>
            )
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          domain={[yMin, yMax]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }} />
        {anos.map((ano, index) => (
          <Line
            key={ano}
            type="monotone"
            dataKey={`${ano}`}
            name={`${ano}`}
            stroke={corDoAno(ano, index)}
            strokeWidth={3}
            dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 7 }}
            connectNulls={false}
          />
        ))}
        <Line
          type="linear"
          dataKey="tendencia"
          name={`Tendência ${anoCorrente}`}
          stroke="#000000"
          strokeWidth={2}
          strokeDasharray="6 6"
          strokeOpacity={0.55}
          dot={false}
          activeDot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
