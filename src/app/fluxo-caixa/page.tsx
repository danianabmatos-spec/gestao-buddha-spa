import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { Banknote } from 'lucide-react'

export const dynamic = 'force-dynamic'

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]
const MES_ABREV = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function FluxoCaixaPage({ searchParams }: { searchParams: Promise<{ unidade?: string; ano?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const sp = await searchParams

  const permitidas = unidadesPermitidas(session)
  const visiveis = permitidas == null ? UNIDADES : UNIDADES.filter((u) => permitidas.includes(u.slug))
  const unidadeSlug = sp.unidade && visiveis.some((u) => u.slug === sp.unidade) ? sp.unidade : visiveis[0]?.slug
  const ano = Number(sp.ano) || new Date().getFullYear()
  const unidade = unidadeSlug ? await prisma.unidade.findUnique({ where: { slug: unidadeSlug }, select: { id: true } }) : null

  // Entradas (Pix no banco) por mês.
  const cliente: Record<number, number> = {}
  const classificado: Record<number, number> = {}
  const pendente: Record<number, number> = {}
  // Saídas (títulos) por mês de caixa: pago→dataPagamento, previsto→dataVencimento.
  const saiPago: Record<number, number> = {}
  const saiPrevisto: Record<number, number> = {}

  if (unidade) {
    const fontes = await prisma.fonteExterna.findMany({
      where: { unidadeId: unidade.id, origem: 'BANCO_PIX', data: { startsWith: `${ano}-` } },
      select: { data: true, valor: true, statusMatch: true },
    })
    for (const f of fontes) {
      const mes = Number(f.data.slice(5, 7))
      const b = f.statusMatch === 'CASADA' ? cliente : f.statusMatch === 'CLASSIFICADA' ? classificado : pendente
      b[mes] = (b[mes] ?? 0) + f.valor
    }
    const titulos = await prisma.tituloPagar.findMany({
      where: { unidadeId: unidade.id, status: { not: 'CANCELADO' } },
      select: { valor: true, status: true, dataVencimento: true, dataPagamento: true },
    })
    for (const t of titulos) {
      const dataCaixa = t.status === 'PAGO' ? t.dataPagamento : t.dataVencimento
      if (!dataCaixa || !dataCaixa.startsWith(`${ano}-`)) continue
      const mes = Number(dataCaixa.slice(5, 7))
      if (t.status === 'PAGO') saiPago[mes] = (saiPago[mes] ?? 0) + t.valor
      else saiPrevisto[mes] = (saiPrevisto[mes] ?? 0) + t.valor
    }
  }

  const mesesSet = new Set<number>()
  for (const b of [cliente, classificado, pendente, saiPago, saiPrevisto]) for (const m of Object.keys(b)) mesesSet.add(Number(m))
  const meses = [...mesesSet].sort((a, b) => a - b)
  const soma = (vals: Record<number, number>) => meses.reduce((s, m) => s + (vals[m] ?? 0), 0)
  const entradaMes = (m: number) => (cliente[m] ?? 0) + (classificado[m] ?? 0) + (pendente[m] ?? 0)
  const saidaMes = (m: number) => (saiPago[m] ?? 0) + (saiPrevisto[m] ?? 0)
  const saldoMes = (m: number) => entradaMes(m) - saidaMes(m)
  const tot = (f: (m: number) => number) => meses.reduce((s, m) => s + f(m), 0)

  const LINHAS_ENT: { label: string; vals: Record<number, number>; cor: string }[] = [
    { label: 'Pix de clientes (conciliado)', vals: cliente, cor: '#425F1D' },
    { label: 'Outras entradas (classificadas)', vals: classificado, cor: '#D78B18' },
    { label: 'A classificar (pendente)', vals: pendente, cor: '#7E0000' },
  ]

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <Banknote className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Fluxo de Caixa</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">
        Entradas (Pix no banco) e saídas (contas a pagar) por mês.
        <span className="text-[#392617]/40"> Cartão e dinheiro nas entradas entram nas próximas fases.</span>
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {visiveis.map((u) => (
          <Link key={u.slug} href={`/fluxo-caixa?unidade=${u.slug}&ano=${ano}`}
            className={`px-3 py-1.5 rounded-md text-sm border ${u.slug === unidadeSlug ? 'bg-[#7E0000] text-white border-[#7E0000]' : 'border-[#DDC7A4] text-[#392617] hover:bg-[#7E0000]/5'}`}>
            {u.nome}
          </Link>
        ))}
        <span className="mx-2 text-[#DDC7A4]">|</span>
        <Link href={`/fluxo-caixa?unidade=${unidadeSlug}&ano=${ano - 1}`} className="px-2 py-1.5 rounded-md text-sm border border-[#DDC7A4] text-[#392617] hover:bg-[#7E0000]/5">← {ano - 1}</Link>
        <span className="text-sm font-medium px-2">{ano}</span>
        <Link href={`/fluxo-caixa?unidade=${unidadeSlug}&ano=${ano + 1}`} className="px-2 py-1.5 rounded-md text-sm border border-[#DDC7A4] text-[#392617] hover:bg-[#7E0000]/5">{ano + 1} →</Link>
      </div>

      {meses.length === 0 ? (
        <p className="text-sm text-[#392617]/50">Sem movimento neste ano. Importe o extrato OFX (entradas) e lance títulos (saídas).</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[#E4E5E2] text-[#7E0000] text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left sticky left-0 bg-[#E4E5E2]">Caixa</th>
                {meses.map((m) => <th key={m} className="px-4 py-2.5 text-right whitespace-nowrap">{MES_ABREV[m]}</th>)}
                <th className="px-4 py-2.5 text-right whitespace-nowrap bg-[#DDC7A4]/40">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#DDC7A4]/40"><td colSpan={meses.length + 2} className="px-4 py-1.5 text-xs uppercase tracking-wide text-[#425F1D] bg-[#425F1D]/[0.06]">Entradas (Pix no banco)</td></tr>
              {LINHAS_ENT.map((l) => (
                <tr key={l.label} className="border-t border-[#DDC7A4]/40">
                  <td className="px-4 py-2 sticky left-0 bg-white" style={{ color: l.cor }}>{l.label}</td>
                  {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{l.vals[m] ? brl(l.vals[m]) : '—'}</td>)}
                  <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(soma(l.vals))}</td>
                </tr>
              ))}
              <tr className="border-t border-[#425F1D]/30 font-semibold text-[#425F1D]">
                <td className="px-4 py-2 sticky left-0 bg-white">= Total entrou</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right">{brl(entradaMes(m))}</td>)}
                <td className="px-4 py-2 text-right bg-[#425F1D]/10">{brl(tot(entradaMes))}</td>
              </tr>

              <tr className="border-t border-[#DDC7A4]/40"><td colSpan={meses.length + 2} className="px-4 py-1.5 text-xs uppercase tracking-wide text-[#7E0000] bg-[#7E0000]/[0.06]">Saídas (contas a pagar)</td></tr>
              <tr className="border-t border-[#DDC7A4]/40">
                <td className="px-4 py-2 text-[#8a5a00] sticky left-0 bg-white">Previsto (a pagar)</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{saiPrevisto[m] ? brl(saiPrevisto[m]) : '—'}</td>)}
                <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(soma(saiPrevisto))}</td>
              </tr>
              <tr className="border-t border-[#DDC7A4]/40">
                <td className="px-4 py-2 text-[#425F1D] sticky left-0 bg-white">Pago</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{saiPago[m] ? brl(saiPago[m]) : '—'}</td>)}
                <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(soma(saiPago))}</td>
              </tr>
              <tr className="border-t border-[#7E0000]/30 font-semibold text-[#7E0000]">
                <td className="px-4 py-2 sticky left-0 bg-white">= Total saiu</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right">{saidaMes(m) ? brl(saidaMes(m)) : '—'}</td>)}
                <td className="px-4 py-2 text-right bg-[#7E0000]/10">{brl(tot(saidaMes))}</td>
              </tr>

              <tr className="border-t-2 border-[#392617]/40 font-bold">
                <td className="px-4 py-2.5 text-[#392617] sticky left-0 bg-white">Saldo (entrou − saiu)</td>
                {meses.map((m) => { const s = saldoMes(m); return <td key={m} className={`px-4 py-2.5 text-right ${s < 0 ? 'text-[#7E0000]' : 'text-[#425F1D]'}`}>{brl(s)}</td> })}
                <td className={`px-4 py-2.5 text-right bg-[#D78B18]/15 ${tot(saldoMes) < 0 ? 'text-[#7E0000]' : 'text-[#425F1D]'}`}>{brl(tot(saldoMes))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
