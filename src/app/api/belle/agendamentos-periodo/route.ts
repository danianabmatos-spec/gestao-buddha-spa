import { NextRequest } from 'next/server'
import { getAgendamentos } from '@/lib/belle/client'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import type { BelleAgendamento } from '@/lib/belle/types'

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
  const dataIni = searchParams.get('dataIni')
  const dataFim = searchParams.get('dataFim')
  const unidadeSlug = searchParams.get('unidade') ?? 'shopping-metropole'

  if (!dataIni || !dataFim) {
    return Response.json({ error: 'dataIni e dataFim são obrigatórios' }, { status: 400 })
  }

  const unidade = UNIDADES.find((u) => u.slug === unidadeSlug)
  if (!unidade) {
    return Response.json({ error: 'Unidade não encontrada' }, { status: 404 })
  }

  try {
    const inicio = parseISO(dataIni)
    const fim = parseISO(dataFim)
    const dias = eachDayOfInterval({ start: inicio, end: fim })

    // Busca agendamentos de cada dia do período
    const todosAgendamentos: BelleAgendamento[] = []

    for (const dia of dias) {
      try {
        const dataStr = format(dia, 'yyyy-MM-dd')
        const agendamentos = await getAgendamentos(
          unidade.email,
          unidade.senha,
          dataStr,
          unidade.estab
        )

        // Adiciona a data ao agendamento para processamento posterior
        const agendamentosComData = agendamentos.map(ag => ({
          ...ag,
          data: dataStr
        }))

        todosAgendamentos.push(...agendamentosComData)
      } catch (err) {
        console.error(`Erro ao buscar ${format(dia, 'yyyy-MM-dd')}:`, err)
        // Continua com os outros dias mesmo se um falhar
      }
    }

    return Response.json({
      unidade: unidade.nome,
      dataIni,
      dataFim,
      totalDias: dias.length,
      agendamentos: todosAgendamentos
    })
  } catch (err) {
    console.error('[Belle API Error - Período]', err)
    return Response.json({ error: 'Erro ao buscar dados do Belle' }, { status: 500 })
  }
}
