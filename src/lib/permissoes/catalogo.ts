// ─── Catálogo de Permissões (fonte da verdade do que é permissionável) ───────────
// Sistema RBAC data-driven: Funcionalidade × Perfil × Nível (NENHUM/VISUALIZAR/EDITAR).
// Este arquivo é o CATÁLOGO (código); as permissões efetivas ficam no banco
// (tabelas Perfil + PerfilPermissao) e são editáveis na tela "Acessos & Permissões".
//
// Ao integrar um NOVO módulo/funcionalidade no ERP: adicione uma entrada aqui. O sistema
// detecta funcionalidades sem permissão definida e pede pra DONA configurar (fail-closed).

export type Nivel = 'NENHUM' | 'VISUALIZAR' | 'EDITAR'
export const NIVEIS: Nivel[] = ['NENHUM', 'VISUALIZAR', 'EDITAR']
export const NIVEL_LABEL: Record<Nivel, string> = { NENHUM: 'Nenhum', VISUALIZAR: 'Visualizar', EDITAR: 'Editar' }

// Perfis "de sistema" (built-in). A DONA é super-admin: sempre acesso total, não editável.
export interface PerfilSistema { chave: string; nome: string; descricao: string; superadmin?: boolean }
export const PERFIS_SISTEMA: PerfilSistema[] = [
  { chave: 'DONA', nome: 'Dona', descricao: 'Acesso total ao sistema.', superadmin: true },
  { chave: 'COORDENACAO', nome: 'Coordenação', descricao: 'Coordena unidades (validação, pós-venda, rotinas).' },
  { chave: 'RECEPCAO', nome: 'Recepção', descricao: 'Operação da recepção (caixa, pós-venda, rotinas da área).' },
  { chave: 'FINANCEIRO', nome: 'Financeiro', descricao: 'Consulta o sistema e edita reembolso e caixa.' },
  { chave: 'RH', nome: 'RH', descricao: 'Indicadores e avaliação de terapeutas.' },
  { chave: 'TERAPEUTA', nome: 'Terapeuta', descricao: 'Somente a própria área (Meus Atendimentos).' },
]

export interface Funcionalidade {
  chave: string
  label: string
  grupo: string
  // rotas (páginas/apis) que a funcionalidade cobre — usado no enforcement por rota.
  rotas?: string[]
  // acesso PADRÃO por perfil (semeia o comportamento atual; a DONA ajusta na tela).
  padrao: Record<string, Nivel>
}

// Atalhos p/ montar o padrão de forma legível.
const E: Nivel = 'EDITAR', V: Nivel = 'VISUALIZAR', N: Nivel = 'NENHUM'
// DONA é sempre EDITAR (superadmin) — incluída em cada linha por completude.
const p = (coord: Nivel, recep: Nivel, financ: Nivel, rh: Nivel, terap: Nivel): Record<string, Nivel> =>
  ({ DONA: E, COORDENACAO: coord, RECEPCAO: recep, FINANCEIRO: financ, RH: rh, TERAPEUTA: terap })

export const FUNCIONALIDADES: Funcionalidade[] = [
  // ── Visão Executiva ──
  { chave: 'inteligencia', label: 'Inteligência', grupo: 'Visão Executiva', rotas: ['/inteligencia', '/api/inteligencia'], padrao: p(V, N, V, N, N) },
  { chave: 'radar-geral', label: 'Radar Geral', grupo: 'Visão Executiva', rotas: ['/radar-geral', '/api/radar-geral'], padrao: p(V, V, V, N, N) },
  { chave: 'rotina-do-dia', label: 'Rotina do Dia', grupo: 'Visão Executiva', rotas: ['/rotina-do-dia', '/api/rotinas', '/api/tarefas-do-dia', '/api/erp/tarefas'], padrao: p(E, E, V, N, N) },
  { chave: 'reembolso', label: 'Reembolso Vouchers', grupo: 'Visão Executiva', rotas: ['/reembolso', '/api/reembolso'], padrao: p(N, N, E, N, N) },

  // ── Unidade ──
  { chave: 'dashboard', label: 'Dashboard da Unidade', grupo: 'Unidade', rotas: ['/dashboard', '/api/dashboard-unidade'], padrao: p(V, V, V, N, N) },
  { chave: 'historico', label: 'Histórico', grupo: 'Unidade', rotas: ['/dashboard/*/historico'], padrao: p(V, V, V, N, N) },
  { chave: 'terapeutas', label: 'Terapeutas (tabela)', grupo: 'Unidade', rotas: ['/terapeutas', '/dashboard/*/terapeutas', '/api/belle/terapeutas', '/api/terapeutas/atualizar'], padrao: p(V, N, V, V, N) },
  { chave: 'terapeutas-restrito', label: 'Terapeutas — colunas restritas (Nota Total/Gestor/Final/Categoria)', grupo: 'Unidade', padrao: p(N, N, V, V, N) },
  { chave: 'terapeutas-gestor', label: 'Terapeutas — editar Nota do Gestor', grupo: 'Unidade', rotas: ['/api/terapeutas/avaliacao'], padrao: p(N, N, E, E, N) },
  { chave: 'terapeutas-pesos', label: 'Terapeutas — gerir Pesos', grupo: 'Unidade', rotas: ['/api/terapeutas/pesos'], padrao: p(N, N, N, N, N) },
  { chave: 'metas', label: 'Metas', grupo: 'Unidade', rotas: ['/dashboard/*/metas', '/metas', '/api/metas'], padrao: p(V, V, V, N, N) },
  { chave: 'caixa', label: 'Controle de Caixa', grupo: 'Unidade', rotas: ['/caixa', '/api/rotinas/caixa'], padrao: p(V, E, E, N, N) },
  { chave: 'validacao', label: 'Validação de Atendimentos', grupo: 'Unidade', rotas: ['/validacao', '/api/validacao'], padrao: p(E, N, N, N, N) },
  { chave: 'pos-venda', label: 'Pós-venda', grupo: 'Unidade', rotas: ['/pos-venda', '/api/pos-venda'], padrao: p(E, E, N, N, N) },
  { chave: 'pontuacao', label: 'Pontuação', grupo: 'Unidade', rotas: ['/pontuacao', '/api/pontuacao'], padrao: p(E, N, N, N, N) },

  // ── Terapeuta ──
  { chave: 'meus-atendimentos', label: 'Meus Atendimentos', grupo: 'Terapeuta', rotas: ['/meus-atendimentos', '/api/meus-atendimentos'], padrao: p(N, N, N, N, E) },

  // ── Administração ──
  { chave: 'usuarios', label: 'Usuários', grupo: 'Administração', rotas: ['/usuarios', '/api/usuarios'], padrao: p(N, N, N, N, N) },
  { chave: 'permissoes', label: 'Acessos & Permissões', grupo: 'Administração', rotas: ['/acessos', '/api/permissoes'], padrao: p(N, N, N, N, N) },
  { chave: 'empresas', label: 'Empresas', grupo: 'Administração', rotas: ['/empresas', '/api/empresas'], padrao: p(N, N, N, N, N) },
  { chave: 'configuracoes', label: 'Configurações', grupo: 'Administração', rotas: ['/configuracoes'], padrao: p(N, N, N, N, N) },
]

// Grupos na ordem de exibição.
export const GRUPOS = ['Visão Executiva', 'Unidade', 'Terapeuta', 'Administração']

// ─── Matching rota → funcionalidade (puro, edge-safe: usado no proxy) ────────────

// `*` é curinga de UM segmento (ex.: '/dashboard/*/historico').
function rotaCasa(pattern: string, pathname: string): boolean {
  if (pattern.includes('*')) {
    const rx = new RegExp(
      '^' + pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, m => '\\' + m)).join('[^/]+') + '(?:/|$)',
    )
    return rx.test(pathname)
  }
  return pathname === pattern || pathname.startsWith(pattern + '/')
}

// Funcionalidade que cobre um pathname. Quando mais de uma casa (ex.: '/api/rotinas'
// e '/api/rotinas/caixa'), vence a MAIS específica (padrão mais longo). null = rota
// sem funcionalidade associada (não permissionável por rota → o proxy libera).
export function funcionalidadeDaRota(pathname: string): string | null {
  let melhor: { chave: string; peso: number } | null = null
  for (const f of FUNCIONALIDADES) {
    for (const r of f.rotas ?? []) {
      if (rotaCasa(r, pathname)) {
        const peso = r.replace(/\*/g, '').length
        if (!melhor || peso > melhor.peso) melhor = { chave: f.chave, peso }
      }
    }
  }
  return melhor?.chave ?? null
}

// nível atual >= nível mínimo exigido?
export function nivelAtende(atual: string | undefined, minimo: Nivel): boolean {
  const ordem: Record<string, number> = { NENHUM: 0, VISUALIZAR: 1, EDITAR: 2 }
  return (ordem[atual ?? 'NENHUM'] ?? 0) >= ordem[minimo]
}
