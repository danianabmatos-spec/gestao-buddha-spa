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

  // Pix recebidos no banco por mês (data de compensação = quando entrou no caixa).
  const cliente: Record<number, number> = {}      // casou com Belle (statusMatch CASADA)
  const classificado: Record<number, number> = {}  // outra entrada classificada
  const pendente: Record<number, number> = {}      // ainda a classificar (SEM_PAR)

  if (unidade) {
    const fontes = await prisma.fonteExterna.findMany({
      where: { unidadeId: unidade.id, origem: 'BANCO_PIX', data: { startsWith: `${ano}-` } },
      select: { data: true, valor: true, statusMatch: true },
    })
    for (const f of fontes) {
      const mes = Number(f.data.slice(5, 7))
      const bucket = f.statusMatch === 'CASADA' ? cliente : f.statusMatch === 'CLASSIFICADA' ? classificado : pendente
      bucket[mes] = (bucket[mes] ?? 0) + f.valor
    }
  }

  const mesesSet = new Set<number>()
  for (const b of [cliente, classificado, pendente]) for (const m of Object.keys(b)) mesesSet.add(Number(m))
  const meses = [...mesesSet].sort((a, b) => a - b)
  const soma = (vals: Record<number, number>) => meses.reduce((s, m) => s + (vals[m] ?? 0), 0)
  const totalMes = (m: number) => (cliente[m] ?? 0) + (classificado[m] ?? 0) + (pendente[m] ?? 0)

  const LINHAS: { label: string; vals: Record<number, number>; cor: string }[] = [
    { label: 'Pix de clientes (conciliado)', vals: cliente, cor: '#425F1D' },
    { label: 'Outras entradas (classificadas)', vals: classificado, cor: '#D78B18' },
    { label: 'A classificar (pendente)', vals: pendente, cor: '#7E0000' },
  ]

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <Banknote className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Fluxo de Caixa — Entradas</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">
        Pix que entrou na conta bancária por mês (data de compensação).
        <span className="text-[#392617]/40"> Cartão, dinheiro e saídas entram nas próximas fases.</span>
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
        <p className="text-sm text-[#392617]/50">Sem Pix no banco neste ano. Importe o extrato OFX na tela de Conciliação.</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[#E4E5E2] text-[#7E0000] text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left sticky left-0 bg-[#E4E5E2]">Entradas no banco</th>
                {meses.map((m) => <th key={m} className="px-4 py-2.5 text-right whitespace-nowrap">{MES_ABREV[m]}</th>)}
                <th className="px-4 py-2.5 text-right whitespace-nowrap bg-[#DDC7A4]/40">Total</th>
              </tr>
            </thead>
            <tbody>
              {LINHAS.map((l) => (
                <tr key={l.label} className="border-t border-[#DDC7A4]/40">
                  <td className="px-4 py-2 sticky left-0 bg-white" style={{ color: l.cor }}>{l.label}</td>
                  {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{l.vals[m] ? brl(l.vals[m]) : '—'}</td>)}
                  <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(soma(l.vals))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#7E0000]/30 font-bold text-[#7E0000]">
                <td className="px-4 py-2.5 sticky left-0 bg-white">Total entrou no banco</td>
                {meses.map((m) => <td key={m} className="px-4 py-2.5 text-right">{brl(totalMes(m))}</td>)}
                <td className="px-4 py-2.5 text-right bg-[#D78B18]/15">{brl(meses.reduce((s, m) => s + totalMes(m), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
