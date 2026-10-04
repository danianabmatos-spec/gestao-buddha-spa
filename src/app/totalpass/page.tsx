'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { HeartHandshake, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

interface Atend { data: string; cliente: string; servico: string; responsavel: string }
interface Linha { slug: string; nome: string; qtd: number; bruto: number; liquido: number; atendimentos: Atend[] }
interface Dados { ano: number; mes: number; valores: { bruto: number; liquido: number }; pagamentoEm: string; linhas: Linha[]; totais: { qtd: number; bruto: number; liquido: number } }

// Mês de referência padrão = mês anterior (reembolso pago no dia 20 do mês seguinte).
function mesRefPadrao() {
  const d = new Date()
  let mes = d.getMonth(); let ano = d.getFullYear()
  if (mes === 0) { mes = 12; ano -= 1 }
  return { ano, mes }
}

export default function TotalPassPage() {
  const ini = mesRefPadrao()
  const [ano, setAno] = useState(ini.ano)
  const [mes, setMes] = useState(ini.mes)
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/financeiro/totalpass?ano=${ano}&mes=${mes}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao carregar'); setDados(null); return }
      setDados(j)
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])

  const mudarMes = (d: number) => { let m = mes + d, a = ano; if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }; setMes(m); setAno(a) }
  const pag = dados?.pagamentoEm ? `${dados.pagamentoEm.slice(8, 10)}/${dados.pagamentoEm.slice(5, 7)}/${dados.pagamentoEm.slice(0, 4)}` : ''

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <HeartHandshake className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Reembolso TotalPass</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">
        Atendimentos TotalPass do mês — pagos no dia <b>20 do mês seguinte</b>.
        {dados && <> Referência {MESES[dados.mes]}/{dados.ano} → pagamento em <b>{pag}</b>. R${dados.valores.bruto} bruto / R${dados.valores.liquido} líquido por atendimento.</>}
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => mudarMes(-1)} className="p-1.5 rounded hover:bg-[#7E0000]/10 text-[#7E0000]"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium min-w-[130px] text-center">{MESES[mes]} / {ano}</span>
          <button onClick={() => mudarMes(1)} className="p-1.5 rounded hover:bg-[#7E0000]/10 text-[#7E0000]"><ChevronRight size={16} /></button>
        </div>
        <button onClick={carregar} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-md border border-[#7E0000]/30 text-[#7E0000] hover:bg-[#7E0000]/5 px-3 py-1.5 text-sm">
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {erro && <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 text-sm mb-4">{erro}</div>}

      {carregando ? <p className="text-sm text-[#392617]/50">Carregando…</p> : !dados || dados.linhas.length === 0 ? (
        <p className="text-sm text-[#392617]/50">Sem atendimentos TotalPass neste mês.</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[#E4E5E2] text-left text-[#7E0000] text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5">Unidade</th>
                <th className="px-4 py-2.5 text-center">Qtd atendimentos</th>
                <th className="px-4 py-2.5 text-right">A receber (bruto)</th>
                <th className="px-4 py-2.5 text-right">A receber (líquido)</th>
                <th className="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((l) => (
                <Fragment key={l.slug}>
                  <tr className={`border-t border-[#DDC7A4]/40 cursor-pointer hover:bg-[#7E0000]/[0.03] ${aberta === l.slug ? 'bg-[#7E0000]/[0.03]' : ''}`}
                    onClick={() => setAberta(aberta === l.slug ? null : l.slug)}>
                    <td className="px-4 py-2.5 font-medium text-[#392617]">{l.nome}</td>
                    <td className="px-4 py-2.5 text-center">{l.qtd}</td>
                    <td className="px-4 py-2.5 text-right text-[#392617]">{brl(l.bruto)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-[#425F1D]">{brl(l.liquido)}</td>
                    <td className="px-4 py-2.5 text-[#7E0000]">{l.qtd > 0 && (aberta === l.slug ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}</td>
                  </tr>
                  {aberta === l.slug && l.atendimentos.length > 0 && (
                    <tr className="bg-[#F5F0EB]/60">
                      <td colSpan={5} className="px-4 py-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[#392617]/50">
                              <th className="py-1 w-14">Dia</th><th className="py-1">Cliente</th><th className="py-1">Serviço</th><th className="py-1">Terapeuta</th>
                              <th className="py-1 text-right w-20">Bruto</th><th className="py-1 text-right w-20">Líquido</th>
                            </tr>
                          </thead>
                          <tbody>
                            {l.atendimentos.map((a, i) => (
                              <tr key={i} className="border-t border-[#DDC7A4]/30">
                                <td className="py-1 text-[#392617]/70">{diaBR(a.data)}</td>
                                <td className="py-1 text-[#392617]">{a.cliente}</td>
                                <td className="py-1 text-[#392617]/80">{a.servico || '—'}</td>
                                <td className="py-1 text-[#392617]/60">{a.responsavel || '—'}</td>
                                <td className="py-1 text-right text-[#392617]/70">{brl(dados.valores.bruto)}</td>
                                <td className="py-1 text-right text-[#425F1D]">{brl(dados.valores.liquido)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              <tr className="border-t-2 border-[#7E0000]/30 font-bold text-[#7E0000]">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-center">{dados.totais.qtd}</td>
                <td className="px-4 py-2.5 text-right">{brl(dados.totais.bruto)}</td>
                <td className="px-4 py-2.5 text-right bg-[#D78B18]/15">{brl(dados.totais.liquido)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
