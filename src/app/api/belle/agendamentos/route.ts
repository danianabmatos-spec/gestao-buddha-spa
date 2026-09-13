import { NextRequest } from 'next/server'
import { getAgendamentos } from '@/lib/belle/client'
import { processarAgendamentos } from '@/lib/belle/agregacoes'
import { format } from 'date-fns'

const UNIDADES = [
  {
    slug: 'shopping-metropole',
    nome: 'Shopping Metrópole',
    email: process.env.BELLE_METROPOLE_EMAIL!,
    senha: process.env.BELLE_METROPOLE_PASSWORD!,
    estab: parseInt(process.env.BELLE_METROPOLE_ESTAB ?? '1'),
  },
  {
    slug: 'analia-franco',
    nome: 'Anália Franco',
    email: process.env.BELLE_ANALIA_FRANCO_EMAIL!,
    senha: process.env.BELLE_ANALIA_FRANCO_PASSWORD!,
    estab: parseInt(process.env.BELLE_ANALIA_FRANCO_ESTAB ?? '1'),
  },
  {
    slug: 'shopping-analia-franco',
    nome: 'Shopping Anália Franco',
    email: process.env.BELLE_SHOPPING_ANALIA_FRANCO_EMAIL!,
    senha: process.env.BELLE_SHOPPING_ANALIA_FRANCO_PASSWORD!,
    estab: parseInt(process.env.BELLE_SHOPPING_ANALIA_FRANCO_ESTAB ?? '1'),
  },
  {
    slug: 'perdizes',
    nome: 'Perdizes',
    email: process.env.BELLE_PERDIZES_EMAIL!,
    senha: process.env.BELLE_PERDIZES_PASSWORD!,
    estab: parseInt(process.env.BELLE_PERDIZES_ESTAB ?? '1'),
  },
  {
    slug: 'tatuape-gomescardim',
    nome: 'Tatuapé Gomes Cardim',
    email: process.env.BELLE_TATUAPE_GOMESCARDIM_EMAIL!,
    senha: process.env.BELLE_TATUAPE_GOMESCARDIM_PASSWORD!,
    estab: parseInt(process.env.BELLE_TATUAPE_GOMESCARDIM_ESTAB ?? '1'),
  },
  {
    slug: 'mooca-plaza',
    nome: 'Mooca Plaza',
    email: process.env.BELLE_MOOCA_PLAZA_EMAIL!,
    senha: process.env.BELLE_MOOCA_PLAZA_PASSWORD!,
    estab: parseInt(process.env.BELLE_MOOCA_PLAZA_ESTAB ?? '1'),
  },
  {
    slug: 'higienopolis',
    nome: 'Higienópolis',
    email: process.env.BELLE_HIGIENOPOLIS_EMAIL!,
    senha: process.env.BELLE_HIGIENOPOLIS_PASSWORD!,
    estab: parseInt(process.env.BELLE_HIGIENOPOLIS_ESTAB ?? '1'),
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const dataParam = searchParams.get('data') ?? format(new Date(), 'yyyy-MM-dd')
  const unidadeSlug = searchParams.get('unidade') ?? 'shopping-metropole'

  const unidade = UNIDADES.find((u) => u.slug === unidadeSlug)
  if (!unidade) {
    return Response.json({ error: 'Unidade não encontrada' }, { status: 404 })
  }

  try {
    const agendamentos = await getAgendamentos(unidade.email, unidade.senha, dataParam, unidade.estab)
    const resultado = processarAgendamentos(agendamentos, dataParam, unidade.nome)
    return Response.json(resultado)
  } catch (err) {
    console.error('[Belle API Error]', err)
    return Response.json({ error: 'Erro ao buscar dados do Belle' }, { status: 500 })
  }
}
