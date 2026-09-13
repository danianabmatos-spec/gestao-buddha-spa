import { Ticket, CreditCard, Package, DollarSign } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface CaixaDiario {
  data: string
  valor: number
}

interface VendasRecepcaoProps {
  vouchers: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  planos: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  produtos: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  total: {
    quantidade: number
    valorBruto: number
    valorLiquido: number
  }
  caixa?: number // Total recebido em caixa para calcular %
  caixaDiario?: CaixaDiario[] // Dados diários do caixa para gráfico
}

export function VendasRecepcao({ vouchers, planos, produtos, total, caixa, caixaDiario }: VendasRecepcaoProps) {
  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const calcularPercentual = (valor: number, total: number) => {
    if (total === 0) return '0,0%'
    return ((valor / total) * 100).toFixed(1).replace('.', ',') + '%'
  }

  const calcularTicketMedio = (valorLiquido: number, quantidade: number) => {
    if (quantidade === 0) return 'R$ 0,00'
    return formatarValor(valorLiquido / quantidade)
  }

  const items = [
    {
      label: 'Vouchers',
      icon: Ticket,
      quantidade: vouchers.quantidade,
      valorLiquido: vouchers.valorLiquido,
      iconColor: 'text-[#7E0000]',
      iconBg: 'bg-[#7E0000]/10',
      chartColor: '#7E0000', // marsala
    },
    {
      label: 'Planos',
      icon: CreditCard,
      quantidade: planos.quantidade,
      valorLiquido: planos.valorLiquido,
      iconColor: 'text-[#425F1D]',
      iconBg: 'bg-[#425F1D]/12',
      chartColor: '#425F1D', // flora
    },
    {
      label: 'Produtos',
      icon: Package,
      quantidade: produtos.quantidade,
      valorLiquido: produtos.valorLiquido,
      iconColor: 'text-[#8B6914]',
      iconBg: 'bg-[#D78B18]/15',
      chartColor: '#D78B18', // dourado
    },
  ].sort((a, b) => b.valorLiquido - a.valorLiquido) // Ordenar por valor decrescente

  // Dados do gráfico de pizza
  const servicosAvulsos = caixa ? caixa - total.valorLiquido : 0
  const chartData = [
    { name: 'Vouchers', value: vouchers.valorLiquido, color: '#7E0000' },
    { name: 'Planos', value: planos.valorLiquido, color: '#425F1D' },
    { name: 'Produtos', value: produtos.valorLiquido, color: '#D78B18' },
    { name: 'Serviços Avulsos', value: servicosAvulsos > 0 ? servicosAvulsos : 0, color: '#8a5a3c' },
  ].filter(item => item.value > 0) // Remove itens com valor zero

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-[#392617]/20">
          <p className="text-xs font-semibold text-[#392617]">{payload[0].name}</p>
          <p className="text-sm font-bold text-[#392617] mt-1">
            {formatarValor(payload[0].value)}
          </p>
          <p className="text-xs text-[#392617] mt-0.5">
            {calcularPercentual(payload[0].value, caixa || total.valorLiquido)}
          </p>
        </div>
      )
    }
    return null
  }

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-[#392617]/20">
          <p className="text-xs font-semibold text-[#392617]">{payload[0].payload.data}</p>
          <p className="text-sm font-bold text-[#7E0000] mt-1">
            {formatarValor(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex gap-6 items-start overflow-x-auto">
      {/* Tabela */}
      <div className="bg-white rounded-xl border border-[#392617]/20 overflow-hidden flex-shrink-0">
        <table className="table-auto">
        <thead>
          <tr className="bg-[#392617]/8 border-b border-[#392617]/20">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#392617] uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-[#392617] uppercase tracking-wider">
              Qtd
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#392617] uppercase tracking-wider">
              Valor Líquido
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#392617] uppercase tracking-wider">
              Ticket Médio
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-[#392617] uppercase tracking-wider">
              %
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#392617]/20">
          {items.map((item) => {
            const Icon = item.icon
            const participacao = calcularPercentual(item.valorLiquido, total.valorLiquido)
            const ticketMedio = calcularTicketMedio(item.valorLiquido, item.quantidade)
            return (
              <tr key={item.label} className="hover:bg-[#392617]/8 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <div className={`${item.iconBg} p-1.5 rounded-lg`}>
                      <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium text-[#392617]">
                      {item.label}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold text-[#392617]">
                    {item.quantidade}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="text-sm font-semibold text-[#392617]">
                    {formatarValor(item.valorLiquido)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="text-sm font-medium text-[#8B6914]">
                    {ticketMedio}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-medium text-[#392617]">
                    {participacao}
                  </span>
                </td>
              </tr>
            )
          })}

          {/* Linha de Total */}
          <tr className="bg-gradient-to-r from-[#7E0000] to-[#5c0000] text-white">
            <td className="px-4 py-3">
              <span className="text-sm font-bold uppercase tracking-wide">
                Total
              </span>
            </td>
            <td className="px-3 py-3 text-center">
              <span className="text-base font-bold">
                {total.quantidade}
              </span>
            </td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              <span className="text-base font-bold">
                {formatarValor(total.valorLiquido)}
              </span>
            </td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              <span className="text-base font-bold">
                {calcularTicketMedio(total.valorLiquido, total.quantidade)}
              </span>
            </td>
            <td className="px-3 py-3 text-center">
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold whitespace-nowrap">
                  {caixa ? calcularPercentual(total.valorLiquido, caixa) : '—'}
                </span>
                {caixa && (
                  <span className="text-[10px] text-white/70">
                    do caixa
                  </span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* Gráfico de Pizza */}
      {caixa && caixa > 0 && (
        <div className="bg-white rounded-xl border border-[#392617]/20 p-6 flex flex-col flex-shrink-0 w-[420px]">
          <h3 className="text-sm font-semibold text-[#392617] mb-2">
            Composição do Caixa
          </h3>
          <p className="text-xs text-[#392617]/75 mb-4">
            Total: {formatarValor(caixa)}
          </p>

          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={50}
                  iconSize={12}
                  formatter={(value) => <span className="text-xs text-[#392617]">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Gráfico de Barras - Caixa Diário */}
      {caixaDiario && caixaDiario.length > 0 && (
        <div className="bg-white rounded-xl border border-[#392617]/20 p-6 flex flex-col flex-shrink-0 w-[500px]">
          <h3 className="text-sm font-semibold text-[#392617] mb-2">
            Evolução Diária do Caixa
          </h3>
          <p className="text-xs text-[#392617]/75 mb-4">
            Período: {caixaDiario.length} dias
          </p>

          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caixaDiario} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="data"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  stroke="#9ca3af"
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar
                  dataKey="valor"
                  fill="#7E0000"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
