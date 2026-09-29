import { HistoricoChartValor } from './historico-chart-valor'

// Seção "gráfico (70%) + tabela pivotada (30%)" para uma métrica em R$ ao longo dos
// anos (Gympass, TotalPass). Espelha o layout das seções de Caixa/Horas da página.
// Server component — recebe a série já montada de [{mes,ano,valor}].
type ValorData = { mes: string; ano: number; valor: number }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function HistoricoSecaoValor({ titulo, historico }: { titulo: string; historico: ValorData[] }) {
  if (!historico.length) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#392617]/20 p-6">
        <h2 className="text-lg font-semibold text-[#7E0000] mb-2">{titulo}</h2>
        <p className="text-sm text-[#392617]/75">Sem dados de {titulo.replace(' (R$)', '')} no período.</p>
      </div>
    )
  }

  const anos = [...new Set(historico.map(h => h.ano))].sort()

  const dadosPivotados = MESES.map(mes => {
    const valores: Record<number, number | null> = {}
    anos.forEach(ano => {
      const dado = historico.find(h => h.mes === mes && h.ano === ano)
      valores[ano] = dado ? dado.valor : null
    })
    return { mes, valores }
  })

  const totaisPorAno: Record<number, number> = {}
  anos.forEach(ano => {
    totaisPorAno[ano] = historico.filter(h => h.ano === ano).reduce((acc, h) => acc + h.valor, 0)
  })

  return (
    <div className="flex gap-4">
      {/* Gráfico (Esquerda) - 70% */}
      <div className="flex-[7] bg-white rounded-lg shadow-sm border border-[#392617]/20 p-6 min-w-0">
        <h2 className="text-lg font-semibold text-[#7E0000] mb-4">{titulo}</h2>
        <HistoricoChartValor historico={historico} />
      </div>

      {/* Tabela (Direita) - 30% */}
      <div className="flex-[3] bg-white rounded-lg shadow-sm border border-[#392617]/20 p-4 min-w-0">
        <h2 className="text-base font-semibold text-[#7E0000] mb-3">{titulo}</h2>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="border-collapse w-full">
              <thead>
                <tr className="bg-[#2B4C7E] text-white">
                  <th className="px-1.5 py-1.5 text-left text-[10px] font-bold border border-[#392617]/55 whitespace-nowrap">Mês</th>
                  {anos.map(ano => (
                    <th key={ano} className="px-1.5 py-1.5 text-center text-[10px] font-bold border border-[#392617]/55 whitespace-nowrap">{ano}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosPivotados.map((linha, idx) => (
                  <tr key={linha.mes} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#392617]/8'}>
                    <td className="px-1.5 py-0.5 text-[10px] font-medium text-[#392617] border border-[#392617]/35 whitespace-nowrap">{linha.mes}</td>
                    {anos.map(ano => (
                      <td key={ano} className="px-1.5 py-0.5 text-[10px] text-right border border-[#392617]/35 whitespace-nowrap">
                        {linha.valores[ano] !== null ? (
                          <span className="font-medium text-[#392617]">{brl(linha.valores[ano]!)}</span>
                        ) : (
                          <span className="text-[#392617]/55">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-[#2B4C7E] text-white font-bold">
                  <td className="px-1.5 py-1.5 text-[10px] border border-[#392617]/55 whitespace-nowrap">TOTAL</td>
                  {anos.map(ano => (
                    <td key={ano} className="px-1.5 py-1.5 text-[10px] text-right border border-[#392617]/55 whitespace-nowrap">{brl(totaisPorAno[ano])}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
