import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const CAMPOS = ['razaoSocial', 'cnpj', 'nomeFantasia', 'inscricaoEstadual', 'inscricaoMunicipal', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'telefone', 'emailFiscal', 'unidadeSlug'] as const

function sanitizar(b: any): Record<(typeof CAMPOS)[number], string> {
  const out = {} as Record<(typeof CAMPOS)[number], string>
  for (const c of CAMPOS) out[c] = String(b?.[c] ?? '').trim()
  return out
}

// GET /api/empresas — lista empresas (Dona) + unidades para vincular
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const empresas = await prisma.empresa.findMany({ orderBy: { nomeFantasia: 'asc' } })
  const unidades = await prisma.unidade.findMany({ where: { ativa: true }, orderBy: { nome: 'asc' }, select: { slug: true, nome: true } })
  return Response.json({ empresas, unidades })
}

// POST /api/empresas — cria empresa
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') return Response.json({ error: 'Acesso restrito' }, { status: 403 })

  const d = sanitizar(await req.json())
  if (!d.razaoSocial || !d.cnpj) {
    return Response.json({ ok: false, error: 'Razão social e CNPJ são obrigatórios.' }, { status: 400 })
  }
  const existe = await prisma.empresa.findUnique({ where: { cnpj: d.cnpj }, select: { id: true } })
  if (existe) return Response.json({ ok: false, error: 'Já existe empresa com esse CNPJ.' }, { status: 409 })

  const empresa = await prisma.empresa.create({ data: { ...d, uf: d.uf || 'SP' } })
  return Response.json({ ok: true, empresa })
}
