'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface HistoricoData {
  mes: string
  ano: number
  horas: number
}

interface HistoricoChartHorasProps {
  historico: HistoricoData[]
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

export function HistoricoChartHoras({ historico }: HistoricoChartHorasProps) {
  // Agrupar dados por mês para criar série temporal
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const anos = [...new Set(historico.map(h => h.ano))].sort()

  // Linha de tendência (regressão linear) do ano corrente (2026), só no intervalo
  // de meses que têm dado — evita projetar sobre meses vazios.
  const tendencia = calcularTendencia(meses.map((mes, i) => ({
    x: i,
    y: historico.find(h => h.mes === mes && h.ano === 2026)?.horas ?? null,
  })))

  // Preparar dados para o gráfico: cada ponto é um mês, com valores para cada ano
  const chartData = meses.map((mes, i) => {
    const dataPoint: any = { mes, tendencia: tendencia[i] }
    anos.forEach(ano => {
      const valor = historico.find(h => h.mes === mes && h.ano === ano)?.horas || null
      dataPoint[`${ano}`] = valor
    })
    return dataPoint
  })

  // Calcular valores min/max para ajustar escala do gráfico
  const todosValores = historico.map(h => h.horas).filter(v => v > 0)
  const valorMinimo = Math.min(...todosValores)
  const valorMaximo = Math.max(...todosValores)

  // Adicionar 10% de padding para melhor visualização
  const padding = (valorMaximo - valorMinimo) * 0.1
  const yMin = Math.max(0, Math.floor((valorMinimo - padding) / 100) * 100)
  const yMax = Math.ceil((valorMaximo + padding) / 100) * 100

  // Cores contrastantes para cada ano (otimizadas para análise)
  const cores = [
    '#DC2626', // Vermelho forte (2023)
    '#2563EB', // Azul forte (2024)
    '#16A34A', // Verde forte (2025)
    '#EA580C', // Laranja forte
    '#9333EA', // Roxo forte (se houver mais anos)
  ]
  // O ano corrente (2026) fica PRETO para destacar/facilitar a leitura.
  const corDoAno = (ano: number, index: number) => (ano === 2026 ? '#000000' : cores[index % cores.length])

  // Formatter para valores em horas
  const formatarValor = (value: number) => {
    if (value === null || value === undefined) return '-'
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-[#392617]/35 rounded shadow-lg">
          <p className="font-semibold text-[#392617] mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
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
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="mes"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `${(value).toFixed(0)}h`}
          domain={[yMin, yMax]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
        />
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
        {/* Linha de tendência (2026) — tracejada */}
        <Line
          type="linear"
          dataKey="tendencia"
          name="Tendência 2026"
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
