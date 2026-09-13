'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    // Redireciona para Shopping Metrópole por padrão
    router.push('/dashboard/shopping-metropole')
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
