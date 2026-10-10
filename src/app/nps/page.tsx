'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import NpsTratativas from '@/components/rotinas/nps-tratativas'

function NpsInner() {
  // A unidade vem do menu lateral (?unidade=slug). key força recarregar ao trocar.
  const unidade = useSearchParams().get('unidade')
  return <NpsTratativas key={unidade ?? ''} unidadeSlug={unidade} />
}

export default function NpsPage() {
  return (
    <Suspense fallback={null}>
      <NpsInner />
    </Suspense>
  )
}
