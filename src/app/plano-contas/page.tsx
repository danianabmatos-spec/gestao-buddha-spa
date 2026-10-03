import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { ListTree } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlanoContasPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const contas = await prisma.planoConta.findMany({
    where: { ativa: true },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    select: { id: true, nome: true, tipo: true, tipoDespesa: true },
  })
  const aReceber = contas.filter((c) => c.tipo === 'A Receber')
  const aPagar = contas.filter((c) => c.tipo !== 'A Receber')

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <ListTree className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Plano de Contas</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-6">
        {contas.length} contas contábeis — usadas para classificar entradas e saídas e organizar a DRE.
      </p>

      <Bloco titulo="A Receber" cor="#425F1D" contas={aReceber} />
      <div className="mt-8">
        <Bloco titulo="A Pagar" cor="#7E0000" contas={aPagar} />
      </div>
    </div>
  )
}

function Bloco({ titulo, cor, contas }: {
  titulo: string; cor: string
  contas: Array<{ id: number; nome: string; tipoDespesa: string }>
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: cor }}>
        {titulo} <span className="text-[#392617]/40">({contas.length})</span>
      </h2>
      <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="bg-[#E4E5E2] text-left text-[#7E0000] text-xs uppercase tracking-wide">
              <th className="px-4 py-2.5">Conta</th>
              <th className="px-4 py-2.5 text-center w-40">Tipo de despesa</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.id} className="border-t border-[#DDC7A4]/40">
                <td className="px-4 py-2 text-[#392617]">{c.nome}</td>
                <td className="px-4 py-2 text-center">
                  {c.tipoDespesa ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.tipoDespesa === 'Fixa' ? 'bg-[#7E0000]/10 text-[#7E0000]' : 'bg-[#D78B18]/15 text-[#D78B18]'
                    }`}>{c.tipoDespesa}</span>
                  ) : <span className="text-[#392617]/30">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
