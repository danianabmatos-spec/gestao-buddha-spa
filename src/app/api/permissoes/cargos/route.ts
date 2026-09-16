import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getCargosRH } from '@/lib/rh/acessos'
import { getMapaCargoPerfil, salvarCargoPerfil } from '@/lib/rh/cargo-perfil'
import { getPerfisAtribuiveis } from '@/lib/permissoes/store'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function exigirDona() {
  const session = await getSession()
  if (!session) return { erro: unauthorized() as NextResponse, session: null }
  if (session.perfil !== 'DONA') return { erro: NextResponse.json({ error: 'sem permissão' }, { status: 403 }), session }
  return { erro: null, session }
}

// GET — cargos do RH (com nº de ativos) + o perfil mapeado de cada + perfis atribuíveis.
export async function GET() {
  const { erro } = await exigirDona()
  if (erro) return erro
  try {
    const [cargosRh, mapa, perfis] = await Promise.all([getCargosRH(), getMapaCargoPerfil(), getPerfisAtribuiveis()])
    if (!cargosRh) return NextResponse.json({ rhIndisponivel: true, cargos: [], perfis })
    const cargos = cargosRh.map((c) => ({ cargo: c.cargo, ativos: c.ativos, perfilChave: mapa[c.cargo] ?? '' }))
    return NextResponse.json({ rhIndisponivel: false, cargos, perfis })
  } catch (e) {
    console.error('Erro ao listar cargos RH:', e)
    return NextResponse.json({ error: 'Falha ao carregar cargos do RH' }, { status: 500 })
  }
}

// PUT — define o perfil de UM cargo. Body: { cargo, perfilChave } ('' = sem acesso).
export async function PUT(req: NextRequest) {
  const { erro, session } = await exigirDona()
  if (erro) return erro
  const body = await req.json().catch(() => ({}))
  const cargo = String(body.cargo || '').trim()
  const perfilChave = String(body.perfilChave || '').trim()
  if (!cargo) return NextResponse.json({ error: 'cargo é obrigatório' }, { status: 400 })
  // '' = sem acesso; senão precisa ser um perfil ativo (sistema ou personalizado).
  if (perfilChave) {
    const perfis = await getPerfisAtribuiveis()
    const alvo = perfis.find((p) => p.chave === perfilChave)
    if (!alvo) return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })
    if (alvo.superadmin) return NextResponse.json({ error: 'Não é permitido mapear um cargo para um perfil de acesso total.' }, { status: 400 })
  }
  try {
    await salvarCargoPerfil(cargo, perfilChave)
    await prisma.logAuditoria.create({
      data: { usuarioId: session!.sub, acao: 'CARGO_PERFIL_MAPEAR', entidade: 'Cargo', dados: JSON.stringify({ cargo, perfilChave }).slice(0, 2000) },
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao salvar' }, { status: 400 })
  }
}
