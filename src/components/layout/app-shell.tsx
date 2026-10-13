import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

// Casca padrão do app: barra lateral + conteúdo. Usada pelas telas operacionais
// avulsas (caixa, validação, pós-venda, pontuação) pra que o menu lateral esteja
// SEMPRE presente — inclusive pra recepção, que entra por essas telas (não tem
// acesso ao /dashboard) e precisa enxergar os acessos dela (Bola, Caixa, etc.).
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F0EB]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {children}
      </div>
      <MobileNav />
    </div>
  )
}
