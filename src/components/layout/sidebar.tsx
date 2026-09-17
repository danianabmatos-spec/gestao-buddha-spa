'use client'

import { useState, useEffect } from 'react'
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
  ShieldCheck,
  HeartHandshake,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Cada item aponta pra uma FUNCIONALIDADE — a sidebar esconde o que o perfil não acessa.
const executiveItems = [
  { href: '/radar-geral', label: 'Radar Geral', icon: Radar, func: 'radar-geral' },
  { href: '/inteligencia', label: 'Inteligência', icon: BrainCircuit, func: 'inteligencia' },
  { href: '/reembolso', label: 'Reembolso Vouchers', icon: Ticket, func: 'reembolso' },
]

const unidadesDisponiveis = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]

const menuOperacional = [
  { href: '', label: 'Dashboard', icon: LayoutDashboard, func: 'dashboard' },
  { href: '/historico', label: 'Histórico', icon: History, func: 'historico' },
  { href: '/terapeutas', label: 'Terapeutas', icon: Users, func: 'terapeutas' },
  { href: '/metas', label: 'Metas', icon: Target, func: 'metas' },
]
// Funcionalidades que compõem uma unidade (a unidade só aparece se pelo menos 1 for visível).
const FUNCS_UNIDADE = ['rotina-do-dia', 'dashboard', 'historico', 'terapeutas', 'metas', 'caixa', 'validacao', 'pos-venda']

export function Sidebar() {
  const pathname = usePathname()
  const [perms, setPerms] = useState<Record<string, string> | null>(null)
  // Slugs das unidades que o usuário acessa (null = todas; undefined = carregando).
  const [unidadesUser, setUnidadesUser] = useState<string[] | null | undefined>(undefined)
  const [unidadesExpanded, setUnidadesExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/auth/permissoes')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        setPerms(j?.permissoes ?? {})
        const us: string[] | null = j?.unidades ?? null
        setUnidadesUser(us)
        // Se a pessoa acessa 1 só unidade, já abre ela; senão abre a 1ª da lista.
        const visiveis = us == null ? unidadesDisponiveis : unidadesDisponiveis.filter(u => us.includes(u.slug))
        if (visiveis[0]) setUnidadesExpanded({ [visiveis[0].slug]: true })
      })
      .catch(() => { setPerms({}); setUnidadesUser(null) })
  }, [])

  // Enquanto carrega (perms null) → esconde os itens (evita mostrar o que não pode).
  const pode = (func: string) => !!perms && perms[func] != null && perms[func] !== 'NENHUM'

  const toggleUnidade = (slug: string) => setUnidadesExpanded(prev => ({ ...prev, [slug]: !prev[slug] }))

  // Mostra só as unidades que a pessoa acessa (null = todas).
  const unidadesVisiveis = unidadesUser == null ? unidadesDisponiveis : unidadesDisponiveis.filter(u => unidadesUser.includes(u.slug))

  const execVisiveis = executiveItems.filter(i => pode(i.func))
  const algumaUnidade = FUNCS_UNIDADE.some(pode) && unidadesVisiveis.length > 0

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#7E0000] text-[#DDC7A4] shrink-0">
      <div className="px-6 py-6 border-b border-[#5c0000]">
        <h1 className="text-lg font-bold text-white leading-tight">Buddha Spa</h1>
        <p className="text-xs text-[#DDC7A4]/70 mt-0.5">Gestão Operacional</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {execVisiveis.length > 0 && (
          <div className="mb-4">
            <p className="px-3 mb-2 text-[10px] font-semibold text-[#D78B18] uppercase tracking-wider">Visão Executiva</p>
            {execVisiveis.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href}
                  className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border',
                    active ? 'bg-[#D78B18] text-white border-[#D78B18]' : 'text-[#D78B18] border-[#D78B18]/30 hover:bg-[#D78B18]/10 hover:border-[#D78B18]')}>
                  <Icon size={18} strokeWidth={2} />
                  {label}
                </Link>
              )
            })}
          </div>
        )}

        {execVisiveis.length > 0 && algumaUnidade && <div className="h-px bg-[#5c0000] my-4" />}

        {algumaUnidade && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold text-[#DDC7A4]/50 uppercase tracking-wider">Unidades</p>
            {unidadesVisiveis.map(({ slug, nome }) => {
              const isExpanded = unidadesExpanded[slug]
              const isUnidadeActive = pathname.startsWith(`/dashboard/${slug}`)
              return (
                <div key={slug} className="mb-2">
                  <button onClick={() => toggleUnidade(slug)}
                    className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                      isUnidadeActive ? 'bg-[#5c0000] text-white' : 'text-[#DDC7A4] hover:bg-[#5c0000]/50')}>
                    <span>{nome}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isExpanded && (
                    <div className="ml-2 mt-1 space-y-0.5 border-l border-[#5c0000] pl-2">
                      {pode('rotina-do-dia') && (
                        <Link href={`/rotina-do-dia?unidade=${slug}`} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white">
                          <ClipboardList size={14} strokeWidth={1.8} /> Rotina do Dia
                        </Link>
                      )}
                      {menuOperacional.filter(i => pode(i.func)).map(({ href, label, icon: Icon }) => {
                        const fullHref = `/dashboard/${slug}${href}`
                        const active = pathname === fullHref
                        return (
                          <Link key={fullHref} href={fullHref}
                            className={cn('flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                              active ? 'bg-[#D78B18] text-white font-medium' : 'text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white')}>
                            <Icon size={14} strokeWidth={1.8} />
                            {label}
                          </Link>
                        )
                      })}
                      {pode('caixa') && (
                        <Link href={`/caixa?unidade=${slug}`} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white">
                          <Wallet size={14} strokeWidth={1.8} /> Caixa
                        </Link>
                      )}
                      {pode('caixa') && (
                        <Link href={`/dashboard/${slug}/conciliacao`} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white">
                          <Scale size={14} strokeWidth={1.8} /> Conciliação
                        </Link>
                      )}
                      {pode('validacao') && (
                        <Link href={`/validacao?unidade=${slug}`} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white">
                          <ShieldCheck size={14} strokeWidth={1.8} /> Validação de Atendimentos
                        </Link>
                      )}
                      {pode('pos-venda') && (
                        <Link href={`/pos-venda?unidade=${slug}`} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#DDC7A4]/80 hover:bg-[#5c0000] hover:text-white">
                          <HeartHandshake size={14} strokeWidth={1.8} /> Pós-venda
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-[#5c0000] space-y-1">
        {pode('empresas') && (
          <Link href="/empresas" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DDC7A4] hover:bg-[#5c0000] hover:text-white transition-colors">
            <Building2 size={18} strokeWidth={1.8} /> Empresas
          </Link>
        )}
        {pode('permissoes') && (
          <Link href="/acessos" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DDC7A4] hover:bg-[#5c0000] hover:text-white transition-colors">
            <Users size={18} strokeWidth={1.8} /> Acessos & Permissões
          </Link>
        )}
        {pode('configuracoes') && (
          <Link href="/configuracoes" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DDC7A4] hover:bg-[#5c0000] hover:text-white transition-colors">
            <Settings size={18} strokeWidth={1.8} /> Configurações
          </Link>
        )}
      </div>
    </aside>
  )
}
