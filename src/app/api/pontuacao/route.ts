import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, unidadesPermitidas, resolveUnidade } from '@/lib/auth/guard'
import { getUnidadesDisponiveis, getUnidadeNome } from '@/lib/belle/unidades-config'
import { apurarPontuacao, apurarConsolidado } from '@/lib/pontuacao/apurar'

export const dynamic = 'force-dynamic'

const PERFIS_OK = ['DONA', 'COORDENACAO']

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/pontuacao[?unidade=slug&ref=YYYY-MM]
// Apuração/ranking da pontuação das terapeutas no mês.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_OK.includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito à coordenação.' }, { status: 403 })
  }

  const permitidas = unidadesPermitidas(session)
  const slugsDisponiveis = permitidas === null ? getUnidadesDisponiveis() : permitidas
  const unidades = slugsDisponiveis.map((slug) => ({ slug, nome: getUnidadeNome(slug) }))

  const sp = req.nextUrl.searchParams
  const ref = sp.get('ref') || mesAtual()

  // Visão GERAL (consolidado de todas as unidades permitidas).
  if (sp.get('geral')) {
    const consolidado = await apurarConsolidado(unidades, ref)
    return NextResponse.json({ geral: true, ...consolidado })
  }

  const unidade = resolveUnidade(session, sp.get('unidade')) || slugsDisponiveis[0]
  if (!unidade) return NextResponse.json({ error: 'Sem unidade disponível.' }, { status: 400 })

  const apuracao = await apurarPontuacao(unidade, ref)
  return NextResponse.json({ unidadeAtual: { slug: unidade, nome: getUnidadeNome(unidade) }, unidades, ...apuracao })
}
