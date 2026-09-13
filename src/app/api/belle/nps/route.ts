import { NextRequest, NextResponse } from 'next/server'
import { getNPSRelatorio } from '@/lib/belle/relatorio-nps'

const UNIDADES: Record<string, { email: string; senha: string; estab: number }> = {
  'shopping-metropole': {
    email: process.env.BELLE_METROPOLE_EMAIL!,
    senha: process.env.BELLE_METROPOLE_PASSWORD!,
    estab: parseInt(process.env.BELLE_METROPOLE_ESTAB || '1'),
  },
  'analia-franco': {
    email: process.env.BELLE_ANALIA_FRANCO_EMAIL!,
    senha: process.env.BELLE_ANALIA_FRANCO_PASSWORD!,
    estab: parseInt(process.env.BELLE_ANALIA_FRANCO_ESTAB || '1'),
  },
  'shopping-analia-franco': {
    email: process.env.BELLE_SHOPPING_ANALIA_FRANCO_EMAIL!,
    senha: process.env.BELLE_SHOPPING_ANALIA_FRANCO_PASSWORD!,
    estab: parseInt(process.env.BELLE_SHOPPING_ANALIA_FRANCO_ESTAB || '1'),
  },
  'perdizes': {
    email: process.env.BELLE_PERDIZES_EMAIL!,
    senha: process.env.BELLE_PERDIZES_PASSWORD!,
    estab: parseInt(process.env.BELLE_PERDIZES_ESTAB || '1'),
  },
  'tatuape-gomescardim': {
    email: process.env.BELLE_TATUAPE_GOMESCARDIM_EMAIL!,
    senha: process.env.BELLE_TATUAPE_GOMESCARDIM_PASSWORD!,
    estab: parseInt(process.env.BELLE_TATUAPE_GOMESCARDIM_ESTAB || '1'),
  },
  'mooca-plaza': {
    email: process.env.BELLE_MOOCA_PLAZA_EMAIL!,
    senha: process.env.BELLE_MOOCA_PLAZA_PASSWORD!,
    estab: parseInt(process.env.BELLE_MOOCA_PLAZA_ESTAB || '1'),
  },
  'higienopolis': {
    email: process.env.BELLE_HIGIENOPOLIS_EMAIL!,
    senha: process.env.BELLE_HIGIENOPOLIS_PASSWORD!,
    estab: parseInt(process.env.BELLE_HIGIENOPOLIS_ESTAB || '1'),
  },
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dataIni = searchParams.get('dataIni')
    const dataFim = searchParams.get('dataFim')
    const unidadeSlug = searchParams.get('unidade') ?? 'shopping-metropole'

    if (!dataIni || !dataFim) {
      return NextResponse.json(
        { error: 'Parâmetros dataIni e dataFim são obrigatórios' },
        { status: 400 }
      )
    }

    const unidade = UNIDADES[unidadeSlug]
    if (!unidade) {
      return NextResponse.json(
        { error: 'Unidade não encontrada' },
        { status: 404 }
      )
    }

    const npsData = await getNPSRelatorio(
      unidade.email,
      unidade.senha,
      dataIni,
      dataFim,
      unidade.estab
    )

    return NextResponse.json(npsData)
  } catch (error) {
    console.error('Erro ao buscar NPS:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados de NPS' },
      { status: 500 }
    )
  }
}
