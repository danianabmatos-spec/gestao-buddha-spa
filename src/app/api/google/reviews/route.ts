import { NextRequest, NextResponse } from 'next/server'
import { getGoogleReviews } from '@/lib/google/places-api'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const unidade = searchParams.get('unidade')

    if (!unidade) {
      return NextResponse.json(
        { error: 'Parâmetro unidade é obrigatório' },
        { status: 400 }
      )
    }

    // Verifica se a API key está configurada
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_PLACES_API_KEY não configurada' },
        { status: 500 }
      )
    }

    // Place IDs das unidades (configurar no .env.local)
    const placeIds: Record<string, string> = {
      'shopping-metropole': process.env.PLACE_ID_SHOPPING_METROPOLE || '',
      'analia-franco': process.env.PLACE_ID_ANALIA_FRANCO || '',
      'shopping-analia-franco': process.env.PLACE_ID_SHOPPING_ANALIA_FRANCO || '',
      'perdizes': process.env.PLACE_ID_PERDIZES || '',
      'tatuape-gomescardim': process.env.PLACE_ID_TATUAPE_GOMESCARDIM || '',
      'mooca-plaza': process.env.PLACE_ID_MOOCA_PLAZA || '',
      'higienopolis': process.env.PLACE_ID_HIGIENOPOLIS || ''
    }

    const placeId = placeIds[unidade]

    if (!placeId) {
      return NextResponse.json(
        { error: `Place ID não configurado para unidade: ${unidade}. Configure PLACE_ID_${unidade.toUpperCase().replace(/-/g, '_')} no .env.local` },
        { status: 404 }
      )
    }

    // Busca dados do Google Places API
    const reviewsData = await getGoogleReviews(placeId, apiKey)

    return NextResponse.json(reviewsData)
  } catch (error) {
    console.error('Erro ao buscar avaliações do Google:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados de avaliações', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
