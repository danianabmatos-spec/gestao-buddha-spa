import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const CAMPOS = ['razaoSocial', 'cnpj', 'nomeFantasia', 'inscricaoEstadual', 'inscricaoMunicipal', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'telefone', 'emailFiscal', 'unidadeSlug'] as const

// PATCH /api/empresas/[id] — atualiza empresa
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { id } = await params
  const b = await req.json()
  const data: Record<string, unknown> = {}
  for (const c of CAMPOS) if (b[c] !== undefined) data[c] = String(b[c] ?? '').trim()
  if (typeof b.ativa === 'boolean') data.ativa = b.ativa

  if (data.cnpj !== undefined && !data.cnpj) return Response.json({ ok: false, error: 'CNPJ não pode ficar vazio.' }, { status: 400 })
  if (data.cnpj) {
    const outra = await prisma.empresa.findFirst({ where: { cnpj: data.cnpj as string, id: { not: Number(id) } }, select: { id: true } })
    if (outra) return Response.json({ ok: false, error: 'Já existe empresa com esse CNPJ.' }, { status: 409 })
  }

  try {
    const empresa = await prisma.empresa.update({ where: { id: Number(id) }, data })
    return Response.json({ ok: true, empresa })
  } catch {
    return Response.json({ ok: false, error: 'Empresa não encontrada.' }, { status: 404 })
  }
}

// DELETE /api/empresas/[id] — remove empresa
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const { id } = await params
  try {
    await prisma.empresa.delete({ where: { id: Number(id) } })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false, error: 'Empresa não encontrada.' }, { status: 404 })
  }
}
