import { getFaturamentoMensal, somarEntradasCaixa103 } from '@/lib/belle/bi'
import { getToken } from '@/lib/belle/client-auth'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'

// Faturamento CAIXA do mês (base do royalties/mkt), puxado do Belle.
// Reusa `getFaturamentoMensal` do bi.ts — a lógica de produção, que achata as
// totalizações aninhadas do Belle e lê "total recebido em caixa" corretamente.

export async function getFaturamentoCaixaMes(unidadeSlug: string, ano: number, mes: number): Promise<number> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Sem credencial Belle para "${unidadeSlug}"`)

  const mm = String(mes).padStart(2, '0')
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dataIni = `${ano}-${mm}-01`
  const dataFim = `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}`

  const f = await getFaturamentoMensal(cred.email, cred.password, String(cred.estab), dataIni, dataFim)
  return Math.round((f.caixa + Number.EPSILON) * 100) / 100
}

// Caixa por DATA DE CONFIRMAÇÃO (Report 103, entradas − parcerias) — a MESMA fonte
// "Recebido em Caixa" do Radar Geral/dashboard. É o que o NF Salão Parceiro usa na base
// (o Report 184 dava um valor por data de venda, ligeiramente diferente).
export async function getFaturamentoCaixaConfirmacaoMes(unidadeSlug: string, ano: number, mes: number): Promise<number> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Sem credencial Belle para "${unidadeSlug}"`)
  const mm = String(mes).padStart(2, '0')
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dataIni = `${ano}-${mm}-01`
  const dataFim = `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}`
  const token = await getToken(cred.email, cred.password)
  const caixa = await somarEntradasCaixa103(token, String(cred.estab), dataIni, dataFim)
  return Math.round((caixa + Number.EPSILON) * 100) / 100
}
