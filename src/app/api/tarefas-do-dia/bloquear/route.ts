import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { telefoneCanonico } from '@/lib/inteligencia/central-clusters'

// POST /api/tarefas-do-dia/bloquear — bloqueia/desbloqueia contato por TELEFONE, SEM
// depender de uma tarefa na fila. Serve para "cancelar mensagens futuras" mesmo DEPOIS
// de já ter enviado a mensagem do dia (o cliente costuma sinalizar após receber), ou
// dias depois. Mesma auth Bearer da Central.
//
// Body: { telefone: string, motivo?: string, unidade?: string, obs?: string, desfazer?: boolean }
//   motivo: SEM_PLANO | OPT_OUT | OUTRO (default OUTRO).
//     • OPT_OUT (não quer receber mensagens) → bloqueio GLOBAL (todas as 7 unidades).
//     • demais → bloqueio na unidade informada (ou global se `unidade` não vier).
//   unidade: nome exibido OU slug (ex.: "Perdizes" ou "perdizes").
//   desfazer: true → reativa o telefone.
//
// O GET /tarefas-do-dia passa a excluir o telefone de TODOS os clusters. Para TotalPass,
// tenta espelhar planoCancelado (best-effort — o bloqueio por telefone já é o que vale).

export const dynamic = 'force-dynamic'

const UNIDADES = [
  { slug: 'shopping-metropole',     nome: 'Shopping Metrópole' },
  { slug: 'analia-franco',          nome: 'Anália Franco' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália Franco' },
  { slug: 'perdizes',               nome: 'Perdizes' },
  { slug: 'tatuape-gomescardim',    nome: 'Tatuapé Gomes Cardim' },
  { slug: 'mooca-plaza',            nome: 'Mooca Plaza' },
  { slug: 'higienopolis',           nome: 'Higienópolis' },
]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const NOME_PARA_SLUG = new Map(UNIDADES.map((u) => [norm(u.nome), u.slug]))
const SLUGS = new Set(UNIDADES.map((u) => u.slug))
// Variantes do telefone p/ casar registros do Belle (com ou sem DDI 55).
const variantesTelefone = (canon: string) => [...new Set([canon, '55' + canon])]

function autorizado(req: NextRequest): boolean {
  const token = process.env.CENTRAL_BEARER_TOKEN
  if (!token) return false
  return req.headers.get('authorization') === `Bearer ${token}`
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'nao_autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const telefone = telefoneCanonico(body.telefone) // canônico (sem DDI 55)
  if (telefone.length < 10) return NextResponse.json({ erro: 'telefone_invalido' }, { status: 400 })

  const motivo = String(body.motivo ?? '').trim() || 'OUTRO'
  const obs = body.obs != null ? String(body.obs) : null
  const desfazer = body.desfazer === true

  // Resolve unidade → slug (aceita nome exibido ou slug).
  let slug = ''
  if (body.unidade) {
    const u = String(body.unidade).trim()
    slug = SLUGS.has(u) ? u : (NOME_PARA_SLUG.get(norm(u)) ?? '')
  }
  // OPT_OUT bloqueia em toda a rede; demais na unidade (ou global se não veio unidade).
  const escopo = motivo.toUpperCase() === 'OPT_OUT' ? '*' : (slug || '*')

  if (desfazer) {
    await prisma.contatoBloqueado.deleteMany({
      where: { telefone, unidadeSlug: { in: [...new Set([escopo, slug, '*'].filter(Boolean))] } },
    })
    await prisma.clienteTotalPass
      .updateMany({ where: { telefone: { in: variantesTelefone(telefone) }, ...(slug ? { unidadeSlug: slug } : {}) }, data: { planoCancelado: false } })
      .catch(() => {})
    return NextResponse.json({ ok: true, desfeito: true })
  }

  // Nome (best-effort) para exibir no registro do bloqueio.
  const encontrado =
    (await prisma.clienteScore.findFirst({ where: { telefone: { in: variantesTelefone(telefone) } }, select: { nomeCliente: true } })) ??
    (await prisma.clienteTotalPass.findFirst({ where: { telefone: { in: variantesTelefone(telefone) } }, select: { nomeCliente: true } }))

  await prisma.contatoBloqueado.upsert({
    where: { unidadeSlug_telefone: { unidadeSlug: escopo, telefone } },
    create: { unidadeSlug: escopo, telefone, nomeCliente: encontrado?.nomeCliente ?? null, motivo, obs },
    update: { motivo, obs, ...(encontrado?.nomeCliente ? { nomeCliente: encontrado.nomeCliente } : {}) },
  })

  await prisma.clienteTotalPass
    .updateMany({ where: { telefone: { in: variantesTelefone(telefone) }, ...(slug ? { unidadeSlug: slug } : {}) }, data: { planoCancelado: true } })
    .catch(() => {})

  return NextResponse.json({ ok: true, escopo: escopo === '*' ? 'global' : 'unidade', motivo })
}
