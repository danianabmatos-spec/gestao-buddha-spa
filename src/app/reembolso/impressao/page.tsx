'use client'

import { useEffect, useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'

interface Linha {
  nome: string; vouchers: number; acrescimo7: number; omnichannel: number
  cortesiaReembolso: number; comprasEfetiva: number; treinamentoEfetivo: number
  royaltiesMkt: number; total: number
}
interface Resumo { ano: number; mes: number; status: string; linhas: Linha[]; totais: Record<string, number> }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ImpressaoPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [geradoEm, setGeradoEm] = useState('')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const ano = Number(p.get('ano')), mes = Number(p.get('mes'))
    setGeradoEm(new Date().toLocaleString('pt-BR'))
    if (!ano || !mes) { setErro('Informe ?ano= e ?mes= na URL.'); return }
    fetch(`/api/reembolso/${ano}/${mes}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status === 403 ? 'acesso restrito' : `erro ${r.status}`)))
      .then(setResumo)
      .catch((e) => setErro(String(e)))
  }, [])

  const t = resumo?.totais

  return (
    <div className="p-4 md:p-8 max-w-[1000px] w-full mx-auto bg-white">
      <style>{`@media print {
        aside, nav, .no-print { display: none !important; }
        body { background: #fff !important; }
        .print-area { box-shadow: none !important; border: none !important; }
        @page { margin: 14mm; }
      }`}</style>

      <div className="no-print mb-4 flex items-center gap-3">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-sm font-medium hover:bg-[#5c0000] flex items-center gap-2">
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
        <span className="text-xs text-[#392617]/50">Dica: em “Destino”, escolha <b>Salvar como PDF</b>.</span>
      </div>

      {erro && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{erro}</div>}

      {!resumo && !erro && <div className="flex items-center gap-2 text-[#392617]/50 py-10"><Loader2 className="animate-spin" /> Carregando…</div>}

      {resumo && (
        <div className="print-area">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b-2 border-[#7E0000] pb-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[#7E0000]">Buddha Spa — Reembolso de Vouchers</h1>
              <p className="text-sm text-[#392617]/70">Fechamento de {MESES[resumo.mes - 1]} / {resumo.ano} · pagamento dia 10</p>
            </div>
            <div className="text-right text-xs text-[#392617]/60">
              <div className={`inline-block px-2 py-0.5 rounded-full font-semibold ${resumo.status === 'FECHADO' ? 'bg-[#7E0000] text-white' : 'bg-[#425F1D]/15 text-[#425F1D]'}`}>
                {resumo.status === 'FECHADO' ? 'FECHADO' : 'ABERTO'}
              </div>
              <div className="mt-1">Gerado em {geradoEm}</div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F5F0EB] text-[#392617] text-xs">
                <th className="text-left px-2 py-2 border border-[#DDC7A4]">Unidade</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">Vouchers</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">+7%</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">Omni</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">Cortesias</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">− Compras</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">− Treino</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">− Royalties</th>
                <th className="text-right px-2 py-2 border border-[#DDC7A4]">A reembolsar</th>
              </tr>
            </thead>
            <tbody>
              {resumo.linhas.map((l, i) => (
                <tr key={i} className="text-[#392617]">
                  <td className="text-left px-2 py-1.5 border border-[#DDC7A4] font-medium">{l.nome}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{brl(l.vouchers)}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{l.acrescimo7 ? brl(l.acrescimo7) : '—'}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{l.omnichannel ? brl(l.omnichannel) : '—'}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{l.cortesiaReembolso ? brl(l.cortesiaReembolso) : '—'}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{l.comprasEfetiva ? brl(l.comprasEfetiva) : '—'}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{l.treinamentoEfetivo ? brl(l.treinamentoEfetivo) : '—'}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums">{l.royaltiesMkt ? brl(l.royaltiesMkt) : '—'}</td>
                  <td className="text-right px-2 py-1.5 border border-[#DDC7A4] tabular-nums font-bold text-[#7E0000]">{brl(l.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F5F0EB] font-bold text-[#392617]">
                <td className="text-left px-2 py-2 border border-[#7E0000]">TOTAL REDE</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.vouchers ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.acrescimo7 ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.omnichannel ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.cortesiaReembolso ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.comprasEfetiva ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.treinamentoEfetivo ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums">{brl(t?.royaltiesMkt ?? 0)}</td>
                <td className="text-right px-2 py-2 border border-[#7E0000] tabular-nums text-[#7E0000] text-base">{brl(t?.total ?? 0)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-6 text-right">
            <div className="text-sm text-[#392617]/70">Total a reembolsar da rede</div>
            <div className="text-3xl font-bold text-[#7E0000]">R$ {brl(t?.total ?? 0)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
