import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
const CT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' }

// GET /api/rotinas/caixa/foto?f=caixa/xxx.jpg — serve a foto da notinha.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const f = new URL(req.url).searchParams.get('f') || ''
  // Segurança: só arquivos dentro de "caixa/", sem traversal.
  if (!f.startsWith('caixa/') || f.includes('..') || f.includes('\\')) {
    return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
  }
  const full = path.join(UPLOADS_DIR, f)
  try {
    const buf = await fs.readFile(full)
    const ext = f.split('.').pop()?.toLowerCase() || 'jpg'
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': CT[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
  }
}
