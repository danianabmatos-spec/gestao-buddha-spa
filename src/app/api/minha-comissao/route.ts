import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { getNotasTerapeutasFolha } from '@/lib/folha/notas-terapeutas'
import { casarNome } from '@/lib/belle/matching'

export const dynamic = 'force-dynamic'

// Ano/mês atual no fuso de São Paulo.
function anoMesSP(): { ano: number; mes: number } {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return { ano: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)) }
}

// GET /api/minha-comissao?ano=&mes=
//   Comissão do mês da terapeuta logada — lida AO VIVO da Folha (read-only), pra ela
//   não precisar abrir o Folha só pra ver "quanto vou receber".
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const terapeuta = await prisma.terapeuta.findUnique({ where: { usuarioId: session.sub } })
  if (!terapeuta) return NextResponse.json({ terapeuta: false })

  const sp = anoMesSP()
  const params = new URL(req.url).searchParams
  const ano = Number(params.get('ano')) || sp.ano
  const mes = Number(params.get('mes')) || sp.mes

  try {
    const dados = await getNotasTerapeutasFolha(terapeuta.unidadeSlug, ano, mes)
    if (!dados.encontrado) {
      return NextResponse.json({ terapeuta: true, disponivel: true, encontrada: false, ano, mes, motivo: 'Fechamento deste mês ainda não disponível.' })
    }
    const eu = casarNome(terapeuta.nomeBelle || terapeuta.nome, dados.terapeutas)
    if (!eu) {
      return NextResponse.json({ terapeuta: true, disponivel: true, encontrada: false, ano, mes, motivo: 'Você ainda não aparece no fechamento deste mês.' })
    }
    return NextResponse.json({
      terapeuta: true,
      disponivel: true,
      encontrada: true,
      ano,
      mes,
      comissaoBruta: eu.comissao,
      nfEmitida: !!eu.nfComissaoNumero,
      nfNumero: eu.nfComissaoNumero,
    })
  } catch (e) {
    // Folha fora do ar / não configurada: a tela mostra "indisponível" sem quebrar.
    return NextResponse.json({ terapeuta: true, disponivel: false, ano, mes, erro: e instanceof Error ? e.message : 'Indisponível no momento' })
  }
}
