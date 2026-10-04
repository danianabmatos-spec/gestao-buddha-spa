import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function podeEditar(perfil: string) { return perfil === 'DONA' || perfil === 'FINANCEIRO' }
const TIPOS = ['A Pagar', 'A Receber']
const TIPOS_DESPESA = ['', 'Fixa', 'Variavel']

// GET /api/plano-contas — catálogo global de contas contábeis (para classificar e lançar).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  const contas = await prisma.planoConta.findMany({
    where: { ativa: true },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    select: { id: true, nome: true, tipo: true, tipoDespesa: true, codObrigacao: true, codProvisao: true },
  })
  return NextResponse.json({ contas })
}

// POST — cria uma conta. FINANCEIRO/DONA.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!podeEditar(session.perfil)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const nome = String(b?.nome ?? '').trim()
  const tipo = String(b?.tipo ?? '').trim()
  const tipoDespesa = String(b?.tipoDespesa ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe o nome da conta' }, { status: 400 })
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido (A Pagar | A Receber)' }, { status: 400 })
  if (!TIPOS_DESPESA.includes(tipoDespesa)) return NextResponse.json({ error: 'Tipo de despesa inválido' }, { status: 400 })

  const existe = await prisma.planoConta.findUnique({ where: { nome } })
  if (existe) {
    if (!existe.ativa) {
      // Reativa uma conta homônima que havia sido excluída (soft-delete).
      const r = await prisma.planoConta.update({ where: { id: existe.id }, data: { ativa: true, tipo, tipoDespesa } })
      return NextResponse.json({ conta: r, reativada: true }, { status: 200 })
    }
    return NextResponse.json({ error: 'Já existe uma conta com esse nome' }, { status: 409 })
  }
  const conta = await prisma.planoConta.create({
    data: { nome, tipo, tipoDespesa, codObrigacao: String(b?.codObrigacao ?? ''), codProvisao: String(b?.codProvisao ?? ''), ativa: true },
  })
  return NextResponse.json({ conta }, { status: 201 })
}

// PATCH — altera uma conta. FINANCEIRO/DONA.
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!podeEditar(session.perfil)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const id = Number(b?.id)
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const conta = await prisma.planoConta.findUnique({ where: { id } })
  if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (typeof b.nome === 'string' && b.nome.trim()) {
    const nome = b.nome.trim()
    const outro = await prisma.planoConta.findUnique({ where: { nome } })
    if (outro && outro.id !== id) return NextResponse.json({ error: 'Já existe uma conta com esse nome' }, { status: 409 })
    data.nome = nome
  }
  if (typeof b.tipo === 'string') { if (!TIPOS.includes(b.tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 }); data.tipo = b.tipo }
  if (typeof b.tipoDespesa === 'string') { if (!TIPOS_DESPESA.includes(b.tipoDespesa)) return NextResponse.json({ error: 'Tipo de despesa inválido' }, { status: 400 }); data.tipoDespesa = b.tipoDespesa }
  if (typeof b.codObrigacao === 'string') data.codObrigacao = b.codObrigacao
  if (typeof b.codProvisao === 'string') data.codProvisao = b.codProvisao
  await prisma.planoConta.update({ where: { id }, data })
  return NextResponse.json({ ok: true })
}

// DELETE /api/plano-contas?id=  — exclui. Se a conta estiver EM USO (classificações ou
// títulos), faz soft-delete (ativa=false) pra não corromper o histórico; senão, remove.
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!podeEditar(session.perfil)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const conta = await prisma.planoConta.findUnique({ where: { id } })
  if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  const usos = (await prisma.fonteExterna.count({ where: { planoContaId: id } }))
    + (await prisma.tituloPagar.count({ where: { planoContaId: id } }))
  if (usos > 0) {
    await prisma.planoConta.update({ where: { id }, data: { ativa: false } })
    return NextResponse.json({ ok: true, soft: true, usos })
  }
  await prisma.planoConta.delete({ where: { id } })
  return NextResponse.json({ ok: true, soft: false })
}
