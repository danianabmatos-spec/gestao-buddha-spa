'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Target,
  Ticket,
  Settings,
  Radar,
  ChevronDown,
  ChevronRight,
  History,
  BrainCircuit,
  Building2,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Menu Executivo (acesso restrito)
const executiveItems = [
  { href: '/rotina-do-dia', label: 'Rotina do Dia', icon: ClipboardList },
  { href: '/radar-geral', label: 'Radar Geral', icon: Radar },
  { href: '/inteligencia', label: 'Inteligência', icon: BrainCircuit },
  { href: '/reembolso', label: 'Reembolso Vouchers', icon: Ticket },
]

// Unidades disponíveis
const unidadesDisponiveis = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]

// Menu operacional por unidade
// (Vouchers por unidade foi removido — migrará para o app de conciliação financeira.
//  Não confundir com "Reembolso Vouchers" do menu executivo, que permanece.)
const menuOperacional = [
  { href: '', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/terapeutas', label: 'Terapeutas', icon: Users },
  { href: '/metas', label: 'Metas', icon: Target },
]

export function Sidebar() {
  const pathname = usePathname()
  const [unidadesExpanded, setUnidadesExpanded] = useState<Record<string, boolean>>({
    'shopping-metropole': true,
    'analia-franco': false,
    'shopping-analia-franco': false,
    'perdizes': false,
    'tatuape-gomescardim': false,
    'mooca-plaza': false,
    'higienopolis': false,
  })

  const toggleUnidade = (slug: string) => {
    setUnidadesExpanded(prev => ({ ...prev, [slug]: !prev[slug] }))
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#7E0000] text-[#DDC7A4] shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#5c0000]">
        <h1 className="text-lg font-bold text-white leading-tight">Buddha Spa</h1>
        <p className="text-xs text-[#DDC7A4]/70 mt-0.5">Gestão Operacional</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Visão Executiva */}
        <div className="mb-4">
          <p className="px-3 mb-2 text-[10px] font-semibold text-[#D78B18] uppercase tracking-wider">
            Visão Executiva
          </p>
          {executiveItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border',
                  active
                    ? 'bg-[#D78B18] text-white border-[#D78B18]'
                    : 'text-[#D78B18] border-[#D78B18]/30 hover:bg-[#D78B18]/10 hover:border-[#D78B18]'
                )}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Separador */}
        <div className="h-px bg-[#5c0000] my-4" />

        {/* Unidades com Submenus */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold text-[#DDC7A4]/50 uppercase tracking-wider">
            Unidades
          </p>

          {unidadesDisponiveis.map(({ slug, nome }) => {
            const isExpanded = unidadesExpanded[slug]
            const isUnidadeActive = pathname.startsWith(`/dashboard/${slug}`)

            return (
              <div key={slug} className="mb-2">
                {/* Header da Unidade */}
                <button
                  onClick={() => toggleUnidade(slug)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                    isUnidadeActive
                      ? 'bg-[#5c0000] text-white'
                      : 'text-[#DDC7A4] hover:bg-[#5c0000]/50'
                  )}
                >
                  <span>{nome}</span>
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>

                {/* Submenu */}
                {isExpanded && (
                  <div className="ml-2 mt-1 space-y-0.5 border-l border-[#5c0000] pl-2">
                    {menuOperacional.map(({ href, label, icon: Icon }) => {
                      const fullHref = `/dashboard/${slug}${href}`
                      const active = pathname === fullHref
                      return (
                        <Link
                          key={fullHref}
                          href={fullHref}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                            active
                              ? 'bg-[#D78B18] text-white font-medium'
                              : 'text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white'
                          )}
                        >
                          <Icon size={14} strokeWidth={1.8} />
                          {label}
                        </Link>
                      )
                    })}
                    {/* Controle de Caixa (por unidade) */}
                    <Link
                      href={`/caixa?unidade=${slug}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white"
                    >
                      <Wallet size={14} strokeWidth={1.8} />
                      Caixa
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#5c0000] space-y-1">
        <Link
          href="/empresas"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DDC7A4] hover:bg-[#5c0000] hover:text-white transition-colors"
        >
          <Building2 size={18} strokeWidth={1.8} />
          Empresas
        </Link>
        <Link
          href="/usuarios"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DDC7A4] hover:bg-[#5c0000] hover:text-white transition-colors"
        >
          <Users size={18} strokeWidth={1.8} />
          Acessos & Permissões
        </Link>
        <Link
          href="/configuracoes"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DDC7A4] hover:bg-[#5c0000] hover:text-white transition-colors"
        >
          <Settings size={18} strokeWidth={1.8} />
          Configurações
        </Link>
      </div>
    </aside>
  )
}
