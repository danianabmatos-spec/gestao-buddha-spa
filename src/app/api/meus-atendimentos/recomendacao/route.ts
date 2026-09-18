import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }

function num(v: FormDataEntryValue | null): number | null {
  const n = Number(v)
  return v != null && v !== '' && Number.isFinite(n) ? n : null
}
function txt(v: FormDataEntryValue | null): string | null {
  const s = v == null ? '' : String(v).trim()
  return s ? s : null
}

// POST /api/meus-atendimentos/recomendacao  (multipart/form-data)
// Campos: belleId, notaSono, notaEnergia, notaEstresse, pontosTensao, retorno,
//         observacao, itens (JSON de string[]), foto (File, opcional).
// Registra/atualiza a recomendação (o "bloquinho" digital) daquele atendimento.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ error: 'Usuário não é uma terapeuta.' }, { status: 403 })

  const form = await req.formData()
  const belleId = txt(form.get('belleId'))
  if (!belleId) return NextResponse.json({ error: 'Informe o atendimento.' }, { status: 400 })

  const at = await prisma.atendimento.findUnique({ where: { belleId } })
  if (!at || at.terapeutaId !== terapeuta.id) {
    return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })
  }

  // Itens (checkboxes do bloquinho) — array de tipos.
  let itens: string[] = []
  try {
    const raw = form.get('itens')
    if (raw) itens = (JSON.parse(String(raw)) as unknown[]).map(String).filter(Boolean)
  } catch { itens = [] }

  // Foto do bloquinho (opcional).
  let fotoPath: string | undefined
  const foto = form.get('foto')
  if (foto && typeof foto === 'object' && 'arrayBuffer' in foto && (foto as File).size > 0) {
    const file = foto as File
    const ext = EXT[file.type] || 'jpg'
    const safe = belleId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const rel = `recomendacao/${safe}.${ext}`
    const full = path.join(UPLOADS_DIR, rel)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, new Uint8Array(await file.arrayBuffer()))
    fotoPath = rel
  }

  const base = {
    unidadeSlug: at.unidadeSlug,
    usuarioId: session.sub,
    terapeutaNome: terapeuta.nome,
    clienteNome: at.clienteNome,
    dataAtendimento: at.data,
    servico: at.servico,
    notaSono: num(form.get('notaSono')),
    notaEnergia: num(form.get('notaEnergia')),
    notaEstresse: num(form.get('notaEstresse')),
    pontosTensao: txt(form.get('pontosTensao')),
    retorno: txt(form.get('retorno')),
    observacao: txt(form.get('observacao')),
    ...(fotoPath ? { fotoPath } : {}),
  }

  const rec = await prisma.recomendacao.upsert({
    where: { belleId },
    create: { belleId, ...base },
    update: base,
  })

  // Substitui os itens.
  await prisma.recomendacaoItem.deleteMany({ where: { recomendacaoId: rec.id } })
  if (itens.length) {
    await prisma.recomendacaoItem.createMany({
      data: itens.map((tipo) => ({ recomendacaoId: rec.id, tipo })),
    })
  }

  return NextResponse.json({ ok: true })
}
