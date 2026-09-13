'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift, Loader2, RefreshCw, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'

interface Item { codigo: string; nome: string; valor: number; dataUtilizacao: string | null }
interface UnidadeCort {
  unidadeId: number; nome: string; slug: string
  valorMensalPermutavel: number; limiteAcumulo: number; saldoInicial: number
  saldoAnterior: number; creditoInicial: number; cortesiaUsada: number
  cortesiaReembolso: number; saldoAcumulado: number
  itens: Item[]
}
interface Resp { ano: number; mes: number; unidades: UnidadeCort[]; totais: { usado: number; aReembolsar: number } }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function mesAnterior() {
  const d = new Date()
  let mes = d.getMonth(), ano = d.getFullYear()
  if (mes === 0) { mes = 12; ano -= 1 }
  return { ano, mes }
}

export default function CortesiasPage() {
  const ini = mesAnterior()
  const [ano, setAno] = useState(ini.ano)
  const [mes, setMes] = useState(ini.mes)
  const [resp, setResp] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<Record<number, boolean>>({})
  const [edits, setEdits] = useState<Record<string, string>>({})

  const carregar = useCallback(async (a: number, m: number) => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch(`/api/reembolso/${a}/${m}/cortesias`, { cache: 'no-store' })
      if (!r.ok) { setErro(r.status === 403 ? 'Acesso restrito (somente Daniana).' : `Erro ${r.status}`); setResp(null); return }
      setResp(await r.json())
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); setResp(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar(ano, mes) }, [ano, mes, carregar])

  type CampoCfg = 'valorMensalPermutavel' | 'limiteAcumulo' | 'saldoInicial'
  const ck = (u: number, c: string) => `${u}:${c}`
  const vcfg = (u: UnidadeCort, campo: CampoCfg) => {
    const k = ck(u.unidadeId, campo)
    return edits[k] !== undefined ? edits[k] : brl(u[campo])
  }
  async function salvarConfig(unidadeId: number, campo: CampoCfg, valorStr: string) {
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0
    await fetch(`/api/reembolso/${ano}/${mes}/permuta`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadeId, [campo]: valor }),
    })
    setEdits({})
    await carregar(ano, mes)
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] w-full">
      <Link href="/reembolso" className="inline-flex items-center gap-1 text-sm text-[#7E0000] hover:underline mb-3">
        <ArrowLeft size={15} /> Voltar ao Reembolso
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-[#7E0000] flex items-center justify-center text-[#DDC7A4]"><Gift size={22} /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#392617]">Controle de Cortesias</h1>
          <p className="text-xs text-[#392617]/60">Permutas da rede — crédito mensal, uso e o que excede vira reembolso</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 mb-5">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617]">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617]">
          {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => carregar(ano, mes)} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm text-[#392617] hover:bg-[#F5F0EB] flex items-center gap-2"><RefreshCw size={15} /> Atualizar</button>
        {resp && <span className="text-sm text-[#392617]/70 ml-auto">Total usado: <b>R$ {brl(resp.totais.usado)}</b> · A reembolsar: <b className="text-[#7E0000]">R$ {brl(resp.totais.aReembolsar)}</b></span>}
      </div>

      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{erro}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#392617]/50"><Loader2 className="animate-spin mr-2" /> Carregando…</div>
      ) : resp ? (
        <div className="space-y-3">
          {resp.unidades.map((u) => {
            const temReembolso = u.cortesiaReembolso > 0
            const aberto = !!aberta[u.unidadeId]
            return (
              <div key={u.unidadeId} className={`rounded-xl border bg-white ${temReembolso ? 'border-[#7E0000]' : 'border-[#DDC7A4]'}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-[#392617]">{u.nome}</span>
                    <span className={`text-sm font-bold ${temReembolso ? 'text-[#7E0000]' : 'text-[#392617]/40'}`}>
                      {temReembolso ? `R$ ${brl(u.cortesiaReembolso)} a reembolsar` : 'dentro do crédito'}
                    </span>
                  </div>
                  {/* Config editável (muda todo ano pelo IGP-M; saldo inicial = o que já vinha acumulado) */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                    <EditBloco label="Crédito mensal" value={vcfg(u, 'valorMensalPermutavel')}
                      onChange={(v) => setEdits((p) => ({ ...p, [ck(u.unidadeId, 'valorMensalPermutavel')]: v }))}
                      onBlur={(v) => salvarConfig(u.unidadeId, 'valorMensalPermutavel', v)} />
                    <EditBloco label="Teto (acúmulo máx.)" value={vcfg(u, 'limiteAcumulo')}
                      onChange={(v) => setEdits((p) => ({ ...p, [ck(u.unidadeId, 'limiteAcumulo')]: v }))}
                      onBlur={(v) => salvarConfig(u.unidadeId, 'limiteAcumulo', v)} />
                    <EditBloco label="Saldo inicial (já vinha)" value={vcfg(u, 'saldoInicial')}
                      onChange={(v) => setEdits((p) => ({ ...p, [ck(u.unidadeId, 'saldoInicial')]: v }))}
                      onBlur={(v) => salvarConfig(u.unidadeId, 'saldoInicial', v)} />
                  </div>
                  {/* Fluxo computado do crédito (acúmulo mês a mês, limitado ao teto) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-center text-xs">
                    <Bloco label="Saldo anterior" valor={u.saldoAnterior} />
                    <Bloco label="Crédito no mês" valor={u.creditoInicial} destaque />
                    <Bloco label="Usado" valor={u.cortesiaUsada} />
                    <Bloco label="Saldo → próximo" valor={u.saldoAcumulado} />
                  </div>
                  {u.itens.length > 0 && (
                    <button onClick={() => setAberta((p) => ({ ...p, [u.unidadeId]: !aberto }))}
                      className="mt-3 inline-flex items-center gap-1 text-xs text-[#7E0000] hover:underline">
                      {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {u.itens.length} cortesia(s) usada(s)
                    </button>
                  )}
                </div>
                {aberto && u.itens.length > 0 && (
                  <div className="border-t border-[#F0E8DC] overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-[#392617]/50 text-left">
                        <th className="px-4 py-2">Código</th><th className="px-2 py-2">Serviço</th>
                        <th className="px-2 py-2">Utilização</th><th className="px-4 py-2 text-right">Valor</th>
                      </tr></thead>
                      <tbody>
                        {u.itens.map((it, i) => (
                          <tr key={i} className="border-t border-[#F5F0EB]">
                            <td className="px-4 py-1.5 font-mono text-[#392617]">{it.codigo}</td>
                            <td className="px-2 py-1.5 text-[#392617]/80">{it.nome}</td>
                            <td className="px-2 py-1.5 text-[#392617]/60">{it.dataUtilizacao || '—'}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-[#392617]">R$ {brl(it.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function Bloco({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-lg py-2 px-1 ${destaque ? 'bg-[#FBF6EF] border border-[#D78B18]/40' : 'bg-[#F5F0EB]'}`}>
      <div className="text-[#392617]/50">{label}</div>
      <div className="font-semibold text-[#392617] tabular-nums">R$ {brl(valor)}</div>
    </div>
  )
}

function EditBloco({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (v: string) => void; onBlur: (v: string) => void }) {
  return (
    <div className="rounded-lg py-2 px-1 bg-white border border-[#D78B18]/60">
      <div className="text-[#392617]/60">✎ {label}</div>
      <div className="flex items-center justify-center gap-0.5">
        <span className="text-[#392617]/40 text-[11px]">R$</span>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onBlur(e.target.value)}
          className="w-16 text-center font-semibold text-[#392617] tabular-nums bg-transparent border-0 focus:outline-none" />
      </div>
    </div>
  )
}
