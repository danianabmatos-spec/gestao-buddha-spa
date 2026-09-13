'use client'

import { useParams } from 'next/navigation'
import { getUnidadeNome } from '@/lib/belle/unidades-config'
import { TerapeutasView } from '@/components/terapeutas/terapeutas-view'

export default function TerapeutasUnidadePage() {
  const params = useParams()
  const unidadeSlug = params.unidade as string
  const unidadeNome = getUnidadeNome(unidadeSlug)

  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#7E0000]">Terapeutas</h1>
        <p className="text-sm text-[#392617]/60 mt-1">
          {unidadeNome} — Produtividade, Fidelização e NPS (terapeutas ativos)
        </p>
      </div>
      <TerapeutasView unidadeSlug={unidadeSlug} />
    </main>
  )
}
