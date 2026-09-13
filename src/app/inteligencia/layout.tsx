'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function InteligenciaLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  const tabs = [
    { href: '/inteligencia/plano-dia',  label: '📅 Plano do Dia' },
    { href: '/inteligencia',           label: '📋 Fila do Dia' },
    { href: '/inteligencia/totalpass',  label: '🎫 TotalPass' },
    { href: '/inteligencia/resultados', label: '📊 Resultados' },
    { href: '/inteligencia/mensagens',  label: '✏️ Mensagens' },
  ]

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <div className="border-b border-[#DDC7A4] bg-white px-4 sm:px-6 shadow-sm">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(({ href, label }) => {
            const isActive = href === '/inteligencia' ? path === href : path.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-[#7E0000] text-[#7E0000] bg-[#7E0000]/5'
                    : 'border-transparent text-[#392617]/50 hover:text-[#392617] hover:bg-[#DDC7A4]/15'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      {children}
    </div>
  )
}
