'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { HeartHandshake, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

// Cores por parceria (diferenciação visual). TotalPass = marsala, Gympass = dourado.
const TP = { bg: 'bg-[#7E0000]/[0.06]', txt: 'text-[#7E0000]', badge: 'bg-[#7E0000]/10 text-[#7E0000]' }
const GP = { bg: 'bg-[#D78B18]/[0.14]', txt: 'text-[#8a5a00]', badge: 'bg-[#D78B18]/20 text-[#8a5a00]' }
const TOT = { bg: 'bg-[#425F1D]/[0.08]', txt: 'text-[#425F1D]' }

interface Atend { data: string; cliente: string; servico: string; responsavel: string }
interface Bloco { qtd: number; bruto: number; liquido: number; atendimentos: Atend[] }
interface Linha { slug: string; nome: string; totalpass: Bloco; gympass: Bloco }
interface Tot { qtd: number; bruto: number; liquido: number }
interface Dados { ano: number; mes: number; parcerias: { chave: string; nome: string; bruto: number; liquido: number }[]; pagamentoEm: string; linhas: Linha[]; totais: { totalpass: Tot; gympass: Tot; geral: Tot } }

function mesRefPadrao() {
  const d = new Date(); let mes = d.getMonth(); let ano = d.getFullYear()
  if (mes === 0) { mes = 12; ano -= 1 }
  return { ano, mes }
}

export default function ParceriasPage() {
  const ini = mesRefPadrao()
  const [ano, setAno] = useState(ini.ano)
  const [mes, setMes] = useState(ini.mes)
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setAberta(null)
    try {
      const r = await fetch(`/api/financeiro/parcerias?ano=${ano}&mes=${mes}`)
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao carregar'); setDados(null); return }
      setDados(j)
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])

  const mudarMes = (d: number) => { let m = mes + d, a = ano; if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }; setMes(m); setAno(a) }
  const pag = dados?.pagamentoEm ? `${dados.pagamentoEm.slice(8, 10)}/${dados.pagamentoEm.slice(5, 7)}/${dados.pagamentoEm.slice(0, 4)}` : ''
  const vTP = dados?.parcerias.find(p => p.chave === 'totalpass')
  const vGP = dados?.parcerias.find(p => p.chave === 'gympass')

  // Detalhe combinado de uma unidade: atendimentos das 2 parcerias, com etiqueta, por data.
  const detalhe = (l: Linha) => [
    ...l.totalpass.atendimentos.map(a => ({ ...a, parceria: 'TotalPass', bruto: vTP?.bruto ?? 0, liquido: vTP?.liquido ?? 0, cls: TP })),
    ...l.gympass.atendimentos.map(a => ({ ...a, parceria: 'Gympass', bruto: vGP?.bruto ?? 0, liquido: vGP?.liquido ?? 0, cls: GP })),
  ].sort((a, b) => a.data.localeCompare(b.data))

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <HeartHandshake className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Reembolso de Parcerias</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-4">
        Atendimentos de parceria no mês — pagos no dia <b>20 do mês seguinte</b>.
        {dados && <> Referência {MESES[dados.mes]}/{dados.ano} → pagamento em <b>{pag}</b>.</>}
        {vTP && vGP && <> Por atendimento: <b className="text-[#7E0000]">TotalPass</b> {brl(vTP.bruto)}/{brl(vTP.liquido)} · <b className="text-[#8a5a00]">Gympass</b> {brl(vGP.bruto)}/{brl(vGP.liquido)} (bruto/líquido).</>}
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
        <p className="text-sm text-[#392617]/50">Sem atendimentos de parceria neste mês.</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide">
                <th rowSpan={2} className="px-4 py-2 text-left align-bottom bg-[#E4E5E2] text-[#7E0000]">Unidade</th>
                <th colSpan={3} className={`px-3 py-1.5 text-center ${TP.bg} ${TP.txt} border-l border-white`}>TotalPass</th>
                <th colSpan={3} className={`px-3 py-1.5 text-center ${GP.bg} ${GP.txt} border-l border-white`}>Gympass</th>
                <th colSpan={2} className={`px-3 py-1.5 text-center ${TOT.bg} ${TOT.txt} border-l border-white`}>Total a receber</th>
                <th rowSpan={2} className="bg-[#E4E5E2] w-8"></th>
              </tr>
              <tr className="text-[10px] uppercase tracking-wide text-[#392617]/60">
                <th className={`px-3 py-1.5 text-center ${TP.bg} border-l border-white`}>Qtd</th>
                <th className={`px-3 py-1.5 text-right ${TP.bg}`}>Bruto</th>
                <th className={`px-3 py-1.5 text-right ${TP.bg}`}>Líquido</th>
                <th className={`px-3 py-1.5 text-center ${GP.bg} border-l border-white`}>Qtd</th>
                <th className={`px-3 py-1.5 text-right ${GP.bg}`}>Bruto</th>
                <th className={`px-3 py-1.5 text-right ${GP.bg}`}>Líquido</th>
                <th className={`px-3 py-1.5 text-right ${TOT.bg} border-l border-white`}>Bruto</th>
                <th className={`px-3 py-1.5 text-right ${TOT.bg}`}>Líquido</th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((l) => {
                const totBruto = l.totalpass.bruto + l.gympass.bruto
                const totLiq = l.totalpass.liquido + l.gympass.liquido
                const temAtd = l.totalpass.qtd + l.gympass.qtd > 0
                return (
                  <Fragment key={l.slug}>
                    <tr className={`border-t border-[#DDC7A4]/40 ${temAtd ? 'cursor-pointer hover:bg-[#7E0000]/[0.02]' : ''} ${aberta === l.slug ? 'bg-[#7E0000]/[0.02]' : ''}`}
                      onClick={() => temAtd && setAberta(aberta === l.slug ? null : l.slug)}>
                      <td className="px-4 py-2.5 font-medium text-[#392617]">{l.nome}</td>
                      <td className={`px-3 py-2.5 text-center ${TP.bg}`}>{l.totalpass.qtd || '—'}</td>
                      <td className={`px-3 py-2.5 text-right ${TP.bg} text-[#392617]/80`}>{l.totalpass.bruto ? brl(l.totalpass.bruto) : '—'}</td>
                      <td className={`px-3 py-2.5 text-right ${TP.bg} font-medium ${TP.txt}`}>{l.totalpass.liquido ? brl(l.totalpass.liquido) : '—'}</td>
                      <td className={`px-3 py-2.5 text-center ${GP.bg}`}>{l.gympass.qtd || '—'}</td>
                      <td className={`px-3 py-2.5 text-right ${GP.bg} text-[#392617]/80`}>{l.gympass.bruto ? brl(l.gympass.bruto) : '—'}</td>
                      <td className={`px-3 py-2.5 text-right ${GP.bg} font-medium ${GP.txt}`}>{l.gympass.liquido ? brl(l.gympass.liquido) : '—'}</td>
                      <td className={`px-3 py-2.5 text-right ${TOT.bg} text-[#392617]/80`}>{totBruto ? brl(totBruto) : '—'}</td>
                      <td className={`px-3 py-2.5 text-right ${TOT.bg} font-semibold ${TOT.txt}`}>{totLiq ? brl(totLiq) : '—'}</td>
                      <td className="px-2 text-[#7E0000]">{temAtd && (aberta === l.slug ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}</td>
                    </tr>
                    {aberta === l.slug && temAtd && (
                      <tr className="bg-[#F5F0EB]/60">
                        <td colSpan={10} className="px-4 py-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[#392617]/50">
                                <th className="py-1 w-24">Parceria</th><th className="py-1 w-12">Dia</th><th className="py-1">Cliente</th>
                                <th className="py-1">Serviço</th><th className="py-1">Terapeuta</th>
                                <th className="py-1 text-right w-20">Bruto</th><th className="py-1 text-right w-20">Líquido</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalhe(l).map((a, i) => (
                                <tr key={i} className="border-t border-[#DDC7A4]/30">
                                  <td className="py-1"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${a.cls.badge}`}>{a.parceria}</span></td>
                                  <td className="py-1 text-[#392617]/70">{diaBR(a.data)}</td>
                                  <td className="py-1 text-[#392617]">{a.cliente}</td>
                                  <td className="py-1 text-[#392617]/80">{a.servico || '—'}</td>
                                  <td className="py-1 text-[#392617]/60">{a.responsavel || '—'}</td>
                                  <td className="py-1 text-right text-[#392617]/70">{brl(a.bruto)}</td>
                                  <td className={`py-1 text-right ${a.cls.txt}`}>{brl(a.liquido)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {/* Totais */}
              <tr className="border-t-2 border-[#7E0000]/30 font-bold text-[#392617]">
                <td className="px-4 py-2.5">Total</td>
                <td className={`px-3 py-2.5 text-center ${TP.bg} ${TP.txt}`}>{dados.totais.totalpass.qtd}</td>
                <td className={`px-3 py-2.5 text-right ${TP.bg} ${TP.txt}`}>{brl(dados.totais.totalpass.bruto)}</td>
                <td className={`px-3 py-2.5 text-right ${TP.bg} ${TP.txt}`}>{brl(dados.totais.totalpass.liquido)}</td>
                <td className={`px-3 py-2.5 text-center ${GP.bg} ${GP.txt}`}>{dados.totais.gympass.qtd}</td>
                <td className={`px-3 py-2.5 text-right ${GP.bg} ${GP.txt}`}>{brl(dados.totais.gympass.bruto)}</td>
                <td className={`px-3 py-2.5 text-right ${GP.bg} ${GP.txt}`}>{brl(dados.totais.gympass.liquido)}</td>
                <td className={`px-3 py-2.5 text-right ${TOT.bg} ${TOT.txt}`}>{brl(dados.totais.geral.bruto)}</td>
                <td className="px-3 py-2.5 text-right bg-[#D78B18]/20 text-[#425F1D]">{brl(dados.totais.geral.liquido)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
