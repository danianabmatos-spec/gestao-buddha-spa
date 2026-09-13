import { getFaturamentoMensal } from '@/lib/belle/bi'
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
