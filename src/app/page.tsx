import { redirect } from 'next/navigation'
import { getSession, unidadesPermitidas } from '@/lib/auth/guard'
import { getPermissoesDoPerfil } from '@/lib/permissoes/store'
import { nivelAtende } from '@/lib/permissoes/catalogo'

const UNIDADE_PADRAO = 'shopping-metropole'

// Landing inteligente: manda cada usuário para a PRIMEIRA tela que ele realmente
// acessa. Antes era um redirect fixo para /dashboard; perfis sem a permissão
// 'dashboard' (ex.: recepção customizada = só Caixa/Validação/Pós-venda) caíam
// num loop /→/dashboard→(proxy bloqueia)→/ e viam tela branca. Roda no servidor
// (fora do proxy), então pode decidir o destino sem ser barrado.
export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')

  const superadmin = session.perfil === 'DONA'
  const perms = superadmin ? {} : await getPermissoesDoPerfil(session.perfilChave || session.perfil)
  const pode = (f: string) => superadmin || nivelAtende(perms[f], 'VISUALIZAR')

  const unidades = unidadesPermitidas(session)
  const unidade = unidades && unidades.length > 0 ? unidades[0] : UNIDADE_PADRAO

  const destino =
    pode('dashboard') ? `/dashboard/${unidade}` :
    pode('radar-geral') ? '/radar-geral' :
    pode('rotina-do-dia') ? `/rotina-do-dia?unidade=${unidade}` :
    pode('caixa') ? `/caixa?unidade=${unidade}` :
    pode('validacao') ? `/validacao?unidade=${unidade}` :
    pode('pos-venda') ? `/pos-venda?unidade=${unidade}` :
    pode('metas') ? `/metas?unidade=${unidade}` :
    pode('pontuacao') ? `/pontuacao?unidade=${unidade}` :
    pode('meus-atendimentos') ? '/meus-atendimentos' :
    `/dashboard/${unidade}`

  redirect(destino)
}
