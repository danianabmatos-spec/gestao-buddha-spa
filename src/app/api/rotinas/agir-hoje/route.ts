import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, resolveUnidade, unidadesPermitidas } from '@/lib/auth/guard'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getDetratoresNeutros, buscarRelatorioNPS } from '@/lib/belle/relatorio-nps'
import { getAvaliacoesNaoCinco } from '@/lib/google/places-api'
import { hojeISO } from '@/lib/rotinas/motor'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// GET /api/rotinas/agir-hoje?unidade=slug
// Inteligência acionável do dia: detratores/neutros do NPS (mês atual) + avaliações
// do Google ≠ 5 estrelas, para a coordenadora tratar. Cada fonte falha isolada.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)

  const permitidas = unidadesPermitidas(session)
  const unidades = await prisma.unidade.findMany({
    where: permitidas === null ? { ativa: true } : { slug: { in: permitidas } },
    orderBy: { id: 'asc' },
    select: { id: true, nome: true, slug: true },
  })
  const slug = resolveUnidade(session, searchParams.get('unidade'))
  const unidade = unidades.find((u) => u.slug === slug) ?? unidades[0]
  if (!unidade) return NextResponse.json({ error: 'Nenhuma unidade no escopo.' }, { status: 403 })

  const cred = getUnidadeCredenciais(unidade.slug)
  if (!cred) return NextResponse.json({ error: 'Credenciais da unidade não configuradas.' }, { status: 500 })

  const hoje = hojeISO()
  // Período do NPS: MÊS INTEIRO por padrão (dia 1 ao último dia); aceita ?ini/?fim.
  const [ay, am] = hoje.split('-').map(Number)
  const ultimoDia = new Date(ay, am, 0).getDate()
  const inicioMes = searchParams.get('ini') || `${hoje.slice(0, 7)}-01`
  const fimPeriodo = searchParams.get('fim') || `${hoje.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`

  const [npsRes, googleRes] = await Promise.allSettled([
    getDetratoresNeutros(cred.email, cred.password, inicioMes, fimPeriodo, cred.estab),
    getAvaliacoesNaoCinco(cred.placeId, process.env.GOOGLE_PLACES_API_KEY || ''),
  ])

  const mesAtual = hoje.slice(0, 7)

  // Casos de NPS (chave estável = id do atendimento).
  const npsTotal = npsRes.status === 'fulfilled' ? npsRes.value.total : 0
  const npsCasos = npsRes.status === 'fulfilled'
    ? npsRes.value.avaliacoes.map((a) => ({ ...a, chaveCaso: a.idAtendimento || `${a.cliente}|${a.data}` }))
    : []

  // Casos do Google: só avaliações ≠5★ DESTE MÊS (Daniana não quer meses anteriores).
  // ⚠️ A Places API pública só devolve ~5 reviews "mais relevantes" (de meses variados)
  // e NÃO inclui as mais recentes — então as de setembro quase nunca aparecem aqui.
  // Solução definitiva = Google Business Profile API (todas as reviews, por data).
  const googleBase = googleRes.status === 'fulfilled'
    ? googleRes.value
    : { nota: 0, totalAvaliacoes: 0, url: '', avaliacoes: [] as { nota: number; texto: string; autor: string; quando: string; publishTime: string }[] }
  const googleCasos = googleBase.avaliacoes
    .filter((a) => (a.publishTime || '').slice(0, 7) === mesAtual)
    .map((a) => ({ ...a, chaveCaso: `google|${a.autor}|${a.publishTime}` }))

  // Uma consulta só para as tratativas de todos os casos (NPS + Google).
  const todasChaves = [...npsCasos.map((c) => c.chaveCaso), ...googleCasos.map((c) => c.chaveCaso)]
  const tratativas = todasChaves.length
    ? await prisma.tratativaNps.findMany({
        where: { unidadeId: unidade.id, chaveCaso: { in: todasChaves } },
        select: {
          chaveCaso: true, acaoTomada: true, tipoProblema: true,
          cortesiaConcedida: true, clienteSatisfeito: true, tratadoPorNome: true, atualizadoEm: true,
        },
      })
    : []
  const mapaT = new Map(tratativas.map((t) => [t.chaveCaso, t]))
  const anexarTratativa = <T extends { chaveCaso: string }>(c: T) => {
    const t = mapaT.get(c.chaveCaso)
    return {
      ...c,
      tratativa: t
        ? {
            acaoTomada: t.acaoTomada, tipoProblema: t.tipoProblema,
            cortesiaConcedida: t.cortesiaConcedida, clienteSatisfeito: t.clienteSatisfeito,
            por: t.tratadoPorNome, em: t.atualizadoEm,
          }
        : null,
    }
  }

  const nps = npsRes.status === 'fulfilled'
    ? { periodo: { inicio: inicioMes, fim: fimPeriodo }, totalRespostas: npsTotal, avaliacoes: npsCasos.map(anexarTratativa) }
    : { periodo: { inicio: inicioMes, fim: fimPeriodo }, totalRespostas: 0, avaliacoes: [] as unknown[], erro: 'Não foi possível carregar o NPS do Belle agora.' }

  const google = googleRes.status === 'fulfilled'
    ? { nota: googleBase.nota, totalAvaliacoes: googleBase.totalAvaliacoes, url: googleBase.url, mes: mesAtual, avaliacoes: googleCasos.map(anexarTratativa) }
    : { nota: 0, totalAvaliacoes: 0, url: '', mes: mesAtual, avaliacoes: [] as unknown[], erro: 'Não foi possível carregar as avaliações do Google agora.' }

  // Debug: total bruto do Report 21 + distribuição de classificação (?debug=1)
  let debug: unknown = undefined
  if (searchParams.get('debug') === '1') {
    try {
      const raw = await buscarRelatorioNPS(cred.email, cred.password, inicioMes, fimPeriodo, cred.estab)
      const dist: Record<string, number> = {}
      const datas = new Set<string>()
      for (const r of raw) {
        const c = String((r as any[])[2] || '(vazio)').trim(); dist[c] = (dist[c] || 0) + 1
        datas.add(String((r as any[])[0] || '').slice(0, 10))
      }
      debug = { periodo: { inicioMes, fimPeriodo }, totalRegistros: raw.length, distribuicao: dist, datasDistintas: [...datas].sort() }
    } catch (e) { debug = { erro: String(e) } }
  }

  return NextResponse.json({
    perfil: session.perfil,
    unidadeAtual: unidade,
    unidades,
    nps,
    google,
    ...(debug ? { debug } : {}),
  })
}
