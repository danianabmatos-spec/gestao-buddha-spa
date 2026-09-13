'use client'

import { cn } from '@/lib/utils'
import {
  FAIXAS_RECEPCAO,
  CARGOS_RECEPCAO,
  getFaixaRecepcao,
  calcPct,
} from '@/config/metas'

interface BonificacaoRecepcaoProps {
  vendasAtual: number
  metaVendas: number
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const COR_FAIXA = [
  'bg-[#392617]/12 text-[#392617]/55 border-[#392617]/20',           // 0–70%
  'bg-[#D78B18]/8 text-[#D78B18] border-[#D78B18]/20',      // 71–85%
  'bg-[#D78B18]/8 text-[#D78B18] border-[#D78B18]/20',      // 86–99%
  'bg-[#425F1D]/8 text-[#425F1D] border-[#425F1D]/35',         // 100–110%
  'bg-[#425F1D]/8 text-[#425F1D] border-[#425F1D]/35',   // 111–120%
  'bg-[#425F1D]/10 text-[#425F1D] border-[#425F1D]/30', // +120%
]

const COR_ATIVA = [
  'bg-[#392617]/20 text-[#392617] border-[#392617]/55 ring-2 ring-[#392617]/35',
  'bg-[#D78B18]/12 text-[#D78B18] border-[#D78B18]/55 ring-2 ring-[#D78B18]/35',
  'bg-[#D78B18]/12 text-[#D78B18] border-[#D78B18]/55 ring-2 ring-[#D78B18]/55',
  'bg-[#425F1D]/12 text-[#425F1D] border-[#425F1D]/75 ring-2 ring-[#425F1D]/35',
  'bg-[#425F1D]/12 text-[#425F1D] border-[#425F1D]/75 ring-2 ring-[#425F1D]/55',
  'bg-[#425F1D]/20 text-[#425F1D] border-[#425F1D] ring-2 ring-[#425F1D]/40',
]

export function BonificacaoRecepcao({ vendasAtual, metaVendas }: BonificacaoRecepcaoProps) {
  const pct = calcPct(vendasAtual, metaVendas)
  const faixaAtiva = getFaixaRecepcao(pct)
  const idxAtivo = FAIXAS_RECEPCAO.findIndex(f => f.label === faixaAtiva.label)

  const cargos = Object.entries(CARGOS_RECEPCAO)

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
            Bonificação — Recepção
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meta de vendas: {fmt(metaVendas)} · Critério: planos, vouchers e produtos
          </p>
        </div>
        <div className="text-right bg-[#F5F0EB] rounded-lg px-3 py-2 min-w-[130px]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Atingimento atual</p>
          <p className="text-xl font-bold text-[#7E0000]">{pct}%</p>
          <p className="text-[10px] text-muted-foreground">{fmt(vendasAtual)} vendido</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 bg-[#E4E5E2] rounded-full overflow-hidden mb-4">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            pct >= 100 ? 'bg-[#425F1D]/75' : pct >= 86 ? 'bg-[#D78B18]' : pct >= 71 ? 'bg-[#D78B18]/55' : 'bg-[#392617]/35'
          )}
          style={{ width: `${Math.min(pct, 130)}%`, maxWidth: '100%' }}
        />
      </div>

      {/* Grid de faixas */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 mb-4">
        {FAIXAS_RECEPCAO.map((faixa, idx) => {
          const ativa = idx === idxAtivo
          return (
            <div
              key={faixa.label}
              className={cn(
                'rounded-lg border p-2 text-center transition-all',
                ativa ? COR_ATIVA[idx] : COR_FAIXA[idx]
              )}
            >
              <p className="text-[10px] font-bold leading-tight">{faixa.label}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {faixa.vendasDe ? fmt(faixa.vendasDe).replace('R$ ', '') : '—'}
                {faixa.vendasAte ? ` a ${fmt(faixa.vendasAte).replace('R$ ', '')}` : '+'}
              </p>
              {ativa && <p className="text-[9px] font-semibold mt-0.5">← atual</p>}
            </div>
          )
        })}
      </div>

      {/* Tabela de bônus por cargo */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cargo</th>
              {FAIXAS_RECEPCAO.map((f, idx) => (
                <th
                  key={f.label}
                  className={cn(
                    'text-center py-2 px-1 text-xs font-semibold uppercase tracking-wide',
                    idx === idxAtivo ? 'text-[#7E0000]' : 'text-muted-foreground'
                  )}
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargos.map(([key, label]) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-2.5 font-medium text-[#392617]">{label}</td>
                {FAIXAS_RECEPCAO.map((f, idx) => {
                  const val = f.cargos[key] ?? 0
                  const ativa = idx === idxAtivo
                  return (
                    <td
                      key={f.label}
                      className={cn(
                        'py-2.5 px-1 text-center text-sm',
                        ativa ? 'font-bold text-[#7E0000] bg-[#7E0000]/5 rounded' : 'text-muted-foreground'
                      )}
                    >
                      {val === 0 ? '—' : fmt(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 italic">
        * Bônus proporcional aos dias trabalhados no mês. Sem pagamento de comissão.
      </p>
    </div>
  )
}
