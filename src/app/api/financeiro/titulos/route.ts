import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized, resolveUnidade } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ymd = (s: unknown): string | null => {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
// Soma i meses a uma data "YYYY-MM-DD", travando o dia ao último do mês-alvo.
function addMeses(data: string, i: number): string {
  const [y, m, d] = data.split('-').map(Number)
  const alvo = (m - 1) + i
  const ano = y + Math.floor(alvo / 12)
  const mes = ((alvo % 12) + 12) % 12
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  const dia = Math.min(d, ultimo)
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}
const hojeYmd = () => new Date().toLocaleDateString('en-CA')

// GET /api/financeiro/titulos?unidade=&status=&ano=
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  const { searchParams } = new URL(request.url)
  const unidadeSlug = resolveUnidade(session, searchParams.get('unidade'))
  if (!unidadeSlug) return NextResponse.json({ error: 'Informe uma unidade válida' }, { status: 400 })
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug }, select: { id: true } })
  if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })

  const status = searchParams.get('status') || undefined
  const ano = searchParams.get('ano')
  const titulos = await prisma.tituloPagar.findMany({
    where: {
      unidadeId: unidade.id,
      ...(status ? { status } : {}),
      ...(ano ? { dataVencimento: { startsWith: `${ano}-` } } : {}),
    },
    orderBy: [{ dataVencimento: 'asc' }],
    include: { planoConta: { select: { nome: true } } },
  })
  return NextResponse.json({ titulos })
}

// POST /api/financeiro/titulos — cria título(s); totalParcelas>1 gera N mensais. FINANCEIRO/DONA.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA' && session.perfil !== 'FINANCEIRO') {
    return NextResponse.json({ error: 'Só o financeiro ou a dona/dono pode lançar títulos' }, { status: 403 })
  }
  const b = await request.json().catch(() => ({}))
  const unidadeSlug = resolveUnidade(session, b?.unidade)
  if (!unidadeSlug) return NextResponse.json({ error: 'Selecione uma unidade' }, { status: 400 })
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug }, select: { id: true } })
  if (!unidade) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })

  const descricao = String(b.descricao ?? '').trim()
  const valorTotal = Number(b.valor) || 0
  if (!descricao) return NextResponse.json({ error: 'Informe a descrição' }, { status: 400 })
  if (valorTotal <= 0) return NextResponse.json({ error: 'Informe um valor válido' }, { status: 400 })

  const n = Math.max(1, Math.min(60, Number(b.totalParcelas) || 1))
  const vencBase = ymd(b.dataVencimento) || hojeYmd()
  const compBase = ymd(b.dataCompetencia) || vencBase
  const valorParcela = Math.round((valorTotal / n) * 100) / 100

  const criados = []
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? Math.round((valorTotal - valorParcela * (n - 1)) * 100) / 100 : valorParcela
    const t = await prisma.tituloPagar.create({
      data: {
        unidadeId: unidade.id,
        planoContaId: b.planoContaId ? Number(b.planoContaId) : null,
        descricao: n > 1 ? `${descricao} (${i + 1}/${n})` : descricao,
        fornecedorTexto: String(b.fornecedorTexto ?? ''),
        valor,
        parcela: i + 1,
        totalParcelas: n,
        dataEmissao: hojeYmd(),
        dataCompetencia: addMeses(compBase, i),
        dataVencimento: addMeses(vencBase, i),
        formaPagamento: String(b.formaPagamento ?? ''),
        pagamentoAntecipado: Boolean(b.pagamentoAntecipado),
        status: 'PREVISTO',
        origem: 'MANUAL',
      },
    })
    criados.push(t)
  }
  return NextResponse.json({ titulos: criados }, { status: 201 })
}
