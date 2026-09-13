import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade, unidadesPermitidas } from '@/lib/auth/guard'
import { hojeISO } from '@/lib/rotinas/motor'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }

async function checarUnidade(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, slugReq: string | null) {
  const permitidas = unidadesPermitidas(session)
  const slug = resolveUnidade(session, slugReq)
  if (permitidas !== null && (!slug || !permitidas.includes(slug))) return null
  return prisma.unidade.findUnique({ where: { slug: slug ?? '' }, select: { id: true } })
}

// POST /api/rotinas/caixa/saida
// { unidade, data?, valor, descricao, fotoBase64?, fotoMime? } — registra uma saída.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const valor = body.valor != null && body.valor !== '' ? Number(body.valor) : null
  if (valor == null || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Informe um valor válido.' }, { status: 400 })
  }
  const descricao = String(body.descricao || '').trim()
  if (!descricao) return NextResponse.json({ error: 'Descreva a saída.' }, { status: 400 })

  const unidade = await checarUnidade(session, body.unidade)
  if (!unidade) return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  const data = body.data || hojeISO()

  // Salva a foto da notinha (opcional), enviada como base64.
  let fotoPath: string | null = null
  if (typeof body.fotoBase64 === 'string' && body.fotoBase64.length > 0) {
    const m = body.fotoBase64.match(/^data:([^;]+);base64,(.*)$/)
    const mime = m ? m[1] : (body.fotoMime || 'image/jpeg')
    const b64 = m ? m[2] : body.fotoBase64
    const ext = EXT[mime] || 'jpg'
    const buf = Buffer.from(b64, 'base64')
    if (buf.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Foto muito grande (máx. 8MB).' }, { status: 400 })
    const nome = `caixa/${unidade.id}_${data}_${Date.now()}_${Math.round(buf.length % 100000)}.${ext}`
    await fs.mkdir(path.join(UPLOADS_DIR, 'caixa'), { recursive: true })
    await fs.writeFile(path.join(UPLOADS_DIR, nome), buf)
    fotoPath = nome
  }

  const saida = await prisma.saidaCaixa.create({
    data: { unidadeId: unidade.id, data, valor, descricao, fotoPath, criadoPorId: session.sub, criadoPorNome: session.nome },
  })
  return NextResponse.json({ ok: true, saida })
}

// DELETE /api/rotinas/caixa/saida?id=123 — remove a saída (e a foto).
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'Informe o id.' }, { status: 400 })

  const registro = await prisma.saidaCaixa.findUnique({ where: { id } })
  if (!registro) return NextResponse.json({ error: 'Saída não encontrada.' }, { status: 404 })

  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null) {
    const u = await prisma.unidade.findUnique({ where: { id: registro.unidadeId }, select: { slug: true } })
    if (!u || !permitidas.includes(u.slug)) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  }

  if (registro.fotoPath) {
    await fs.unlink(path.join(UPLOADS_DIR, registro.fotoPath)).catch(() => {})
  }
  await prisma.saidaCaixa.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
