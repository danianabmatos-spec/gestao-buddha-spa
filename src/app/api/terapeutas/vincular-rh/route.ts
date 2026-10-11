import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { normalizarNome } from '@/lib/rh/terapeutas-ativos'

const PERFIS_RESTRITO = new Set(['DONA', 'RH', 'FINANCEIRO'])

// POST /api/terapeutas/vincular-rh  { belleNome, rhNome }
// Vincula manualmente um terapeuta do Belle a um colaborador do R&S (quando o casamento
// automático de categoria não acha). rhNome vazio = remove o vínculo. Só DONA/RH/Financeiro.
// Tabela TerapeutaVinculoRH acessada por SQL raw (sem modelo no schema.prisma).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_RESTRITO.has(session.perfil)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const belleNome = String(body.belleNome || '').trim()
  const rhNome = String(body.rhNome || '').trim()
  if (!belleNome) return NextResponse.json({ error: 'belleNome é obrigatório' }, { status: 400 })

  const chave = normalizarNome(belleNome)

  if (!rhNome) {
    await prisma.$executeRawUnsafe(`DELETE FROM "TerapeutaVinculoRH" WHERE "belleNomeNorm" = ?`, chave)
    return NextResponse.json({ ok: true, removido: true })
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "TerapeutaVinculoRH" ("belleNomeNorm", "rhNome", "criadoPorNome", "atualizadoEm")
       VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT("belleNomeNorm")
       DO UPDATE SET "rhNome" = excluded."rhNome", "criadoPorNome" = excluded."criadoPorNome", "atualizadoEm" = datetime('now')`,
    chave, rhNome, session.nome ?? null,
  )
  return NextResponse.json({ ok: true, rhNome })
}
