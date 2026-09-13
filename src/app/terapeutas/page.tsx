'use client'

import { useState, useEffect } from 'react'
import { TerapeutaFidelizacao } from '@/lib/belle/relatorio-fidelizacao'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Último mês FECHADO (o mês atual em curso não é considerado nos indicadores).
function ultimoMesFechado(): { ano: number; mes: number } {
  const hoje = new Date()
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 0) // dia 0 do mês atual = último dia do mês anterior
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

export default function TerapeutasPage() {
  const [terapeutas, setTerapeutas] = useState<TerapeutaFidelizacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mesSelecionado, setMesSelecionado] = useState('')

  const fechado = ultimoMesFechado()
  const maxMes = `${fechado.ano}-${String(fechado.mes).padStart(2, '0')}`
  const mesAtualNome = MESES[new Date().getMonth()]

  // Inicializa no último mês fechado (não no mês atual em curso).
  useEffect(() => {
    setMesSelecionado(maxMes)
  }, [maxMes])

  useEffect(() => {
    if (!mesSelecionado) return

    const fetchTerapeutas = async () => {
      try {
        setLoading(true)
        setError(null)

        const [ano, mes] = mesSelecionado.split('-').map(Number)

        // Não considera o mês em curso: limita o fim ao último mês fechado.
        const anoEfetivo = (ano > fechado.ano || (ano === fechado.ano && mes > fechado.mes)) ? fechado.ano : ano
        const mesEfetivo = (ano > fechado.ano || (ano === fechado.ano && mes > fechado.mes)) ? fechado.mes : mes

        const ultimoDia = new Date(anoEfetivo, mesEfetivo, 0).getDate()
        const dataFim = `${anoEfetivo}-${String(mesEfetivo).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

        // Acumula desde o início do semestre do mês efetivo.
        const dataIni = mesEfetivo <= 6 ? `${anoEfetivo}-01-01` : `${anoEfetivo}-07-01`

        const res = await fetch(`/api/belle/terapeutas?dataIni=${dataIni}&dataFim=${dataFim}`)
        if (!res.ok) throw new Error('Erro ao carregar dados')
        setTerapeutas(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    fetchTerapeutas()
  }, [mesSelecionado, fechado.ano, fechado.mes])

  // Período exibido (ex.: "Julho a Agosto 2026").
  const periodo = (() => {
    if (!mesSelecionado) return ''
    const [ano, mes] = mesSelecionado.split('-').map(Number)
    const anoEf = (ano > fechado.ano || (ano === fechado.ano && mes > fechado.mes)) ? fechado.ano : ano
    const mesEf = (ano > fechado.ano || (ano === fechado.ano && mes > fechado.mes)) ? fechado.mes : mes
    const mesInicio = mesEf <= 6 ? 0 : 6
    return `${MESES[mesInicio]} a ${MESES[mesEf - 1]} ${anoEf}`
  })()

  // Máximos para as notas (relativas ao maior do período).
  const maxHoras = terapeutas.length ? Math.max(...terapeutas.map(t => t.horasAtendimento)) : 0
  const maxPerc = terapeutas.length ? Math.max(...terapeutas.map(t => t.percServicosFidelizados)) : 0
  const maxNps = terapeutas.length ? Math.max(...terapeutas.map(t => t.nps)) : 0

  const nota = (valor: number, max: number) => (max > 0 ? (valor / max) * 10 : 0)

  // Agregados (calc discreto no rodapé).
  const totalHoras = terapeutas.reduce((s, t) => s + t.horasAtendimento, 0)
  const mediaPerc = terapeutas.length ? terapeutas.reduce((s, t) => s + t.percServicosFidelizados, 0) / terapeutas.length : 0
  const mediaNps = terapeutas.length ? terapeutas.reduce((s, t) => s + t.nps, 0) / terapeutas.length : 0

  return (
    <div className="min-h-screen bg-[#E4E5E2] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#7E0000] mb-2">Terapeutas</h1>
          <p className="text-[#392617]/70">
            Performance dos terapeutas ativos — Produtividade, Fidelização e NPS
          </p>
        </div>

        {/* Filtro de Período */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <label className="block text-sm font-medium text-[#392617] mb-2">
                Mês (fim do período)
              </label>
              <input
                type="month"
                value={mesSelecionado}
                max={maxMes}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="px-4 py-2 border border-[#DDC7A4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D78B18]"
              />
            </div>
            {mesSelecionado && (
              <div className="pb-1">
                <div>
                  <span className="text-sm text-[#392617]/70">Período: </span>
                  <span className="text-base font-semibold text-[#7E0000]">{periodo}</span>
                </div>
                <p className="text-xs text-[#392617]/60 mt-1">
                  O mês atual ({mesAtualNome}) está em curso e <strong>não é considerado</strong> — acumula apenas meses fechados do semestre.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[#392617]/70">Carregando dados...</div>
          ) : error ? (
            <div className="p-8 text-center text-[#7E0000]">{error}</div>
          ) : terapeutas.length === 0 ? (
            <div className="p-8 text-center text-[#392617]/70">
              Nenhum terapeuta ativo encontrado para o período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#7E0000] text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Terapeuta</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Produtividade</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Fidelização</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">NPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDC7A4]/30">
                  {terapeutas.map((t, i) => (
                    <tr key={`${t.profissional}-${i}`} className="hover:bg-[#DDC7A4]/10 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-[#392617]">{t.profissional}</td>
                      <IndicadorCell
                        nota={nota(t.horasAtendimento, maxHoras)}
                        bruto={`${t.horasAtendimento.toFixed(2)}h`}
                      />
                      <IndicadorCell
                        nota={nota(t.percServicosFidelizados, maxPerc)}
                        bruto={`${t.percServicosFidelizados.toFixed(2)}% fidelizados`}
                      />
                      <IndicadorCell
                        nota={nota(t.nps, maxNps)}
                        bruto={`${t.nps.toFixed(0)}% NPS`}
                      />
                    </tr>
                  ))}

                  {/* Rodapé agregado (cálculo discreto) */}
                  <tr className="bg-[#DDC7A4]/20">
                    <td className="px-6 py-3 text-sm font-semibold text-[#7E0000]">
                      {terapeutas.length} terapeutas
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-[#392617]/60">
                      {totalHoras.toFixed(0)}h no total
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-[#392617]/60">
                      {mediaPerc.toFixed(1)}% média
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-[#392617]/60">
                      {mediaNps.toFixed(0)}% média
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legenda */}
        <p className="text-xs text-[#392617]/50 mt-3">
          Notas de 0 a 10, relativas ao melhor terapeuta do período em cada indicador. O valor de cálculo (horas, % fidelizados, % NPS) aparece em cinza abaixo de cada nota.
        </p>
      </div>
    </div>
  )
}

// Célula de indicador: nota em destaque + valor de cálculo discreto embaixo.
function IndicadorCell({ nota, bruto }: { nota: number; bruto: string }) {
  const top = nota >= 9.95
  const corTexto =
    nota >= 8 ? 'text-[#425F1D]' :
    nota >= 6 ? 'text-[#D78B18]' :
    'text-[#7E0000]'

  return (
    <td className="px-4 py-4 text-center">
      <div
        className={
          top
            ? 'inline-block min-w-[3.25rem] rounded-md bg-[#425F1D] px-2 py-1 text-xl font-bold text-white'
            : `text-xl font-bold ${corTexto}`
        }
      >
        {nota.toFixed(1)}
      </div>
      <div className="mt-0.5 text-[11px] text-[#392617]/45">{bruto}</div>
    </td>
  )
}
