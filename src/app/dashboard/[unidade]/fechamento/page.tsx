'use client'

import { useParams } from 'next/navigation'
import { getUnidadeNome } from '@/lib/belle/unidades-config'

export default function FechamentoUnidadePage() {
  const params = useParams()
  const unidadeSlug = params.unidade as string
  const unidadeNome = getUnidadeNome(unidadeSlug)

  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#7E0000]">Fechamento Diário</h1>
        <p className="text-sm text-[#392617]/60 mt-1">{unidadeNome}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#DDC7A4]/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h2 className="text-lg font-semibold text-[#392617] mb-2">
            Fechamento Diário - {unidadeNome}
          </h2>
          <p className="text-sm text-[#392617]/60">
            Módulo de fechamento diário em desenvolvimento para esta unidade.
          </p>
        </div>
      </div>
    </main>
  )
}
