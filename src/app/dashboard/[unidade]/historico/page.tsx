import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUnidadeNome, getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getFaturamentoMensal } from '@/lib/belle/bi'
import { HistoricoChart } from './historico-chart'
import { HistoricoChartHoras } from './historico-chart-horas'

// Força a página a ser dinâmica para sempre buscar dados atualizados
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ unidade: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { unidade } = await params
  const unidadeNome = getUnidadeNome(unidade)

  if (!unidadeNome) {
    return { title: 'Unidade não encontrada' }
  }

  return {
    title: `Histórico - ${unidadeNome} | Buddha Spa`,
    description: `Histórico de faturamento da unidade ${unidadeNome}`,
  }
}

// Dados históricos de faturamento por unidade (base). Meses fechados do ano atual
// que faltarem/estiverem incompletos aqui são completados do Belle e cacheados.
// O mês corrente NÃO é exibido (parcial distorce a escala).
const dadosHistoricoCaixa: Record<string, Array<{
  mes: string
  ano: number
  caixa: number
}>> = {
  'shopping-metropole': [
    // 2026 - Unidade iniciou atividades em Fevereiro/2026
    { mes: 'Fev', ano: 2026, caixa: 37339.00 },
    { mes: 'Mar', ano: 2026, caixa: 77227.00 },
    { mes: 'Abr', ano: 2026, caixa: 97543.00 },
    { mes: 'Mai', ano: 2026, caixa: 128803.00 },
    { mes: 'Jun', ano: 2026, caixa: 42259.60 },
  ],
  'analia-franco': [
    // 2023
    { mes: 'Jan', ano: 2023, caixa: 132737.00 },
    { mes: 'Fev', ano: 2023, caixa: 77992.00 },
    { mes: 'Mar', ano: 2023, caixa: 152600.00 },
    { mes: 'Abr', ano: 2023, caixa: 154708.00 },
    { mes: 'Mai', ano: 2023, caixa: 184244.00 },
    { mes: 'Jun', ano: 2023, caixa: 125629.00 },
    { mes: 'Jul', ano: 2023, caixa: 91060.00 },
    { mes: 'Ago', ano: 2023, caixa: 153773.00 },
    { mes: 'Set', ano: 2023, caixa: 138200.00 },
    { mes: 'Out', ano: 2023, caixa: 140597.00 },
    { mes: 'Nov', ano: 2023, caixa: 185652.00 },
    { mes: 'Dez', ano: 2023, caixa: 152221.00 },
    // 2024
    { mes: 'Jan', ano: 2024, caixa: 135124.00 },
    { mes: 'Fev', ano: 2024, caixa: 141659.00 },
    { mes: 'Mar', ano: 2024, caixa: 193954.00 },
    { mes: 'Abr', ano: 2024, caixa: 197206.00 },
    { mes: 'Mai', ano: 2024, caixa: 230126.00 },
    { mes: 'Jun', ano: 2024, caixa: 166681.00 },
    { mes: 'Jul', ano: 2024, caixa: 157182.00 },
    { mes: 'Ago', ano: 2024, caixa: 109356.00 },
    { mes: 'Set', ano: 2024, caixa: 178163.00 },
    { mes: 'Out', ano: 2024, caixa: 187369.00 },
    { mes: 'Nov', ano: 2024, caixa: 215863.00 },
    { mes: 'Dez', ano: 2024, caixa: 191901.00 },
    // 2025
    { mes: 'Jan', ano: 2025, caixa: 150395.00 },
    { mes: 'Fev', ano: 2025, caixa: 128575.00 },
    { mes: 'Mar', ano: 2025, caixa: 178510.00 },
    { mes: 'Abr', ano: 2025, caixa: 154000.00 },
    { mes: 'Mai', ano: 2025, caixa: 209420.00 },
    { mes: 'Jun', ano: 2025, caixa: 143620.00 },
    { mes: 'Jul', ano: 2025, caixa: 116623.00 },
    { mes: 'Ago', ano: 2025, caixa: 163426.00 },
    { mes: 'Set', ano: 2025, caixa: 145682.00 },
    { mes: 'Out', ano: 2025, caixa: 175956.00 },
    { mes: 'Nov', ano: 2025, caixa: 141079.00 },
    { mes: 'Dez', ano: 2025, caixa: 146354.00 },
    // 2026
    { mes: 'Jan', ano: 2026, caixa: 139138.78 },
    { mes: 'Fev', ano: 2026, caixa: 125910.48 },
    { mes: 'Mar', ano: 2026, caixa: 152598.57 },
    { mes: 'Abr', ano: 2026, caixa: 191530.00 },
    { mes: 'Mai', ano: 2026, caixa: 225102.20 },
    { mes: 'Jun', ano: 2026, caixa: 62098.80 },
  ],
  'shopping-analia-franco': [
    // 2023 - Unidade iniciou atividades no FINAL de Junho/2023; Jun/23 é omitido
    // de propósito (mês parcial distorce o gráfico).
    { mes: 'Jul', ano: 2023, caixa: 141661.00 },
    { mes: 'Ago', ano: 2023, caixa: 101853.00 },
    { mes: 'Set', ano: 2023, caixa: 115074.00 },
    { mes: 'Out', ano: 2023, caixa: 149638.00 },
    { mes: 'Nov', ano: 2023, caixa: 148436.00 },
    { mes: 'Dez', ano: 2023, caixa: 206780.00 },
    // 2024
    { mes: 'Jan', ano: 2024, caixa: 118304.00 },
    { mes: 'Fev', ano: 2024, caixa: 118077.00 },
    { mes: 'Mar', ano: 2024, caixa: 146009.00 },
    { mes: 'Abr', ano: 2024, caixa: 141550.00 },
    { mes: 'Mai', ano: 2024, caixa: 189228.00 },
    { mes: 'Jun', ano: 2024, caixa: 140064.00 },
    { mes: 'Jul', ano: 2024, caixa: 105447.00 },
    { mes: 'Ago', ano: 2024, caixa: 158030.00 },
    { mes: 'Set', ano: 2024, caixa: 128420.00 },
    { mes: 'Out', ano: 2024, caixa: 165101.00 },
    { mes: 'Nov', ano: 2024, caixa: 143334.00 },
    { mes: 'Dez', ano: 2024, caixa: 225905.00 },
    // 2025
    { mes: 'Jan', ano: 2025, caixa: 121171.00 },
    { mes: 'Fev', ano: 2025, caixa: 121166.00 },
    { mes: 'Mar', ano: 2025, caixa: 162612.00 },
    { mes: 'Abr', ano: 2025, caixa: 163847.00 },
    { mes: 'Mai', ano: 2025, caixa: 250786.00 },
    { mes: 'Jun', ano: 2025, caixa: 94090.00 },
    { mes: 'Jul', ano: 2025, caixa: 100230.00 },
    { mes: 'Ago', ano: 2025, caixa: 133544.00 },
    { mes: 'Set', ano: 2025, caixa: 111117.00 },
    { mes: 'Out', ano: 2025, caixa: 128889.00 },
    { mes: 'Nov', ano: 2025, caixa: 169142.00 },
    { mes: 'Dez', ano: 2025, caixa: 209952.00 },
    // 2026
    { mes: 'Jan', ano: 2026, caixa: 129491.00 },
    { mes: 'Fev', ano: 2026, caixa: 135586.00 },
    { mes: 'Mar', ano: 2026, caixa: 129155.00 },
    { mes: 'Abr', ano: 2026, caixa: 152000.00 },
    { mes: 'Mai', ano: 2026, caixa: 217155.00 },
    { mes: 'Jun', ano: 2026, caixa: 77600.40 },
  ],
  'perdizes': [
    // 2023
    { mes: 'Jan', ano: 2023, caixa: 98732.00 },
    { mes: 'Fev', ano: 2023, caixa: 86960.00 },
    { mes: 'Mar', ano: 2023, caixa: 132853.00 },
    { mes: 'Abr', ano: 2023, caixa: 93583.00 },
    { mes: 'Mai', ano: 2023, caixa: 126399.00 },
    { mes: 'Jun', ano: 2023, caixa: 93584.00 },
    { mes: 'Jul', ano: 2023, caixa: 107689.00 },
    { mes: 'Ago', ano: 2023, caixa: 87979.00 },
    { mes: 'Set', ano: 2023, caixa: 125659.00 },
    { mes: 'Out', ano: 2023, caixa: 121747.00 },
    { mes: 'Nov', ano: 2023, caixa: 190440.00 },
    { mes: 'Dez', ano: 2023, caixa: 138046.00 },
    // 2024
    { mes: 'Jan', ano: 2024, caixa: 102273.00 },
    { mes: 'Fev', ano: 2024, caixa: 108457.00 },
    { mes: 'Mar', ano: 2024, caixa: 135882.00 },
    { mes: 'Abr', ano: 2024, caixa: 161200.00 },
    { mes: 'Mai', ano: 2024, caixa: 155895.00 },
    { mes: 'Jun', ano: 2024, caixa: 149221.00 },
    { mes: 'Jul', ano: 2024, caixa: 143419.00 },
    { mes: 'Ago', ano: 2024, caixa: 168239.00 },
    { mes: 'Set', ano: 2024, caixa: 165435.00 },
    { mes: 'Out', ano: 2024, caixa: 175208.00 },
    { mes: 'Nov', ano: 2024, caixa: 228593.00 },
    { mes: 'Dez', ano: 2024, caixa: 192099.00 },
    // 2025
    { mes: 'Jan', ano: 2025, caixa: 160945.00 },
    { mes: 'Fev', ano: 2025, caixa: 154542.00 },
    { mes: 'Mar', ano: 2025, caixa: 117128.00 },
    { mes: 'Abr', ano: 2025, caixa: 164250.00 },
    { mes: 'Mai', ano: 2025, caixa: 172138.00 },
    { mes: 'Jun', ano: 2025, caixa: 123559.00 },
    { mes: 'Jul', ano: 2025, caixa: 147620.00 },
    { mes: 'Ago', ano: 2025, caixa: 154288.00 },
    { mes: 'Set', ano: 2025, caixa: 151210.00 },
    { mes: 'Out', ano: 2025, caixa: 200199.00 },
    { mes: 'Nov', ano: 2025, caixa: 229839.00 },
    { mes: 'Dez', ano: 2025, caixa: 176168.00 },
    // 2026
    { mes: 'Jan', ano: 2026, caixa: 119255.00 },
    { mes: 'Fev', ano: 2026, caixa: 158461.00 },
    { mes: 'Mar', ano: 2026, caixa: 186106.00 },
    { mes: 'Abr', ano: 2026, caixa: 187677.00 },
    { mes: 'Mai', ano: 2026, caixa: 183690.00 },
    { mes: 'Jun', ano: 2026, caixa: 55543.80 },
  ],
  'tatuape-gomescardim': [
    // 2025 - Unidade iniciou atividades em Julho/2025
    { mes: 'Jul', ano: 2025, caixa: 40745.00 },
    { mes: 'Ago', ano: 2025, caixa: 51569.00 },
    { mes: 'Set', ano: 2025, caixa: 53927.00 },
    { mes: 'Out', ano: 2025, caixa: 64245.00 },
    { mes: 'Nov', ano: 2025, caixa: 69197.00 },
    { mes: 'Dez', ano: 2025, caixa: 64952.00 },
    // 2026
    { mes: 'Jan', ano: 2026, caixa: 55740.00 },
    { mes: 'Fev', ano: 2026, caixa: 66054.00 },
    { mes: 'Mar', ano: 2026, caixa: 81325.00 },
    { mes: 'Abr', ano: 2026, caixa: 68403.00 },
    { mes: 'Mai', ano: 2026, caixa: 96075.00 },
    { mes: 'Jun', ano: 2026, caixa: 36147.80 },
  ],
  'mooca-plaza': [
    // 2023
    { mes: 'Jan', ano: 2023, caixa: 103440.00 },
    { mes: 'Fev', ano: 2023, caixa: 101553.00 },
    { mes: 'Mar', ano: 2023, caixa: 117849.00 },
    { mes: 'Abr', ano: 2023, caixa: 91662.00 },
    { mes: 'Mai', ano: 2023, caixa: 132511.00 },
    { mes: 'Jun', ano: 2023, caixa: 91059.00 },
    { mes: 'Jul', ano: 2023, caixa: 86259.00 },
    { mes: 'Ago', ano: 2023, caixa: 93650.00 },
    { mes: 'Set', ano: 2023, caixa: 94218.00 },
    { mes: 'Out', ano: 2023, caixa: 141888.00 },
    { mes: 'Nov', ano: 2023, caixa: 139885.00 },
    { mes: 'Dez', ano: 2023, caixa: 199660.00 },
    // 2024
    { mes: 'Jan', ano: 2024, caixa: 85696.00 },
    { mes: 'Fev', ano: 2024, caixa: 99283.00 },
    { mes: 'Mar', ano: 2024, caixa: 101834.00 },
    { mes: 'Abr', ano: 2024, caixa: 128930.00 },
    { mes: 'Mai', ano: 2024, caixa: 167524.00 },
    { mes: 'Jun', ano: 2024, caixa: 115186.00 },
    { mes: 'Jul', ano: 2024, caixa: 96101.00 },
    { mes: 'Ago', ano: 2024, caixa: 100722.00 },
    { mes: 'Set', ano: 2024, caixa: 116519.00 },
    { mes: 'Out', ano: 2024, caixa: 124675.00 },
    { mes: 'Nov', ano: 2024, caixa: 122406.00 },
    { mes: 'Dez', ano: 2024, caixa: 187219.00 },
    // 2025
    { mes: 'Jan', ano: 2025, caixa: 113125.00 },
    { mes: 'Fev', ano: 2025, caixa: 106758.00 },
    { mes: 'Mar', ano: 2025, caixa: 113694.00 },
    { mes: 'Abr', ano: 2025, caixa: 94000.00 },
    { mes: 'Mai', ano: 2025, caixa: 146304.00 },
    { mes: 'Jun', ano: 2025, caixa: 94924.00 },
    { mes: 'Jul', ano: 2025, caixa: 77659.00 },
    { mes: 'Ago', ano: 2025, caixa: 91072.00 },
    { mes: 'Set', ano: 2025, caixa: 92609.00 },
    { mes: 'Out', ano: 2025, caixa: 115074.00 },
    { mes: 'Nov', ano: 2025, caixa: 104587.00 },
    { mes: 'Dez', ano: 2025, caixa: 167728.00 },
    // 2026
    { mes: 'Jan', ano: 2026, caixa: 90556.00 },
    { mes: 'Fev', ano: 2026, caixa: 87733.00 },
    { mes: 'Mar', ano: 2026, caixa: 121656.00 },
    { mes: 'Abr', ano: 2026, caixa: 104004.00 },
    { mes: 'Mai', ano: 2026, caixa: 155398.00 },
    { mes: 'Jun', ano: 2026, caixa: 50225.52 },
  ],
  'higienopolis': [
    // 2023
    { mes: 'Jan', ano: 2023, caixa: 231654.00 },
    { mes: 'Fev', ano: 2023, caixa: 204192.00 },
    { mes: 'Mar', ano: 2023, caixa: 213649.00 },
    { mes: 'Abr', ano: 2023, caixa: 175908.00 },
    { mes: 'Mai', ano: 2023, caixa: 173015.00 },
    { mes: 'Jun', ano: 2023, caixa: 189108.00 },
    { mes: 'Jul', ano: 2023, caixa: 175025.00 },
    { mes: 'Ago', ano: 2023, caixa: 216161.00 },
    { mes: 'Set', ano: 2023, caixa: 170428.00 },
    { mes: 'Out', ano: 2023, caixa: 211185.00 },
    { mes: 'Nov', ano: 2023, caixa: 271763.00 },
    { mes: 'Dez', ano: 2023, caixa: 246981.00 },
    // 2024
    { mes: 'Jan', ano: 2024, caixa: 178840.00 },
    { mes: 'Fev', ano: 2024, caixa: 196223.00 },
    { mes: 'Mar', ano: 2024, caixa: 205978.00 },
    { mes: 'Abr', ano: 2024, caixa: 242036.00 },
    { mes: 'Mai', ano: 2024, caixa: 219548.00 },
    { mes: 'Jun', ano: 2024, caixa: 219750.00 },
    { mes: 'Jul', ano: 2024, caixa: 171795.00 },
    { mes: 'Ago', ano: 2024, caixa: 262210.00 },
    { mes: 'Set', ano: 2024, caixa: 289701.00 },
    { mes: 'Out', ano: 2024, caixa: 262147.00 },
    { mes: 'Nov', ano: 2024, caixa: 247178.00 },
    { mes: 'Dez', ano: 2024, caixa: 267867.00 },
    // 2025
    { mes: 'Jan', ano: 2025, caixa: 264491.00 },
    { mes: 'Fev', ano: 2025, caixa: 205121.00 },
    { mes: 'Mar', ano: 2025, caixa: 210000.00 },
    { mes: 'Abr', ano: 2025, caixa: 255673.00 },
    { mes: 'Mai', ano: 2025, caixa: 257816.00 },
    { mes: 'Jun', ano: 2025, caixa: 203095.00 },
    { mes: 'Jul', ano: 2025, caixa: 208868.00 },
    { mes: 'Ago', ano: 2025, caixa: 194288.00 },
    { mes: 'Set', ano: 2025, caixa: 208067.00 },
    { mes: 'Out', ano: 2025, caixa: 213920.00 },
    { mes: 'Nov', ano: 2025, caixa: 249284.00 },
    { mes: 'Dez', ano: 2025, caixa: 247291.00 },
    // 2026
    { mes: 'Jan', ano: 2026, caixa: 196398.00 },
    { mes: 'Fev', ano: 2026, caixa: 197669.00 },
    { mes: 'Mar', ano: 2026, caixa: 186357.00 },
    { mes: 'Abr', ano: 2026, caixa: 179739.00 },
    { mes: 'Mai', ano: 2026, caixa: 225791.00 },
    { mes: 'Jun', ano: 2026, caixa: 78072.20 },
  ],
}

// Dados históricos de Horas de Atendimento por unidade (base). Mesma regra do caixa:
// meses fechados incompletos/ausentes são completados do Belle; mês corrente não é exibido.
const dadosHistoricoHoras: Record<string, Array<{
  mes: string
  ano: number
  horas: number
}>> = {
  'shopping-metropole': [
    // 2026 - Unidade iniciou atividades em Fevereiro/2026
    { mes: 'Fev', ano: 2026, horas: 273.91 },
    { mes: 'Mar', ano: 2026, horas: 584.41 },
    { mes: 'Abr', ano: 2026, horas: 637.91 },
    { mes: 'Mai', ano: 2026, horas: 746.33 },
  ],
  'analia-franco': [
    // 2023
    { mes: 'Jan', ano: 2023, horas: 1167.75 },
    { mes: 'Fev', ano: 2023, horas: 812.33 },
    { mes: 'Mar', ano: 2023, horas: 1242.15 },
    { mes: 'Abr', ano: 2023, horas: 1042.09 },
    { mes: 'Mai', ano: 2023, horas: 1274.66 },
    { mes: 'Jun', ano: 2023, horas: 1224.50 },
    { mes: 'Jul', ano: 2023, horas: 1235.67 },
    { mes: 'Ago', ano: 2023, horas: 1292.01 },
    { mes: 'Set', ano: 2023, horas: 1073.75 },
    { mes: 'Out', ano: 2023, horas: 999.26 },
    { mes: 'Nov', ano: 2023, horas: 1014.69 },
    { mes: 'Dez', ano: 2023, horas: 1176.67 },
    // 2024
    { mes: 'Jan', ano: 2024, horas: 1144.00 },
    { mes: 'Fev', ano: 2024, horas: 1059.58 },
    { mes: 'Mar', ano: 2024, horas: 1258.34 },
    { mes: 'Abr', ano: 2024, horas: 1107.10 },
    { mes: 'Mai', ano: 2024, horas: 1187.00 },
    { mes: 'Jun', ano: 2024, horas: 1288.76 },
    { mes: 'Jul', ano: 2024, horas: 1251.34 },
    { mes: 'Ago', ano: 2024, horas: 844.34 },
    { mes: 'Set', ano: 2024, horas: 1101.42 },
    { mes: 'Out', ano: 2024, horas: 1187.25 },
    { mes: 'Nov', ano: 2024, horas: 1093.33 },
    { mes: 'Dez', ano: 2024, horas: 1081.42 },
    // 2025
    { mes: 'Jan', ano: 2025, horas: 1115.75 },
    { mes: 'Fev', ano: 2025, horas: 966.26 },
    { mes: 'Mar', ano: 2025, horas: 1224.92 },
    { mes: 'Abr', ano: 2025, horas: 936.86 },
    { mes: 'Mai', ano: 2025, horas: 1065.65 },
    { mes: 'Jun', ano: 2025, horas: 927.09 },
    { mes: 'Jul', ano: 2025, horas: 1008.58 },
    { mes: 'Ago', ano: 2025, horas: 1004.09 },
    { mes: 'Set', ano: 2025, horas: 868.60 },
    { mes: 'Out', ano: 2025, horas: 951.67 },
    { mes: 'Nov', ano: 2025, horas: 808.08 },
    { mes: 'Dez', ano: 2025, horas: 899.00 },
    // 2026
    { mes: 'Jan', ano: 2026, horas: 935.42 },
    { mes: 'Fev', ano: 2026, horas: 832.17 },
    { mes: 'Mar', ano: 2026, horas: 910.41 },
    { mes: 'Abr', ano: 2026, horas: 815.99 },
    { mes: 'Mai', ano: 2026, horas: 997.58 },
  ],
  'shopping-analia-franco': [
    // 2023 - Unidade iniciou atividades no FINAL de Junho/2023; Jun/23 é omitido
    // de propósito (mês parcial distorce o gráfico).
    { mes: 'Jul', ano: 2023, horas: 1119.5 },
    { mes: 'Ago', ano: 2023, horas: 936.8 },
    { mes: 'Set', ano: 2023, horas: 950.5 },
    { mes: 'Out', ano: 2023, horas: 1226.0 },
    { mes: 'Nov', ano: 2023, horas: 1124.0 },
    { mes: 'Dez', ano: 2023, horas: 1444.0 },
    // 2024
    { mes: 'Jan', ano: 2024, horas: 1021.3 },
    { mes: 'Fev', ano: 2024, horas: 990.3 },
    { mes: 'Mar', ano: 2024, horas: 1207.3 },
    { mes: 'Abr', ano: 2024, horas: 1089.5 },
    { mes: 'Mai', ano: 2024, horas: 1367.3 },
    { mes: 'Jun', ano: 2024, horas: 1096.5 },
    { mes: 'Jul', ano: 2024, horas: 1038.0 },
    { mes: 'Ago', ano: 2024, horas: 1113.0 },
    { mes: 'Set', ano: 2024, horas: 1158.3 },
    { mes: 'Out', ano: 2024, horas: 1328.8 },
    { mes: 'Nov', ano: 2024, horas: 1288.3 },
    { mes: 'Dez', ano: 2024, horas: 1489.0 },
    // 2025
    { mes: 'Jan', ano: 2025, horas: 1192.8 },
    { mes: 'Fev', ano: 2025, horas: 997.3 },
    { mes: 'Mar', ano: 2025, horas: 1137.0 },
    { mes: 'Abr', ano: 2025, horas: 1010.0 },
    { mes: 'Mai', ano: 2025, horas: 1201.8 },
    { mes: 'Jun', ano: 2025, horas: 950.0 },
    { mes: 'Jul', ano: 2025, horas: 875.3 },
    { mes: 'Ago', ano: 2025, horas: 981.5 },
    { mes: 'Set', ano: 2025, horas: 950.5 },
    { mes: 'Out', ano: 2025, horas: 1071.5 },
    { mes: 'Nov', ano: 2025, horas: 1074.8 },
    { mes: 'Dez', ano: 2025, horas: 1246.3 },
    // 2026
    { mes: 'Jan', ano: 2026, horas: 1018.58 },
    { mes: 'Fev', ano: 2026, horas: 854.41 },
    { mes: 'Mar', ano: 2026, horas: 1091.75 },
    { mes: 'Abr', ano: 2026, horas: 973.00 },
    { mes: 'Mai', ano: 2026, horas: 1170.58 },
  ],
  'perdizes': [
    // 2023
    { mes: 'Jan', ano: 2023, horas: 1069.4 },
    { mes: 'Fev', ano: 2023, horas: 1115.1 },
    { mes: 'Mar', ano: 2023, horas: 1170.3 },
    { mes: 'Abr', ano: 2023, horas: 1131.9 },
    { mes: 'Mai', ano: 2023, horas: 1148.8 },
    { mes: 'Jun', ano: 2023, horas: 985.2 },
    { mes: 'Jul', ano: 2023, horas: 1082.4 },
    { mes: 'Ago', ano: 2023, horas: 1135.8 },
    { mes: 'Set', ano: 2023, horas: 1043.5 },
    { mes: 'Out', ano: 2023, horas: 1229.0 },
    { mes: 'Nov', ano: 2023, horas: 1290.8 },
    { mes: 'Dez', ano: 2023, horas: 1451.0 },
    // 2024
    { mes: 'Jan', ano: 2024, horas: 1123.4 },
    { mes: 'Fev', ano: 2024, horas: 1098.7 },
    { mes: 'Mar', ano: 2024, horas: 1294.8 },
    { mes: 'Abr', ano: 2024, horas: 1214.8 },
    { mes: 'Mai', ano: 2024, horas: 1335.0 },
    { mes: 'Jun', ano: 2024, horas: 1168.5 },
    { mes: 'Jul', ano: 2024, horas: 1045.2 },
    { mes: 'Ago', ano: 2024, horas: 1072.5 },
    { mes: 'Set', ano: 2024, horas: 1211.1 },
    { mes: 'Out', ano: 2024, horas: 1147.5 },
    { mes: 'Nov', ano: 2024, horas: 1257.0 },
    { mes: 'Dez', ano: 2024, horas: 1468.0 },
    // 2025
    { mes: 'Jan', ano: 2025, horas: 1245.6 },
    { mes: 'Fev', ano: 2025, horas: 1054.0 },
    { mes: 'Mar', ano: 2025, horas: 1172.0 },
    { mes: 'Abr', ano: 2025, horas: 1015.0 },
    { mes: 'Mai', ano: 2025, horas: 1190.7 },
    { mes: 'Jun', ano: 2025, horas: 1043.0 },
    { mes: 'Jul', ano: 2025, horas: 927.4 },
    { mes: 'Ago', ano: 2025, horas: 1053.5 },
    { mes: 'Set', ano: 2025, horas: 1023.3 },
    { mes: 'Out', ano: 2025, horas: 1132.4 },
    { mes: 'Nov', ano: 2025, horas: 1008.3 },
    { mes: 'Dez', ano: 2025, horas: 1383.2 },
    // 2026
    { mes: 'Jan', ano: 2026, horas: 1005.66 },
    { mes: 'Fev', ano: 2026, horas: 955.90 },
    { mes: 'Mar', ano: 2026, horas: 966.08 },
    { mes: 'Abr', ano: 2026, horas: 872.62 },
    { mes: 'Mai', ano: 2026, horas: 952.75 },
  ],
  'tatuape-gomescardim': [
    // 2025 - Unidade iniciou atividades em Julho/2025
    { mes: 'Jul', ano: 2025, horas: 251.3 },
    { mes: 'Ago', ano: 2025, horas: 591.5 },
    { mes: 'Set', ano: 2025, horas: 564.0 },
    { mes: 'Out', ano: 2025, horas: 665.8 },
    { mes: 'Nov', ano: 2025, horas: 616.5 },
    { mes: 'Dez', ano: 2025, horas: 904.5 },
    // 2026
    { mes: 'Jan', ano: 2026, horas: 599.83 },
    { mes: 'Fev', ano: 2026, horas: 539.91 },
    { mes: 'Mar', ano: 2026, horas: 602.66 },
    { mes: 'Abr', ano: 2026, horas: 556.66 },
    { mes: 'Mai', ano: 2026, horas: 686.16 },
  ],
  'mooca-plaza': [
    // 2023
    { mes: 'Jan', ano: 2023, horas: 792.5 },
    { mes: 'Fev', ano: 2023, horas: 760.3 },
    { mes: 'Mar', ano: 2023, horas: 772.0 },
    { mes: 'Abr', ano: 2023, horas: 790.5 },
    { mes: 'Mai', ano: 2023, horas: 829.7 },
    { mes: 'Jun', ano: 2023, horas: 664.5 },
    { mes: 'Jul', ano: 2023, horas: 730.5 },
    { mes: 'Ago', ano: 2023, horas: 790.0 },
    { mes: 'Set', ano: 2023, horas: 795.0 },
    { mes: 'Out', ano: 2023, horas: 978.8 },
    { mes: 'Nov', ano: 2023, horas: 1027.8 },
    { mes: 'Dez', ano: 2023, horas: 1254.0 },
    // 2024
    { mes: 'Jan', ano: 2024, horas: 723.0 },
    { mes: 'Fev', ano: 2024, horas: 742.8 },
    { mes: 'Mar', ano: 2024, horas: 876.8 },
    { mes: 'Abr', ano: 2024, horas: 953.3 },
    { mes: 'Mai', ano: 2024, horas: 1098.0 },
    { mes: 'Jun', ano: 2024, horas: 883.8 },
    { mes: 'Jul', ano: 2024, horas: 768.0 },
    { mes: 'Ago', ano: 2024, horas: 784.8 },
    { mes: 'Set', ano: 2024, horas: 868.5 },
    { mes: 'Out', ano: 2024, horas: 960.8 },
    { mes: 'Nov', ano: 2024, horas: 952.5 },
    { mes: 'Dez', ano: 2024, horas: 1198.5 },
    // 2025
    { mes: 'Jan', ano: 2025, horas: 869.8 },
    { mes: 'Fev', ano: 2025, horas: 747.8 },
    { mes: 'Mar', ano: 2025, horas: 899.0 },
    { mes: 'Abr', ano: 2025, horas: 743.8 },
    { mes: 'Mai', ano: 2025, horas: 1003.5 },
    { mes: 'Jun', ano: 2025, horas: 714.8 },
    { mes: 'Jul', ano: 2025, horas: 670.5 },
    { mes: 'Ago', ano: 2025, horas: 756.3 },
    { mes: 'Set', ano: 2025, horas: 745.5 },
    { mes: 'Out', ano: 2025, horas: 894.0 },
    { mes: 'Nov', ano: 2025, horas: 843.3 },
    { mes: 'Dez', ano: 2025, horas: 1084.8 },
    // 2026
    { mes: 'Jan', ano: 2026, horas: 723.16 },
    { mes: 'Fev', ano: 2026, horas: 695.74 },
    { mes: 'Mar', ano: 2026, horas: 858.99 },
    { mes: 'Abr', ano: 2026, horas: 704.08 },
    { mes: 'Mai', ano: 2026, horas: 978.74 },
  ],
  'higienopolis': [
    // 2023
    { mes: 'Jan', ano: 2023, horas: 1704.6 },
    { mes: 'Fev', ano: 2023, horas: 1626.3 },
    { mes: 'Mar', ano: 2023, horas: 1677.2 },
    { mes: 'Abr', ano: 2023, horas: 1551.5 },
    { mes: 'Mai', ano: 2023, horas: 1471.0 },
    { mes: 'Jun', ano: 2023, horas: 1482.3 },
    { mes: 'Jul', ano: 2023, horas: 1484.0 },
    { mes: 'Ago', ano: 2023, horas: 1610.7 },
    { mes: 'Set', ano: 2023, horas: 1518.8 },
    { mes: 'Out', ano: 2023, horas: 1521.7 },
    { mes: 'Nov', ano: 2023, horas: 1560.3 },
    { mes: 'Dez', ano: 2023, horas: 1666.0 },
    // 2024
    { mes: 'Jan', ano: 2024, horas: 1517.9 },
    { mes: 'Fev', ano: 2024, horas: 1427.5 },
    { mes: 'Mar', ano: 2024, horas: 1673.4 },
    { mes: 'Abr', ano: 2024, horas: 1474.2 },
    { mes: 'Mai', ano: 2024, horas: 1545.0 },
    { mes: 'Jun', ano: 2024, horas: 1570.8 },
    { mes: 'Jul', ano: 2024, horas: 1541.6 },
    { mes: 'Ago', ano: 2024, horas: 1647.2 },
    { mes: 'Set', ano: 2024, horas: 1530.3 },
    { mes: 'Out', ano: 2024, horas: 1813.9 },
    { mes: 'Nov', ano: 2024, horas: 1637.6 },
    { mes: 'Dez', ano: 2024, horas: 1614.3 },
    // 2025
    { mes: 'Jan', ano: 2025, horas: 1654.4 },
    { mes: 'Fev', ano: 2025, horas: 1537.7 },
    { mes: 'Mar', ano: 2025, horas: 1661.2 },
    { mes: 'Abr', ano: 2025, horas: 1578.7 },
    { mes: 'Mai', ano: 2025, horas: 1666.2 },
    { mes: 'Jun', ano: 2025, horas: 1477.4 },
    { mes: 'Jul', ano: 2025, horas: 1340.8 },
    { mes: 'Ago', ano: 2025, horas: 1394.8 },
    { mes: 'Set', ano: 2025, horas: 1309.7 },
    { mes: 'Out', ano: 2025, horas: 1425.3 },
    { mes: 'Nov', ano: 2025, horas: 1386.2 },
    { mes: 'Dez', ano: 2025, horas: 1253.7 },
    // 2026
    { mes: 'Jan', ano: 2026, horas: 1223.74 },
    { mes: 'Fev', ano: 2026, horas: 1161.16 },
    { mes: 'Mar', ano: 2026, horas: 1158.49 },
    { mes: 'Abr', ano: 2026, horas: 979.24 },
    { mes: 'Mai', ano: 2026, horas: 1119.10 },
  ],
}

export default async function HistoricoPage({ params }: Props) {
  const { unidade } = await params
  const unidadeNome = getUnidadeNome(unidade)

  if (!unidadeNome) {
    notFound()
  }

  // Obter dados históricos base
  let historico = [...(dadosHistoricoCaixa[unidade] || [])]
  let historicoHoras = [...(dadosHistoricoHoras[unidade] || [])]

  // Só os meses FECHADOS do ano atual entram no histórico. O mês corrente NÃO é
  // representado (parcial, distorce a escala do gráfico) — e não representá-lo também
  // elimina a busca ao vivo no Belle a cada abertura, deixando a página rápida.
  //
  // Meses fechados completos no hardcoded (com caixa E horas) são mantidos. Os
  // incompletos (ex.: Jun/26, que tinha caixa parcial e nenhuma hora) ou ausentes
  // (Jul/Ago) são puxados do Belle UMA vez e guardados em FaturamentoHistorico —
  // aberturas seguintes vêm do cache (rápido, sem chamar o Belle).
  const credenciais = getUnidadeCredenciais(unidade)
  if (credenciais) {
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1 // 1-12
    const anoAtual = hoje.getFullYear()
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    for (let m = 1; m < mesAtual; m++) { // "< mesAtual" exclui o mês corrente
      const mesNome = nomesMeses[m - 1]
      const cx = historico.find(h => h.mes === mesNome && h.ano === anoAtual)
      const hr = historicoHoras.find(h => h.mes === mesNome && h.ano === anoAtual)
      // Já completo no hardcoded (caixa E horas)? mantém, não chama o Belle.
      if (cx && hr) continue

      try {
        let caixa: number | undefined
        let horas: number | undefined

        // Tenta o cache no banco primeiro
        const cache = await prisma.faturamentoHistorico.findUnique({
          where: { unidadeSlug_ano_mes: { unidadeSlug: unidade, ano: anoAtual, mes: m } },
        })
        if (cache && (cache.caixa > 0 || cache.horas > 0)) { caixa = cache.caixa; horas = cache.horas }

        // Sem cache: puxa o MÊS FECHADO INTEIRO do Belle e guarda
        if (caixa === undefined) {
          const mm = String(m).padStart(2, '0')
          const dataIni = `${anoAtual}-${mm}-01`
          const ultimoDia = new Date(anoAtual, m, 0).getDate()
          const dataFim = `${anoAtual}-${mm}-${String(ultimoDia).padStart(2, '0')}`
          const f = await getFaturamentoMensal(credenciais.email, credenciais.password, String(credenciais.estab), dataIni, dataFim)
          caixa = f.caixa
          horas = f.horasAtendimento
          if ((caixa ?? 0) > 0 || (horas ?? 0) > 0) {
            await prisma.faturamentoHistorico.upsert({
              where: { unidadeSlug_ano_mes: { unidadeSlug: unidade, ano: anoAtual, mes: m } },
              create: { unidadeSlug: unidade, ano: anoAtual, mes: m, caixa: caixa ?? 0, horas: horas ?? 0 },
              update: { caixa: caixa ?? 0, horas: horas ?? 0 },
            })
          }
        }

        // Mescla só se veio dado real (senão mantém o fallback do hardcoded)
        if (caixa !== undefined && ((caixa ?? 0) > 0 || (horas ?? 0) > 0)) {
          if (cx) cx.caixa = caixa; else historico.push({ mes: mesNome, ano: anoAtual, caixa })
          if (hr) hr.horas = horas ?? 0; else historicoHoras.push({ mes: mesNome, ano: anoAtual, horas: horas ?? 0 })
        }
      } catch (error) {
        console.error(`[historico] falha ${unidade} ${anoAtual}-${m}:`, error)
        // segue com o que tem (fallback do hardcoded)
      }
    }
  }

  // Transformar dados em formato pivotado (meses x anos) - CAIXA
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const anos = [...new Set(historico.map(h => h.ano))].sort()

  // Criar matriz pivotada - CAIXA
  const dadosPivotados = meses.map(mes => {
    const linhaMes: { mes: string; valores: Record<number, number | null> } = {
      mes,
      valores: {}
    }
    anos.forEach(ano => {
      const dado = historico.find(h => h.mes === mes && h.ano === ano)
      linhaMes.valores[ano] = dado ? dado.caixa : null
    })
    return linhaMes
  })

  // Calcular totais por ano - CAIXA
  const totaisPorAno: Record<number, number> = {}
  anos.forEach(ano => {
    totaisPorAno[ano] = historico
      .filter(h => h.ano === ano)
      .reduce((acc, h) => acc + h.caixa, 0)
  })

  // Transformar dados em formato pivotado (meses x anos) - HORAS
  const anosHoras = [...new Set(historicoHoras.map(h => h.ano))].sort()

  // Criar matriz pivotada - HORAS
  const dadosPivotadosHoras = meses.map(mes => {
    const linhaMes: { mes: string; valores: Record<number, number | null> } = {
      mes,
      valores: {}
    }
    anosHoras.forEach(ano => {
      const dado = historicoHoras.find(h => h.mes === mes && h.ano === ano)
      linhaMes.valores[ano] = dado ? dado.horas : null
    })
    return linhaMes
  })

  // Calcular totais por ano - HORAS
  const totaisPorAnoHoras: Record<number, number> = {}
  anosHoras.forEach(ano => {
    totaisPorAnoHoras[ano] = historicoHoras
      .filter(h => h.ano === ano)
      .reduce((acc, h) => acc + h.horas, 0)
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#7E0000]">
          {unidadeNome.toUpperCase()}
        </h1>
      </div>

      {/* Gráfico e Tabela lado a lado */}
      {historico.length > 0 ? (
        <div className="flex gap-4">
          {/* Gráfico (Esquerda) - 70% */}
          <div className="flex-[7] bg-white rounded-lg shadow-sm border border-[#392617]/20 p-6 min-w-0">
            <h2 className="text-lg font-semibold text-[#7E0000] mb-4">
              Recebido em Caixa (R$)
            </h2>
            <HistoricoChart historico={historico} />
          </div>

          {/* Tabela (Direita) - 30% */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-[#392617]/20 p-4 min-w-0">
            <h2 className="text-base font-semibold text-[#7E0000] mb-3">
              Recebido em Caixa (R$)
            </h2>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <table className="border-collapse w-full">
            <thead>
              <tr className="bg-[#2B4C7E] text-white">
                <th className="px-1.5 py-1.5 text-left text-[10px] font-bold border border-[#392617]/55 whitespace-nowrap">
                  Mês
                </th>
                {anos.map(ano => (
                  <th key={ano} className="px-1.5 py-1.5 text-center text-[10px] font-bold border border-[#392617]/55 whitespace-nowrap">
                    {ano}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={anos.length + 1} className="px-6 py-12 text-center text-[#392617]/75">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-12 h-12 text-[#392617]/35"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-sm font-medium">Nenhum dado histórico disponível</p>
                      <p className="text-xs text-[#392617]/55">
                        Os dados serão carregados em breve
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {dadosPivotados.map((linha, idx) => (
                    <tr key={linha.mes} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#392617]/8'}>
                      <td className="px-1.5 py-0.5 text-[10px] font-medium text-[#392617] border border-[#392617]/35 whitespace-nowrap">
                        {linha.mes}
                      </td>
                      {anos.map(ano => (
                        <td key={ano} className="px-1.5 py-0.5 text-[10px] text-right border border-[#392617]/35 whitespace-nowrap">
                          {linha.valores[ano] !== null ? (
                            <span className="font-medium text-[#392617]">
                              {(linha.valores[ano]! / 1000).toFixed(0)}k
                            </span>
                          ) : (
                            <span className="text-[#392617]/55">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Linha de TOTAL */}
                  <tr className="bg-[#2B4C7E] text-white font-bold">
                    <td className="px-1.5 py-1.5 text-[10px] border border-[#392617]/55 whitespace-nowrap">
                      TOTAL
                    </td>
                    {anos.map(ano => (
                      <td key={ano} className="px-1.5 py-1.5 text-[10px] text-right border border-[#392617]/55 whitespace-nowrap">
                        {(totaisPorAno[ano] / 1000).toFixed(0)}k
                      </td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-[#392617]/20 p-12 text-center">
          <p className="text-[#392617]/75">Nenhum dado histórico disponível</p>
        </div>
      )}

      {/* Horas de Atendimento - Gráfico e Tabela lado a lado */}
      {historicoHoras.length > 0 ? (
        <div className="flex gap-4">
          {/* Gráfico (Esquerda) - 70% */}
          <div className="flex-[7] bg-white rounded-lg shadow-sm border border-[#392617]/20 p-6 min-w-0">
            <h2 className="text-lg font-semibold text-[#7E0000] mb-4">
              Horas de Atendimento
            </h2>
            <HistoricoChartHoras historico={historicoHoras} />
          </div>

          {/* Tabela (Direita) - 30% */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-[#392617]/20 p-4 min-w-0">
            <h2 className="text-base font-semibold text-[#7E0000] mb-3">
              Horas de Atendimento
            </h2>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <table className="border-collapse w-full">
            <thead>
              <tr className="bg-[#2B4C7E] text-white">
                <th className="px-1.5 py-1.5 text-left text-[10px] font-bold border border-[#392617]/55 whitespace-nowrap">
                  Mês
                </th>
                {anosHoras.map(ano => (
                  <th key={ano} className="px-1.5 py-1.5 text-center text-[10px] font-bold border border-[#392617]/55 whitespace-nowrap">
                    {ano}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historicoHoras.length === 0 ? (
                <tr>
                  <td colSpan={anosHoras.length + 1} className="px-6 py-12 text-center text-[#392617]/75">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-12 h-12 text-[#392617]/35"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-sm font-medium">Nenhum dado histórico disponível</p>
                      <p className="text-xs text-[#392617]/55">
                        Os dados serão carregados em breve
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {dadosPivotadosHoras.map((linha, idx) => (
                    <tr key={linha.mes} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#392617]/8'}>
                      <td className="px-1.5 py-0.5 text-[10px] font-medium text-[#392617] border border-[#392617]/35 whitespace-nowrap">
                        {linha.mes}
                      </td>
                      {anosHoras.map(ano => (
                        <td key={ano} className="px-1.5 py-0.5 text-[10px] text-right border border-[#392617]/35 whitespace-nowrap">
                          {linha.valores[ano] !== null ? (
                            <span className="font-medium text-[#392617]">
                              {linha.valores[ano]!.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[#392617]/55">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Linha de TOTAL */}
                  <tr className="bg-[#2B4C7E] text-white font-bold">
                    <td className="px-1.5 py-1.5 text-[10px] border border-[#392617]/55 whitespace-nowrap">
                      TOTAL
                    </td>
                    {anosHoras.map(ano => (
                      <td key={ano} className="px-1.5 py-1.5 text-[10px] text-right border border-[#392617]/55 whitespace-nowrap">
                        {totaisPorAnoHoras[ano].toFixed(1)}
                      </td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
