import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession, unidadesPermitidas } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { BarChart3 } from 'lucide-react'

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

export default async function DrePage({ searchParams }: { searchParams: Promise<{ unidade?: string; ano?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const sp = await searchParams

  const permitidas = unidadesPermitidas(session)
  const visiveis = permitidas == null ? UNIDADES : UNIDADES.filter((u) => permitidas.includes(u.slug))
  const unidadeSlug = sp.unidade && visiveis.some((u) => u.slug === sp.unidade) ? sp.unidade : visiveis[0]?.slug
  const ano = Number(sp.ano) || new Date().getFullYear()

  const unidade = unidadeSlug ? await prisma.unidade.findUnique({ where: { slug: unidadeSlug }, select: { id: true } }) : null

  // Receita operacional (Belle) por mês — valor BRUTO das entradas (exclui saídas 'S').
  const opPorMes: Record<number, number> = {}
  // Outras entradas classificadas por conta × mês.
  const outras: Record<string, Record<number, number>> = {}

  if (unidade) {
    const movs = await prisma.movimentacaoBelle.findMany({
      where: { unidadeId: unidade.id, data: { startsWith: `${ano}-` } },
      select: { data: true, valorBruto: true, tipoMovimento: true },
    })
    for (const m of movs) {
      if ((m.tipoMovimento ?? 'E').toUpperCase() === 'S') continue
      const mes = Number(m.data.slice(5, 7))
      opPorMes[mes] = (opPorMes[mes] ?? 0) + (m.valorBruto || 0)
    }
    const fontes = await prisma.fonteExterna.findMany({
      where: { unidadeId: unidade.id, origem: 'BANCO_PIX', statusMatch: 'CLASSIFICADA', data: { startsWith: `${ano}-` } },
      include: { planoConta: { select: { nome: true } } },
    })
    for (const f of fontes) {
      const nome = f.planoConta?.nome ?? '(sem conta)'
      const mes = Number(f.data.slice(5, 7))
      ;(outras[nome] ??= {})[mes] = (outras[nome]?.[mes] ?? 0) + f.valor
    }
  }

  // Meses com algum movimento (colunas).
  const mesesComDado = new Set<number>()
  for (const m of Object.keys(opPorMes)) if (opPorMes[Number(m)]) mesesComDado.add(Number(m))
  for (const conta of Object.values(outras)) for (const m of Object.keys(conta)) mesesComDado.add(Number(m))
  const meses = [...mesesComDado].sort((a, b) => a - b)

  const somaLinha = (vals: Record<number, number>) => meses.reduce((s, m) => s + (vals[m] ?? 0), 0)
  const totalMes = (m: number) => (opPorMes[m] ?? 0) + Object.values(outras).reduce((s, c) => s + (c[m] ?? 0), 0)
  const totalGeral = meses.reduce((s, m) => s + totalMes(m), 0)

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <BarChart3 className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">DRE — Entradas</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">
        Receita por mês (competência): receita operacional do Belle + outras entradas classificadas no banco.
        <span className="text-[#392617]/40"> As saídas (despesas) entram numa próxima fase.</span>
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {visiveis.map((u) => (
          <Link key={u.slug} href={`/dre?unidade=${u.slug}&ano=${ano}`}
            className={`px-3 py-1.5 rounded-md text-sm border ${u.slug === unidadeSlug ? 'bg-[#7E0000] text-white border-[#7E0000]' : 'border-[#DDC7A4] text-[#392617] hover:bg-[#7E0000]/5'}`}>
            {u.nome}
          </Link>
        ))}
        <span className="mx-2 text-[#DDC7A4]">|</span>
        <Link href={`/dre?unidade=${unidadeSlug}&ano=${ano - 1}`} className="px-2 py-1.5 rounded-md text-sm border border-[#DDC7A4] text-[#392617] hover:bg-[#7E0000]/5">← {ano - 1}</Link>
        <span className="text-sm font-medium px-2">{ano}</span>
        <Link href={`/dre?unidade=${unidadeSlug}&ano=${ano + 1}`} className="px-2 py-1.5 rounded-md text-sm border border-[#DDC7A4] text-[#392617] hover:bg-[#7E0000]/5">{ano + 1} →</Link>
      </div>

      {meses.length === 0 ? (
        <p className="text-sm text-[#392617]/50">Sem dados de receita neste ano para esta unidade.</p>
      ) : (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[#E4E5E2] text-[#7E0000] text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left sticky left-0 bg-[#E4E5E2]">Conta</th>
                {meses.map((m) => <th key={m} className="px-4 py-2.5 text-right whitespace-nowrap">{MES_ABREV[m]}</th>)}
                <th className="px-4 py-2.5 text-right whitespace-nowrap bg-[#DDC7A4]/40">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#DDC7A4]/40 font-medium">
                <td className="px-4 py-2 text-[#392617] sticky left-0 bg-white">Receita operacional (Belle)</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]">{opPorMes[m] ? brl(opPorMes[m]) : '—'}</td>)}
                <td className="px-4 py-2 text-right font-semibold bg-[#DDC7A4]/15">{brl(somaLinha(opPorMes))}</td>
              </tr>
              {Object.keys(outras).length > 0 && (
                <tr className="border-t border-[#DDC7A4]/40">
                  <td colSpan={meses.length + 2} className="px-4 py-1.5 text-xs uppercase tracking-wide text-[#425F1D] bg-[#425F1D]/[0.06]">Outras entradas (classificadas)</td>
                </tr>
              )}
              {Object.entries(outras).sort((a, b) => somaLinha(b[1]) - somaLinha(a[1])).map(([nome, vals]) => (
                <tr key={nome} className="border-t border-[#DDC7A4]/40">
                  <td className="px-4 py-2 text-[#392617] sticky left-0 bg-white">{nome}</td>
                  {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{vals[m] ? brl(vals[m]) : '—'}</td>)}
                  <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(somaLinha(vals))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#7E0000]/30 font-bold text-[#7E0000]">
                <td className="px-4 py-2.5 sticky left-0 bg-white">Total de entradas</td>
                {meses.map((m) => <td key={m} className="px-4 py-2.5 text-right">{brl(totalMes(m))}</td>)}
                <td className="px-4 py-2.5 text-right bg-[#D78B18]/15">{brl(totalGeral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
