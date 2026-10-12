'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Unidade padrão de quem enxerga TODAS (Dona/Financeiro/RH). Quem tem escopo de
// unidade(s) é mandado pra PRIMEIRA que acessa — senão caía fixo no Shopping
// Metrópole e a recepção de outra unidade via tela em branco (rota bloqueada).
const UNIDADE_PADRAO = 'shopping-metropole'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelado = false
    fetch('/api/auth/permissoes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelado) return
        const unidades: string[] | null = j?.unidades ?? null
        const destino = unidades && unidades.length > 0 ? unidades[0] : UNIDADE_PADRAO
        router.replace(`/dashboard/${destino}`)
      })
      .catch(() => { if (!cancelado) router.replace(`/dashboard/${UNIDADE_PADRAO}`) })
    return () => { cancelado = true }
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen bg-[#F5F0EB]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7E0000] mx-auto mb-4"></div>
        <p className="text-[#392617]/60">Carregando dashboard...</p>
      </div>
    </div>
  )
}
