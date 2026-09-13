'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Radar, BrainCircuit, ClipboardList, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileItems = [
  { href: '/rotina-do-dia', label: 'Rotina', icon: ClipboardList },
  { href: '/radar-geral', label: 'Radar', icon: Radar },
  { href: '/inteligencia', label: 'Inteligência', icon: BrainCircuit },
  { href: '/reembolso', label: 'Reembolso', icon: Ticket },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#7E0000] border-t border-[#5c0000] flex">
      {mobileItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
              active ? 'text-[#D78B18]' : 'text-[#DDC7A4]/70'
            )}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
