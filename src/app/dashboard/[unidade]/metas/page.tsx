'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { format, startOfYear, endOfMonth, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw, Target, Award } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { getMetasUnidade } from '@/lib/metas/config'
import type { MetaComRealizacao } from '@/types/metas'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function MetasPage() {
  const params = useParams()
  const unidade = params.unidade as string

  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1) // 1-12
  const [dataIni, setDataIni] = useState(startOfMonth(hoje))
  const [dataFim, setDataFim] = useState(endOfMonth(hoje))
  const [dados, setDados] = useState<MetaComRealizacao[]>([])
  const [loading, setLoading] = useState(false)
  const [premiacao, setPremiacao] = useState<any | null>(null)
  const [fonteMetas, setFonteMetas] = useState<string | null>(null)
  const buscandoRef = useRef(false)

  const buscarDados = useCallback(async (anoSelecionado: number) => {
    if (buscandoRef.current) return // Evita chamadas duplicadas

    buscandoRef.current = true
    setLoading(true)
    try {
      // METAS oficiais vêm do app Folha (fonte da verdade). O realizado continua do
      // config (meses jan-mai) + Belle (demais). Se o Folha faltar, cai no config antigo.
      // Metas (Folha) e Realizado (endpoint cacheado) em paralelo — sem chamadas
      // lentas ao vivo no cliente.
      const [folhaResp, realResp] = await Promise.all([
        fetch(`/api/metas-folha?ano=${anoSelecionado}`, { cache: 'no-store' }),
        fetch(`/api/metas-realizado?unidade=${unidade}&ano=${anoSelecionado}`, { cache: 'no-store' }),
      ])
      const folha = folhaResp.ok ? await folhaResp.json() : null
      const real = realResp.ok ? await realResp.json() : null
      const realPorMes = new Map<number, { caixa: number; horas: number; recepcao: number }>(
        (real?.meses || []).map((x: any) => [x.mes, x])
      )

      const uf = folha?.porSlug?.[unidade] || null
      setFonteMetas(folha?.fonte ?? null)
      setPremiacao(uf ? {
        faixasPremio: folha.faixasPremio,
        cargosPremio: folha.cargosPremio,
        faixasPerdizes: folha.faixasPerdizes,
        comissaoPerdizesPct: folha.comissaoPerdizesPct,
        grupoPremio: uf.grupoPremio,
        premioRecepcao: uf.premioRecepcao,
        perdizesPercentuais: uf.perdizesPercentuais,
        premioCoordenadora: uf.premioCoordenadora,
      } : null)

      const configMetas = getMetasUnidade(unidade, anoSelecionado)

      const dadosComRealizacao = Array.from({ length: 12 }, (_, i) => i + 1).map((mesNum) => {
        const cfg = configMetas?.metas.find(m => m.mes === mesNum)
        const fm = uf?.metas?.find((m: any) => m.mes === mesNum)

        // META = Folha (oficial); se faltar no Folha, cai no config antigo.
        const metaUnidade = fm ? fm.metaFaturamento : (cfg?.metaUnidade ?? 0)
        const metaRecepcao = fm ? fm.metaRecepcao : (cfg?.metaRecepcao ?? 0)
        const metaHoras = fm ? fm.metaHoras : (cfg?.metaHoras ?? 0)

        // REALIZADO = config (meses jan-mai da planilha) senão do endpoint cacheado.
        let realizadoUnidade = 0, realizadoRecepcao = 0, realizadoHoras = 0
        if (cfg && cfg.realizadoUnidade !== undefined && cfg.realizadoRecepcao !== undefined && cfg.realizadoHoras !== undefined) {
          realizadoUnidade = cfg.realizadoUnidade
          realizadoRecepcao = cfg.realizadoRecepcao
          realizadoHoras = cfg.realizadoHoras
        } else {
          const r = realPorMes.get(mesNum)
          if (r) { realizadoUnidade = r.caixa; realizadoHoras = r.horas; realizadoRecepcao = r.recepcao }
        }

        return {
          mes: mesNum,
          mesNome: MESES[mesNum - 1],
          metaUnidade,
          realizadoUnidade,
          percentualUnidade: metaUnidade > 0 ? (realizadoUnidade / metaUnidade) * 100 : 0,
          metaRecepcao,
          realizadoRecepcao,
          percentualRecepcao: metaRecepcao > 0 ? (realizadoRecepcao / metaRecepcao) * 100 : 0,
          metaHoras,
          realizadoHoras,
          percentualHoras: metaHoras > 0 ? (realizadoHoras / metaHoras) * 100 : 0
        }
      })
      setDados(dadosComRealizacao)
    } catch (error) {
      console.error('Erro ao buscar metas:', error)
    } finally {
      setLoading(false)
      buscandoRef.current = false
    }
  }, [unidade])

  useEffect(() => {
    buscarDados(ano)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, unidade])

  // Atualizar período quando mês ou ano mudar
  useEffect(() => {
    const novaDataIni = startOfMonth(new Date(ano, mesSelecionado - 1, 1))
    const novaDataFim = endOfMonth(new Date(ano, mesSelecionado - 1, 1))
    setDataIni(novaDataIni)
    setDataFim(novaDataFim)
  }, [mesSelecionado, ano])

  const formatReal = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)
  }

  const formatHoras = (horas: number) => {
    return horas.toFixed(1) + 'h'
  }

  // Rótulo da faixa de atingimento da coordenadora (ex.: 90–100%, ≥120%)
  const faixaLabelCoord = (f: { faixaMinPct: number; faixaMaxPct: number }) => {
    const min = Math.round(f.faixaMinPct * 100)
    if (f.faixaMaxPct >= 9) return `≥ ${min}%`
    return `${min}–${Math.round(f.faixaMaxPct * 100)}%`
  }

  const getCorPercentual = (percentual: number) => {
    if (percentual >= 100) return 'text-[#425F1D]'
    if (percentual >= 80) return 'text-[#D78B18]'
    return 'text-[#7E0000]'
  }

  const getBgPercentual = (percentual: number) => {
    if (percentual >= 100) return 'bg-[#425F1D]/10'
    if (percentual >= 80) return 'bg-[#D78B18]/10'
    return 'bg-[#7E0000]/10'
  }

  const getStatusProjecao = (percentualProjecao: number) => {
    if (percentualProjecao < 70) {
      return {
        label: 'Crítico',
        textColor: 'text-white',
        bgColor: 'bg-[#7E0000]'
      }
    }
    if (percentualProjecao >= 70 && percentualProjecao < 86) {
      return {
        label: 'Fraco',
        textColor: 'text-white',
        bgColor: 'bg-[#D78B18]'
      }
    }
    if (percentualProjecao >= 86 && percentualProjecao < 100) {
      return {
        label: 'Atenção',
        textColor: 'text-white',
        bgColor: 'bg-[#B8860B]'
      }
    }
    if (percentualProjecao >= 100 && percentualProjecao < 111) {
      return {
        label: 'No ritmo',
        textColor: 'text-white',
        bgColor: 'bg-[#8BC34A]' // Verde bem clarinho
      }
    }
    if (percentualProjecao >= 111 && percentualProjecao < 121) {
      return {
        label: 'Muito bom',
        textColor: 'text-white',
        bgColor: 'bg-[#689F38]' // Verde médio claro
      }
    }
    // 121% ou mais
    return {
      label: 'Excelente',
      textColor: 'text-white',
      bgColor: 'bg-[#33691E]' // Verde escuro
    }
  }

  // Totalizadores anuais (usados na linha TOTAL da tabela mensal)
  const totalMetaUnidade = dados.reduce((sum, d) => sum + d.metaUnidade, 0)
  const totalRealizadoUnidade = dados.reduce((sum, d) => sum + d.realizadoUnidade, 0)
  const totalMetaRecepcao = dados.reduce((sum, d) => sum + d.metaRecepcao, 0)
  const totalRealizadoRecepcao = dados.reduce((sum, d) => sum + d.realizadoRecepcao, 0)
  const totalMetaHoras = dados.reduce((sum, d) => sum + d.metaHoras, 0)
  const totalRealizadoHoras = dados.reduce((sum, d) => sum + d.realizadoHoras, 0)

  // Totalizadores até o mês anterior ao atual (para % de atingimento)
  const mesAtual = new Date().getMonth() + 1
  const mesAnterior = mesAtual - 1

  const dadosAteMesAnterior = dados.filter(d => d.mes < mesAtual)

  const metaUnidadeAteMesAnterior = dadosAteMesAnterior.reduce((sum, d) => sum + d.metaUnidade, 0)
  const realizadoUnidadeAteMesAnterior = dadosAteMesAnterior.reduce((sum, d) => sum + d.realizadoUnidade, 0)
  const percentualUnidadeAteMesAnterior = metaUnidadeAteMesAnterior > 0
    ? (realizadoUnidadeAteMesAnterior / metaUnidadeAteMesAnterior) * 100
    : 0

  const metaRecepcaoAteMesAnterior = dadosAteMesAnterior.reduce((sum, d) => sum + d.metaRecepcao, 0)
  const realizadoRecepcaoAteMesAnterior = dadosAteMesAnterior.reduce((sum, d) => sum + d.realizadoRecepcao, 0)
  const percentualRecepcaoAteMesAnterior = metaRecepcaoAteMesAnterior > 0
    ? (realizadoRecepcaoAteMesAnterior / metaRecepcaoAteMesAnterior) * 100
    : 0

  const metaHorasAteMesAnterior = dadosAteMesAnterior.reduce((sum, d) => sum + d.metaHoras, 0)
  const realizadoHorasAteMesAnterior = dadosAteMesAnterior.reduce((sum, d) => sum + d.realizadoHoras, 0)
  const percentualHorasAteMesAnterior = metaHorasAteMesAnterior > 0
    ? (realizadoHorasAteMesAnterior / metaHorasAteMesAnterior) * 100
    : 0

  // Dados do mês selecionado para acompanhamento
  const dadosMesSelecionado = dados.find(d => d.mes === mesSelecionado) || null
  const diasNoMesSelecionado = new Date(ano, mesSelecionado, 0).getDate()

  // Se for o mês atual do ano atual, mostrar até hoje
  // Se for mês passado, mostrar o mês completo
  const anoAtualReal = hoje.getFullYear()
  const mesAtualReal = hoje.getMonth() + 1
  const diaAtualReal = hoje.getDate()

  const diasDecorridos = ano === anoAtualReal && mesSelecionado === mesAtualReal
    ? diaAtualReal // Mês atual: até hoje
    : diasNoMesSelecionado // Mês passado: mês completo

  // Cálculos para o mês selecionado
  const percentualDiasDecorridos = (diasDecorridos / diasNoMesSelecionado) * 100

  const mediaDiariaUnidade = diasDecorridos > 0 && dadosMesSelecionado
    ? dadosMesSelecionado.realizadoUnidade / diasDecorridos
    : 0
  const mediaNecessariaUnidade = dadosMesSelecionado && dadosMesSelecionado.metaUnidade > 0
    ? dadosMesSelecionado.metaUnidade / diasNoMesSelecionado
    : 0
  const projecaoUnidade = mediaDiariaUnidade * diasNoMesSelecionado

  const mediaDiariaRecepcao = diasDecorridos > 0 && dadosMesSelecionado
    ? dadosMesSelecionado.realizadoRecepcao / diasDecorridos
    : 0
  const mediaNecessariaRecepcao = dadosMesSelecionado && dadosMesSelecionado.metaRecepcao > 0
    ? dadosMesSelecionado.metaRecepcao / diasNoMesSelecionado
    : 0
  const projecaoRecepcao = mediaDiariaRecepcao * diasNoMesSelecionado

  const mediaDiariaHoras = diasDecorridos > 0 && dadosMesSelecionado
    ? dadosMesSelecionado.realizadoHoras / diasDecorridos
    : 0
  const mediaNecessariaHoras = dadosMesSelecionado && dadosMesSelecionado.metaHoras > 0
    ? dadosMesSelecionado.metaHoras / diasNoMesSelecionado
    : 0
  const projecaoHoras = mediaDiariaHoras * diasNoMesSelecionado

  return (
    <>
      <Header
        dataIni={dataIni}
        dataFim={dataFim}
        unidade={unidade}
        loading={loading}
        onPeriodoChange={(ini: Date, fim: Date) => {
          const novoAno = ini.getFullYear()
          const novoMes = ini.getMonth() + 1

          if (novoAno !== ano) {
            setAno(novoAno)
          }
          if (novoMes !== mesSelecionado) {
            setMesSelecionado(novoMes)
          }
        }}
        onRefresh={() => buscarDados(ano)}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6 bg-[#F5F0EB]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#7E0000] flex items-center gap-2">
              <Target size={28} />
              Metas e Premiações
            </h1>
            <p className="text-sm text-[#392617]/60 mt-1">
              Acompanhamento mensal de metas — {ano}
              {fonteMetas === 'folha' && <span className="ml-2 text-[#425F1D] font-medium">• metas oficiais do Folha</span>}
              {fonteMetas === 'cache' && <span className="ml-2 text-[#D78B18] font-medium">• metas do Folha (cache — Folha indisponível)</span>}
            </p>
          </div>
          {loading && (
            <RefreshCw className="animate-spin text-[#7E0000]" size={20} />
          )}
        </div>


        {/* Acompanhamento do Mês Selecionado */}
        {dadosMesSelecionado && (
          <div className="bg-gradient-to-r from-[#7E0000] to-[#5c0000] rounded-xl shadow-lg p-6 text-white">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Acompanhamento Meta {MESES[mesSelecionado - 1]} {ano}</h2>
            </div>

            <div className="bg-white rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#392617] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Indicador
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Meta do Mês
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Realizado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      % Atingido
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Média Diária
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Ritmo Necessário
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Projeção Mês
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDC7A4]/30">
                  {/* Meta Unidade */}
                  <tr className="hover:bg-[#F5F0EB] transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-[#392617]">
                      Meta Unidade
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#392617]">
                      {formatReal(dadosMesSelecionado.metaUnidade)}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                      {formatReal(dadosMesSelecionado.realizadoUnidade)}
                    </td>
                    <td className={`px-4 py-4 text-sm text-center font-bold ${getCorPercentual(dadosMesSelecionado.percentualUnidade)}`}>
                      {dadosMesSelecionado.percentualUnidade.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#392617]">
                      {formatReal(mediaDiariaUnidade)}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#D78B18] font-semibold">
                      {formatReal(mediaNecessariaUnidade)}
                    </td>
                    <td className={`px-4 py-4 text-sm text-center font-semibold ${
                      projecaoUnidade >= dadosMesSelecionado.metaUnidade ? 'text-[#425F1D]' : 'text-[#7E0000]'
                    }`}>
                      {formatReal(projecaoUnidade)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(() => {
                        // Para mês completo/passado: usar % real atingido
                        // Para mês atual: usar % da projeção
                        const mesCompleto = ano < anoAtualReal || (ano === anoAtualReal && mesSelecionado < mesAtualReal)
                        const percentualParaStatus = mesCompleto
                          ? dadosMesSelecionado.percentualUnidade
                          : dadosMesSelecionado.metaUnidade > 0 ? (projecaoUnidade / dadosMesSelecionado.metaUnidade) * 100 : 0
                        const status = getStatusProjecao(percentualParaStatus)
                        return (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.bgColor} ${status.textColor}`}>
                            {status.label}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>

                  {/* Meta Recepção */}
                  <tr className="hover:bg-[#F5F0EB] transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-[#392617]">
                      Meta Recepção
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#392617]">
                      {dadosMesSelecionado.metaRecepcao > 0 ? formatReal(dadosMesSelecionado.metaRecepcao) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                      {dadosMesSelecionado.realizadoRecepcao > 0 ? formatReal(dadosMesSelecionado.realizadoRecepcao) : '—'}
                    </td>
                    <td className={`px-4 py-4 text-sm text-center font-bold ${getCorPercentual(dadosMesSelecionado.percentualRecepcao)}`}>
                      {dadosMesSelecionado.metaRecepcao > 0 ? `${dadosMesSelecionado.percentualRecepcao.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#392617]">
                      {dadosMesSelecionado.metaRecepcao > 0 ? formatReal(mediaDiariaRecepcao) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#D78B18] font-semibold">
                      {dadosMesSelecionado.metaRecepcao > 0 ? formatReal(mediaNecessariaRecepcao) : '—'}
                    </td>
                    <td className={`px-4 py-4 text-sm text-center font-semibold ${
                      dadosMesSelecionado.metaRecepcao > 0 && projecaoRecepcao >= dadosMesSelecionado.metaRecepcao ? 'text-[#425F1D]' : 'text-[#7E0000]'
                    }`}>
                      {dadosMesSelecionado.metaRecepcao > 0 ? formatReal(projecaoRecepcao) : '—'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {dadosMesSelecionado.metaRecepcao > 0 ? (() => {
                        // Para mês completo/passado: usar % real atingido
                        // Para mês atual: usar % da projeção
                        const mesCompleto = ano < anoAtualReal || (ano === anoAtualReal && mesSelecionado < mesAtualReal)
                        const percentualParaStatus = mesCompleto
                          ? dadosMesSelecionado.percentualRecepcao
                          : (projecaoRecepcao / dadosMesSelecionado.metaRecepcao) * 100
                        const status = getStatusProjecao(percentualParaStatus)
                        return (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.bgColor} ${status.textColor}`}>
                            {status.label}
                          </span>
                        )
                      })() : '—'}
                    </td>
                  </tr>

                  {/* Meta Horas */}
                  <tr className="hover:bg-[#F5F0EB] transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-[#392617]">
                      Meta Horas
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#392617]">
                      {dadosMesSelecionado.metaHoras > 0 ? formatHoras(dadosMesSelecionado.metaHoras) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-semibold text-[#392617]">
                      {dadosMesSelecionado.realizadoHoras > 0 ? formatHoras(dadosMesSelecionado.realizadoHoras) : '—'}
                    </td>
                    <td className={`px-4 py-4 text-sm text-center font-bold ${getCorPercentual(dadosMesSelecionado.percentualHoras)}`}>
                      {dadosMesSelecionado.metaHoras > 0 ? `${dadosMesSelecionado.percentualHoras.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#392617]">
                      {dadosMesSelecionado.metaHoras > 0 ? formatHoras(mediaDiariaHoras) : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-[#D78B18] font-semibold">
                      {dadosMesSelecionado.metaHoras > 0 ? formatHoras(mediaNecessariaHoras) : '—'}
                    </td>
                    <td className={`px-4 py-4 text-sm text-center font-semibold ${
                      dadosMesSelecionado.metaHoras > 0 && projecaoHoras >= dadosMesSelecionado.metaHoras ? 'text-[#425F1D]' : 'text-[#7E0000]'
                    }`}>
                      {dadosMesSelecionado.metaHoras > 0 ? formatHoras(projecaoHoras) : '—'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {dadosMesSelecionado.metaHoras > 0 ? (() => {
                        // Para mês completo/passado: usar % real atingido
                        // Para mês atual: usar % da projeção
                        const mesCompleto = ano < anoAtualReal || (ano === anoAtualReal && mesSelecionado < mesAtualReal)
                        const percentualParaStatus = mesCompleto
                          ? dadosMesSelecionado.percentualHoras
                          : (projecaoHoras / dadosMesSelecionado.metaHoras) * 100
                        const status = getStatusProjecao(percentualParaStatus)
                        return (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.bgColor} ${status.textColor}`}>
                            {status.label}
                          </span>
                        )
                      })() : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-white/90">
              <div className="bg-white/10 rounded-lg p-3">
                <p className="font-semibold mb-1">💡 Média Diária:</p>
                <p>Quanto foi realizado por dia até agora</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="font-semibold mb-1">🎯 Ritmo Necessário:</p>
                <p>Quanto precisa fazer por dia para atingir a meta</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="font-semibold mb-1">📊 Projeção:</p>
                <p>Valor estimado de fechamento mantendo o ritmo atual</p>
              </div>
            </div>

            {/* Legenda de Status */}
            <div className="mt-4 bg-white rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#392617] mb-3">Legenda de Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#7E0000] text-white whitespace-nowrap">
                    Crítico
                  </span>
                  <span className="text-xs text-[#392617]">{'< 70%'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#D78B18] text-white whitespace-nowrap">
                    Fraco
                  </span>
                  <span className="text-xs text-[#392617]">70-85%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#B8860B] text-white whitespace-nowrap">
                    Atenção
                  </span>
                  <span className="text-xs text-[#392617]">86-99%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#8BC34A] text-white whitespace-nowrap">
                    No ritmo
                  </span>
                  <span className="text-xs text-[#392617]">100-110%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#689F38] text-white whitespace-nowrap">
                    Muito bom
                  </span>
                  <span className="text-xs text-[#392617]">111-120%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#33691E] text-white whitespace-nowrap">
                    Excelente
                  </span>
                  <span className="text-xs text-[#392617]">{"> 120%"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabela Mensal Completa */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#7E0000] text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Mês
                  </th>
                  <th colSpan={3} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider border-l border-white/20">
                    Meta Unidade
                  </th>
                  <th colSpan={3} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider border-l border-white/20">
                    Meta Recepção
                  </th>
                  <th colSpan={3} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider border-l border-white/20">
                    Meta Horas
                  </th>
                </tr>
                <tr className="bg-[#7E0000]/90">
                  <th></th>
                  <th className="px-4 py-2 text-center text-xs font-medium border-l border-white/20">Meta</th>
                  <th className="px-4 py-2 text-center text-xs font-medium">Realizado</th>
                  <th className="px-4 py-2 text-center text-xs font-medium">%</th>
                  <th className="px-4 py-2 text-center text-xs font-medium border-l border-white/20">Meta</th>
                  <th className="px-4 py-2 text-center text-xs font-medium">Realizado</th>
                  <th className="px-4 py-2 text-center text-xs font-medium">%</th>
                  <th className="px-4 py-2 text-center text-xs font-medium border-l border-white/20">Meta</th>
                  <th className="px-4 py-2 text-center text-xs font-medium">Realizado</th>
                  <th className="px-4 py-2 text-center text-xs font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDC7A4]/30">
                {dados.map((linha) => (
                  <tr key={linha.mes} className="hover:bg-[#DDC7A4]/10 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-[#392617]">
                      {linha.mesNome}
                    </td>

                    <td className="px-4 py-3 text-sm text-center text-[#392617] border-l border-[#DDC7A4]/30">
                      {formatReal(linha.metaUnidade)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[#392617]">
                      {linha.realizadoUnidade > 0 ? formatReal(linha.realizadoUnidade) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-bold ${getCorPercentual(linha.percentualUnidade)}`}>
                      {linha.realizadoUnidade > 0 ? `${linha.percentualUnidade.toFixed(1)}%` : '—'}
                    </td>

                    <td className="px-4 py-3 text-sm text-center text-[#392617] border-l border-[#DDC7A4]/30">
                      {linha.metaRecepcao > 0 ? formatReal(linha.metaRecepcao) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[#392617]">
                      {linha.realizadoRecepcao > 0 ? formatReal(linha.realizadoRecepcao) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-bold ${getCorPercentual(linha.percentualRecepcao)}`}>
                      {linha.realizadoRecepcao > 0 && linha.metaRecepcao > 0 ? `${linha.percentualRecepcao.toFixed(1)}%` : '—'}
                    </td>

                    <td className="px-4 py-3 text-sm text-center text-[#392617] border-l border-[#DDC7A4]/30">
                      {formatHoras(linha.metaHoras)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[#392617]">
                      {linha.realizadoHoras > 0 ? formatHoras(linha.realizadoHoras) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-bold ${getCorPercentual(linha.percentualHoras)}`}>
                      {linha.realizadoHoras > 0 ? `${linha.percentualHoras.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}

                {/* Linha de Totalizadores */}
                <tr className="bg-[#DDC7A4]/30 font-bold border-t-2 border-[#7E0000]">
                  <td className="px-4 py-4 text-sm font-bold text-[#7E0000]">
                    TOTAL
                  </td>

                  {/* Meta Unidade */}
                  <td className="px-4 py-4 text-sm text-center text-[#392617] border-l border-[#DDC7A4]/30">
                    {formatReal(totalMetaUnidade)}
                  </td>
                  <td className="px-4 py-4 text-sm text-center text-[#392617]">
                    {formatReal(totalRealizadoUnidade)}
                  </td>
                  <td className={`px-4 py-4 text-sm text-center font-bold ${getCorPercentual(percentualUnidadeAteMesAnterior)}`}>
                    {percentualUnidadeAteMesAnterior > 0 ? `${percentualUnidadeAteMesAnterior.toFixed(1)}%` : '—'}
                  </td>

                  {/* Meta Recepção */}
                  <td className="px-4 py-4 text-sm text-center text-[#392617] border-l border-[#DDC7A4]/30">
                    {totalMetaRecepcao > 0 ? formatReal(totalMetaRecepcao) : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-center text-[#392617]">
                    {totalRealizadoRecepcao > 0 ? formatReal(totalRealizadoRecepcao) : '—'}
                  </td>
                  <td className={`px-4 py-4 text-sm text-center font-bold ${getCorPercentual(percentualRecepcaoAteMesAnterior)}`}>
                    {percentualRecepcaoAteMesAnterior > 0 ? `${percentualRecepcaoAteMesAnterior.toFixed(1)}%` : '—'}
                  </td>

                  {/* Meta Horas */}
                  <td className="px-4 py-4 text-sm text-center text-[#392617] border-l border-[#DDC7A4]/30">
                    {totalMetaHoras > 0 ? formatHoras(totalMetaHoras) : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-center text-[#392617]">
                    {totalRealizadoHoras > 0 ? formatHoras(totalRealizadoHoras) : '—'}
                  </td>
                  <td className={`px-4 py-4 text-sm text-center font-bold ${getCorPercentual(percentualHorasAteMesAnterior)}`}>
                    {percentualHorasAteMesAnterior > 0 ? `${percentualHorasAteMesAnterior.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Premiação — Recepção e Coordenadora, lado a lado (oficial do Folha) */}
        {premiacao && (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-[#DDC7A4]/30 flex-1 min-w-0 w-full">
            <div className="bg-[#425F1D] text-white px-5 py-3 flex items-center gap-2">
              <Award size={18} />
              <div>
                <h2 className="text-base font-bold">Premiação da Recepção — oficial (Folha)</h2>
                <p className="text-xs text-white/80">Prêmio por faixa de atingimento da Meta Recepção</p>
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              {premiacao.grupoPremio === 'PERDIZES' ? (
                <div>
                  <p className="text-xs text-[#392617]/70 mb-3">
                    Perdizes tem modelo próprio: <strong>comissão fixa de {(premiacao.comissaoPerdizesPct * 100).toFixed(0)}%</strong> sobre as vendas de recepção + o percentual por faixa abaixo (também sobre as vendas), somados e rateados entre as especialistas por dias trabalhados.
                  </p>
                  <table className="border-collapse">
                    <thead>
                      <tr className="bg-[#392617]/8">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40">Atingimento</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40">% do prêmio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {premiacao.faixasPerdizes.map((f: any, i: number) => (
                        <tr key={i} className={i % 2 ? 'bg-[#DDC7A4]/10' : ''}>
                          <td className="px-4 py-2 text-xs text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">{f.label}</td>
                          <td className="px-4 py-2 text-xs text-center font-semibold text-[#425F1D] border border-[#DDC7A4]/40">
                            {(((premiacao.perdizesPercentuais?.[i] ?? f.percentual) * 100).toFixed(2)).replace('.', ',')}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : premiacao.premioRecepcao ? (
                <table className="border-collapse">
                  <thead>
                    <tr className="bg-[#392617]/8">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40">Atingimento</th>
                      {premiacao.cargosPremio.map((c: any) => (
                        <th key={c.chave} className="px-4 py-2 text-center text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {premiacao.faixasPremio.map((faixa: any, i: number) => (
                      <tr key={i} className={i % 2 ? 'bg-[#DDC7A4]/10' : ''}>
                        <td className="px-4 py-2 text-xs font-medium text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">{faixa.label}</td>
                        {premiacao.cargosPremio.map((c: any) => {
                          const v = premiacao.premioRecepcao?.[c.chave]?.[i] ?? 0
                          return (
                            <td key={c.chave} className="px-4 py-2 text-xs text-center text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">
                              {v > 0 ? formatReal(v) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-[#392617]/60">Sem tabela de premiação cadastrada para esta unidade no Folha.</p>
              )}
            </div>
          </div>

          {/* Premiação da Coordenadora */}
          {premiacao.premioCoordenadora && premiacao.premioCoordenadora.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-[#DDC7A4]/30 flex-1 min-w-0 w-full">
            <div className="bg-[#7E0000] text-white px-5 py-3 flex items-center gap-2">
              <Award size={18} />
              <div>
                <h2 className="text-base font-bold">Premiação da Coordenadora — oficial (Folha)</h2>
                <p className="text-xs text-white/80">Bônus por faixa de atingimento (faturamento + horas)</p>
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr className="bg-[#392617]/8">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">Atingimento</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">Bônus Faturamento</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">Bônus Horas</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {premiacao.premioCoordenadora.map((f: any, i: number) => (
                    <tr key={i} className={i % 2 ? 'bg-[#DDC7A4]/10' : ''}>
                      <td className="px-4 py-2 text-xs font-medium text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">{faixaLabelCoord(f)}</td>
                      <td className="px-4 py-2 text-xs text-center text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">{formatReal(f.bonusFaturamento)}</td>
                      <td className="px-4 py-2 text-xs text-center text-[#392617] border border-[#DDC7A4]/40 whitespace-nowrap">{formatReal(f.bonusHoras)}</td>
                      <td className="px-4 py-2 text-xs text-center font-semibold text-[#7E0000] border border-[#DDC7A4]/40 whitespace-nowrap">{formatReal(f.bonusFaturamento + f.bonusHoras)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-5 border border-[#DDC7A4]/30">
          <h3 className="text-sm font-semibold text-[#392617] mb-3">Legenda</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#392617]/70">
            <div>
              <p className="font-semibold mb-1">Indicadores:</p>
              <p>• <span className="text-[#425F1D] font-semibold">Verde:</span> Atingimento ≥ 100%</p>
              <p>• <span className="text-[#D78B18] font-semibold">Dourado:</span> Atingimento 80-99%</p>
              <p>• <span className="text-[#7E0000] font-semibold">Vermelho:</span> Atingimento &lt; 80%</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Meta Unidade:</p>
              <p>Recebido em Caixa (Vendas da Recepção + Serviços Avulsos)</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Meta Recepção:</p>
              <p>Vendas realizadas pela recepção (Planos, Vouchers e Produtos)</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
