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

  const opPorMes: Record<number, number> = {}               // receita operacional (Belle, bruto)
  const outras: Record<string, Record<number, number>> = {} // outras entradas classificadas × mês
  const despesas: Record<string, Record<number, number>> = {} // despesas (títulos) por conta × mês

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
      const mes = Number(f.data.slice(5, 7))
      ;(outras[f.planoConta?.nome ?? '(sem conta)'] ??= {})[mes] = (outras[f.planoConta?.nome ?? '(sem conta)']?.[mes] ?? 0) + f.valor
    }
    // Despesas: títulos por competência (ignora cancelados).
    const titulos = await prisma.tituloPagar.findMany({
      where: { unidadeId: unidade.id, status: { not: 'CANCELADO' }, dataCompetencia: { startsWith: `${ano}-` } },
      include: { planoConta: { select: { nome: true } } },
    })
    for (const t of titulos) {
      if (!t.dataCompetencia) continue
      const mes = Number(t.dataCompetencia.slice(5, 7))
      const nome = t.planoConta?.nome ?? '(a classificar)'
      ;(despesas[nome] ??= {})[mes] = (despesas[nome]?.[mes] ?? 0) + t.valor
    }
  }

  const mesesSet = new Set<number>()
  for (const m of Object.keys(opPorMes)) if (opPorMes[Number(m)]) mesesSet.add(Number(m))
  for (const g of [outras, despesas]) for (const conta of Object.values(g)) for (const m of Object.keys(conta)) mesesSet.add(Number(m))
  const meses = [...mesesSet].sort((a, b) => a - b)

  const somaLinha = (vals: Record<number, number>) => meses.reduce((s, m) => s + (vals[m] ?? 0), 0)
  const receitaMes = (m: number) => (opPorMes[m] ?? 0) + Object.values(outras).reduce((s, c) => s + (c[m] ?? 0), 0)
  const despesaMes = (m: number) => Object.values(despesas).reduce((s, c) => s + (c[m] ?? 0), 0)
  const resultadoMes = (m: number) => receitaMes(m) - despesaMes(m)
  const tot = (f: (m: number) => number) => meses.reduce((s, m) => s + f(m), 0)

  const ordenar = (g: Record<string, Record<number, number>>) => Object.entries(g).sort((a, b) => somaLinha(b[1]) - somaLinha(a[1]))

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <BarChart3 className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">DRE</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">Resultado por mês (competência): receita (Belle + entradas classificadas) − despesas (contas a pagar).</p>

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
        <p className="text-sm text-[#392617]/50">Sem dados neste ano para esta unidade.</p>
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
              {/* RECEITA */}
              <tr className="border-t border-[#DDC7A4]/40"><td colSpan={meses.length + 2} className="px-4 py-1.5 text-xs uppercase tracking-wide text-[#425F1D] bg-[#425F1D]/[0.06]">Receita</td></tr>
              <tr className="border-t border-[#DDC7A4]/40">
                <td className="px-4 py-2 text-[#392617] sticky left-0 bg-white">Receita operacional (Belle)</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{opPorMes[m] ? brl(opPorMes[m]) : '—'}</td>)}
                <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(somaLinha(opPorMes))}</td>
              </tr>
              {ordenar(outras).map(([nome, vals]) => (
                <tr key={nome} className="border-t border-[#DDC7A4]/40">
                  <td className="px-4 py-2 text-[#392617] sticky left-0 bg-white">{nome}</td>
                  {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{vals[m] ? brl(vals[m]) : '—'}</td>)}
                  <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(somaLinha(vals))}</td>
                </tr>
              ))}
              <tr className="border-t border-[#425F1D]/30 font-semibold text-[#425F1D]">
                <td className="px-4 py-2 sticky left-0 bg-white">= Total de receitas</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right">{brl(receitaMes(m))}</td>)}
                <td className="px-4 py-2 text-right bg-[#425F1D]/10">{brl(tot(receitaMes))}</td>
              </tr>

              {/* DESPESA */}
              <tr className="border-t border-[#DDC7A4]/40"><td colSpan={meses.length + 2} className="px-4 py-1.5 text-xs uppercase tracking-wide text-[#7E0000] bg-[#7E0000]/[0.06]">Despesas</td></tr>
              {ordenar(despesas).length === 0 && (
                <tr className="border-t border-[#DDC7A4]/40"><td colSpan={meses.length + 2} className="px-4 py-2 text-[#392617]/40 italic sticky left-0 bg-white">Nenhuma despesa lançada (lance em Contas a Pagar)</td></tr>
              )}
              {ordenar(despesas).map(([nome, vals]) => (
                <tr key={nome} className="border-t border-[#DDC7A4]/40">
                  <td className="px-4 py-2 text-[#392617] sticky left-0 bg-white">{nome}</td>
                  {meses.map((m) => <td key={m} className="px-4 py-2 text-right text-[#392617]/80">{vals[m] ? brl(vals[m]) : '—'}</td>)}
                  <td className="px-4 py-2 text-right font-medium bg-[#DDC7A4]/15">{brl(somaLinha(vals))}</td>
                </tr>
              ))}
              <tr className="border-t border-[#7E0000]/30 font-semibold text-[#7E0000]">
                <td className="px-4 py-2 sticky left-0 bg-white">= Total de despesas</td>
                {meses.map((m) => <td key={m} className="px-4 py-2 text-right">{despesaMes(m) ? brl(despesaMes(m)) : '—'}</td>)}
                <td className="px-4 py-2 text-right bg-[#7E0000]/10">{brl(tot(despesaMes))}</td>
              </tr>

              {/* RESULTADO */}
              <tr className="border-t-2 border-[#392617]/40 font-bold">
                <td className="px-4 py-2.5 text-[#392617] sticky left-0 bg-white">Resultado</td>
                {meses.map((m) => {
                  const r = resultadoMes(m)
                  return <td key={m} className={`px-4 py-2.5 text-right ${r < 0 ? 'text-[#7E0000]' : 'text-[#425F1D]'}`}>{brl(r)}</td>
                })}
                <td className={`px-4 py-2.5 text-right bg-[#D78B18]/15 ${tot(resultadoMes) < 0 ? 'text-[#7E0000]' : 'text-[#425F1D]'}`}>{brl(tot(resultadoMes))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
