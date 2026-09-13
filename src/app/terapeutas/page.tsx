'use client'

import { useState, useEffect } from 'react'
import { TerapeutaFidelizacao } from '@/lib/belle/relatorio-fidelizacao'

export default function TerapeutasPage() {
  const [terapeutas, setTerapeutas] = useState<TerapeutaFidelizacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mesSelecionado, setMesSelecionado] = useState('')

  // Inicializa com o mês atual
  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0')
    setMesSelecionado(`${ano}-${mes}`)
  }, [])

  // Busca dados quando o mês estiver definido
  useEffect(() => {
    if (!mesSelecionado) return

    const fetchTerapeutas = async () => {
      try {
        setLoading(true)
        setError(null)

        // Extrai ano e mês do valor selecionado (formato: YYYY-MM)
        const [ano, mes] = mesSelecionado.split('-').map(Number)

        // Calcula o último dia do mês selecionado
        const ultimoDia = new Date(ano, mes, 0).getDate()
        const dataFim = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDia.toString().padStart(2, '0')}`

        // Ajusta dataIni para o início do semestre
        // Se está no 1º semestre (jan-jun), acumula desde janeiro
        // Se está no 2º semestre (jul-dez), acumula desde julho
        const dataIniAjustada = mes <= 6
          ? `${ano}-01-01`
          : `${ano}-07-01`

        const res = await fetch(
          `/api/belle/terapeutas?dataIni=${dataIniAjustada}&dataFim=${dataFim}`
        )
        if (!res.ok) throw new Error('Erro ao carregar dados')
        const data = await res.json()
        setTerapeutas(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    fetchTerapeutas()
  }, [mesSelecionado])

  // Calcula o período de visualização para exibir
  const getPeriodoVisualizacao = () => {
    if (!mesSelecionado) return ''

    const [ano, mes] = mesSelecionado.split('-').map(Number)
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    const mesInicio = mes <= 6 ? 0 : 6 // Janeiro (0) ou Julho (6)
    const mesFim = mes - 1 // Índice do mês selecionado

    return `${meses[mesInicio]} a ${meses[mesFim]} ${ano}`
  }

  // Separa profissionais regulares de banho de imersão
  const profissionaisRegulares = terapeutas.filter(
    t => !t.profissional.toLowerCase().includes('banho')
  )
  const profissionaisBanho = terapeutas.filter(
    t => t.profissional.toLowerCase().includes('banho')
  )

  // Encontra maiores valores para destaque - Regulares
  const maxHorasRegulares = profissionaisRegulares.length > 0
    ? Math.max(...profissionaisRegulares.map(t => t.horasAtendimento))
    : 0
  const maxPercRegulares = profissionaisRegulares.length > 0
    ? Math.max(...profissionaisRegulares.map(t => t.percServicosFidelizados))
    : 0
  const maxNpsRegulares = profissionaisRegulares.length > 0
    ? Math.max(...profissionaisRegulares.map(t => t.nps))
    : 0

  // Encontra maiores valores para destaque - Banho
  const maxHorasBanho = profissionaisBanho.length > 0
    ? Math.max(...profissionaisBanho.map(t => t.horasAtendimento))
    : 0
  const maxPercBanho = profissionaisBanho.length > 0
    ? Math.max(...profissionaisBanho.map(t => t.percServicosFidelizados))
    : 0

  // Calcula subtotais
  const subtotalHorasRegulares = profissionaisRegulares.reduce((sum, t) => sum + t.horasAtendimento, 0)
  const subtotalMediaPercRegulares = profissionaisRegulares.length > 0
    ? profissionaisRegulares.reduce((sum, t) => sum + t.percServicosFidelizados, 0) / profissionaisRegulares.length
    : 0
  const subtotalMediaNpsRegulares = profissionaisRegulares.length > 0
    ? profissionaisRegulares.reduce((sum, t) => sum + t.nps, 0) / profissionaisRegulares.length
    : 0

  const subtotalHorasBanho = profissionaisBanho.reduce((sum, t) => sum + t.horasAtendimento, 0)
  const subtotalMediaPercBanho = profissionaisBanho.length > 0
    ? profissionaisBanho.reduce((sum, t) => sum + t.percServicosFidelizados, 0) / profissionaisBanho.length
    : 0
  const subtotalMediaNpsBanho = profissionaisBanho.length > 0
    ? profissionaisBanho.reduce((sum, t) => sum + t.nps, 0) / profissionaisBanho.length
    : 0

  // Total geral
  const totalHoras = subtotalHorasRegulares + subtotalHorasBanho
  const totalMediaPerc = terapeutas.length > 0
    ? terapeutas.reduce((sum, t) => sum + t.percServicosFidelizados, 0) / terapeutas.length
    : 0
  const totalMediaNps = terapeutas.length > 0
    ? terapeutas.reduce((sum, t) => sum + t.nps, 0) / terapeutas.length
    : 0

  return (
    <div className="min-h-screen bg-[#E4E5E2] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#7E0000] mb-2">Terapeutas</h1>
          <p className="text-[#392617]/70">
            Performance dos profissionais por período
          </p>
        </div>

        {/* Filtros de Período */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-6 items-end">
            <div>
              <label className="block text-sm font-medium text-[#392617] mb-2">
                Selecione o Mês
              </label>
              <input
                type="month"
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="px-4 py-2 border border-[#DDC7A4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D78B18]"
              />
            </div>
            {mesSelecionado && (
              <div className="pb-2">
                <span className="text-sm text-[#392617]/70">Período: </span>
                <span className="text-base font-semibold text-[#7E0000]">
                  {getPeriodoVisualizacao()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[#392617]/70">
              Carregando dados...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-[#7E0000]">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#7E0000] text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Profissional
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Horas de Atendimento
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Nota de Produtividade
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      % Serviços Clientes Fidelizados
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Nota de Fidelização
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      NPS
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Nota de NPS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDC7A4]/30">
                  {/* Profissionais Regulares */}
                  {profissionaisRegulares.map((terapeuta, index) => {
                    const isMaxHoras = terapeuta.horasAtendimento === maxHorasRegulares
                    const isMaxPerc = terapeuta.percServicosFidelizados === maxPercRegulares
                    const isMaxNps = terapeuta.nps === maxNpsRegulares
                    const percMetaHoras = maxHorasRegulares > 0
                      ? (terapeuta.horasAtendimento / maxHorasRegulares) * 10
                      : 0
                    const percMetaFidelizacao = maxPercRegulares > 0
                      ? (terapeuta.percServicosFidelizados / maxPercRegulares) * 10
                      : 0
                    const percMetaNps = maxNpsRegulares > 0
                      ? (terapeuta.nps / maxNpsRegulares) * 10
                      : 0

                    return (
                      <tr
                        key={`regular-${index}`}
                        className="hover:bg-[#DDC7A4]/10 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-[#392617]">
                          {terapeuta.profissional}
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-semibold ${
                          isMaxHoras
                            ? 'bg-[#D78B18] text-white'
                            : 'text-[#392617]'
                        }`}>
                          {terapeuta.horasAtendimento.toFixed(2)}h
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-bold ${
                          percMetaHoras === 10
                            ? 'bg-[#425F1D] text-white'
                            : percMetaHoras >= 8
                            ? 'text-[#425F1D]'
                            : percMetaHoras >= 6
                            ? 'text-[#D78B18]'
                            : 'text-[#7E0000]'
                        }`}>
                          {percMetaHoras.toFixed(1)}
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-semibold ${
                          isMaxPerc
                            ? 'bg-[#D78B18] text-white'
                            : 'text-[#392617]'
                        }`}>
                          {terapeuta.percServicosFidelizados.toFixed(2)}%
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-bold ${
                          percMetaFidelizacao === 10
                            ? 'bg-[#425F1D] text-white'
                            : percMetaFidelizacao >= 8
                            ? 'text-[#425F1D]'
                            : percMetaFidelizacao >= 6
                            ? 'text-[#D78B18]'
                            : 'text-[#7E0000]'
                        }`}>
                          {percMetaFidelizacao.toFixed(1)}
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-semibold ${
                          isMaxNps
                            ? 'bg-[#D78B18] text-white'
                            : 'text-[#392617]'
                        }`}>
                          {terapeuta.nps.toFixed(2)}%
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-bold ${
                          percMetaNps === 10
                            ? 'bg-[#425F1D] text-white'
                            : percMetaNps >= 8
                            ? 'text-[#425F1D]'
                            : percMetaNps >= 6
                            ? 'text-[#D78B18]'
                            : 'text-[#7E0000]'
                        }`}>
                          {percMetaNps.toFixed(1)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Subtotal Profissionais Regulares */}
                  {profissionaisRegulares.length > 0 && (
                    <tr className="bg-[#DDC7A4]/20 font-semibold">
                      <td className="px-6 py-4 text-sm text-[#7E0000]">
                        SUBTOTAL TERAPEUTAS
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        {subtotalHorasRegulares.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        -
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        {subtotalMediaPercRegulares.toFixed(2)}% (média)
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        -
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        {subtotalMediaNpsRegulares.toFixed(2)}% (média)
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        -
                      </td>
                    </tr>
                  )}

                  {/* Profissionais Banho de Imersão */}
                  {profissionaisBanho.map((terapeuta, index) => (
                    <tr
                      key={`banho-${index}`}
                      className="hover:bg-[#DDC7A4]/10 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-[#392617]">
                        {terapeuta.profissional}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#392617] text-right">
                        {terapeuta.horasAtendimento.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-sm text-[#392617]/40 text-right">
                        -
                      </td>
                      <td className="px-6 py-4 text-sm text-[#392617] text-right">
                        {terapeuta.percServicosFidelizados.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-[#392617]/40 text-right">
                        -
                      </td>
                      <td className="px-6 py-4 text-sm text-[#392617] text-right">
                        {terapeuta.nps.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-[#392617]/40 text-right">
                        -
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal Banho de Imersão */}
                  {profissionaisBanho.length > 0 && (
                    <tr className="bg-[#DDC7A4]/20 font-semibold">
                      <td className="px-6 py-4 text-sm text-[#7E0000]">
                        SUBTOTAL BANHO DE IMERSÃO
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        {subtotalHorasBanho.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        -
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        {subtotalMediaPercBanho.toFixed(2)}% (média)
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        -
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        {subtotalMediaNpsBanho.toFixed(2)}% (média)
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7E0000] text-right">
                        -
                      </td>
                    </tr>
                  )}

                  {/* Total Geral */}
                  <tr className="bg-[#7E0000] text-white font-bold">
                    <td className="px-6 py-4 text-sm">
                      TOTAL GERAL
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {totalHoras.toFixed(2)}h
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      -
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {totalMediaPerc.toFixed(2)}% (média)
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      -
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {totalMediaNps.toFixed(2)}% (média)
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      -
                    </td>
                  </tr>
                </tbody>
              </table>

              {terapeutas.length === 0 && (
                <div className="p-8 text-center text-[#392617]/70">
                  Nenhum terapeuta encontrado para o período selecionado.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
