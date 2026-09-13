import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  // RECEPÇÃO travada na própria unidade; DONA opcionalmente filtra via ?unidade=
  const unidadeSlug = (session.perfil === 'DONA' || session.perfil === 'FINANCEIRO')
    ? (searchParams.get('unidade') || undefined)
    : session.unidadeSlug ?? undefined

  const agora    = new Date()
  const d0 = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
  const inicioDia    = d0(agora)
  const inicioSemana = (() => { const d = d0(agora); d.setDate(d.getDate() - d.getDay()); return d })()
  const inicioMes    = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicio30d    = new Date(agora); inicio30d.setDate(agora.getDate() - 29)
  const inicio7d     = new Date(agora); inicio7d.setDate(agora.getDate() - 6)

  const where = unidadeSlug ? { unidadeSlug } : {}

  // ─── Contagens de ações ─────────────────────────────────────────────────────
  const [hoje, semana, mes, porMotivo, porUnidade] = await Promise.all([
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicioDia } } }),
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicioSemana } } }),
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicioMes } } }),
    prisma.historicoContato.groupBy({
      by: ['motivoContato'],
      where: { ...where, criadoEm: { gte: inicioMes } },
      _count: { motivoContato: true },
    }),
    prisma.historicoContato.groupBy({
      by: ['unidadeSlug'],
      // Comparativo entre unidades é só para a DONA; recepção vê apenas a sua
      where: { ...where, criadoEm: { gte: inicioMes } },
      _count: { unidadeSlug: true },
    }),
  ])

  // ─── Conversões ─────────────────────────────────────────────────────────────
  const [totalContatados30d, totalConvertidos30d, conversoesPorMotivo] = await Promise.all([
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicio30d } } }),
    prisma.historicoContato.count({ where: { ...where, criadoEm: { gte: inicio30d }, converteu: true } }),
    prisma.historicoContato.groupBy({
      by: ['motivoContato', 'converteu'],
      where: { ...where, criadoEm: { gte: inicio30d } },
      _count: { converteu: true },
    }),
  ])

  // Taxa de conversão por grupo
  const convMap: Record<string, { total: number; convertidos: number }> = {}
  for (const row of conversoesPorMotivo) {
    if (!convMap[row.motivoContato]) convMap[row.motivoContato] = { total: 0, convertidos: 0 }
    convMap[row.motivoContato].total += row._count.converteu
    if (row.converteu) convMap[row.motivoContato].convertidos += row._count.converteu
  }
  const taxaPorGrupo = Object.entries(convMap).map(([grupo, { total, convertidos }]) => ({
    grupo,
    total,
    convertidos,
    taxa: total > 0 ? Math.round((convertidos / total) * 100) : 0,
  })).sort((a, b) => b.taxa - a.taxa)

  // ─── Série diária (últimos 30 dias) ─────────────────────────────────────────
  const historicoRaw = await prisma.historicoContato.findMany({
    where: { ...where, criadoEm: { gte: inicio30d } },
    select: { criadoEm: true, converteu: true },
    orderBy: { criadoEm: 'asc' },
  })

  const serieDiaria: Record<string, { data: string; contatos: number; conversoes: number }> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(inicio30d); d.setDate(inicio30d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    serieDiaria[key] = { data: key, contatos: 0, conversoes: 0 }
  }
  for (const h of historicoRaw) {
    const key = new Date(h.criadoEm).toISOString().slice(0, 10)
    if (serieDiaria[key]) {
      serieDiaria[key].contatos++
      if (h.converteu) serieDiaria[key].conversoes++
    }
  }

  // ─── Série semanal (últimas 12 semanas) ─────────────────────────────────────
  const inicio12s = new Date(agora); inicio12s.setDate(agora.getDate() - 83)
  const historicoSemanas = await prisma.historicoContato.findMany({
    where: { ...where, criadoEm: { gte: inicio12s } },
    select: { criadoEm: true, converteu: true },
  })
  const serieSemanasMap: Record<string, { semana: string; contatos: number; conversoes: number }> = {}
  for (const h of historicoSemanas) {
    const d = new Date(h.criadoEm)
    const dom = new Date(d); dom.setDate(d.getDate() - d.getDay())
    const key = dom.toISOString().slice(0, 10)
    if (!serieSemanasMap[key]) serieSemanasMap[key] = { semana: key, contatos: 0, conversoes: 0 }
    serieSemanasMap[key].contatos++
    if (h.converteu) serieSemanasMap[key].conversoes++
  }

  // ─── Últimos contatos ────────────────────────────────────────────────────────
  const ultimosContatos = await prisma.historicoContato.findMany({
    where,
    orderBy: { criadoEm: 'desc' },
    take: 50,
    select: {
      id: true, nomeCliente: true, unidadeSlug: true, motivoContato: true,
      criadoEm: true, converteu: true, tipoConversao: true, dataConversao: true,
    },
  })

  const taxaGeral = totalContatados30d > 0
    ? Math.round((totalConvertidos30d / totalContatados30d) * 100)
    : 0

  const porMotivoSorted = [...porMotivo].sort((a, b) => b._count.motivoContato - a._count.motivoContato)
  const porUnidadeSorted = [...porUnidade].sort((a, b) => b._count.unidadeSlug - a._count.unidadeSlug)

  return NextResponse.json({
    acoes: { hoje, semana, mes, porMotivo: porMotivoSorted, porUnidade: porUnidadeSorted },
    conversoes: {
      totalContatados30d, totalConvertidos30d, taxaGeral, taxaPorGrupo,
    },
    series: {
      diaria:  Object.values(serieDiaria),
      semanal: Object.values(serieSemanasMap).sort((a, b) => a.semana.localeCompare(b.semana)),
    },
    ultimosContatos,
  })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[resultados]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
