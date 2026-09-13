/**
 * Google Places API (New) - Integração para buscar dados de avaliações
 *
 * Documentação: https://developers.google.com/maps/documentation/places/web-service/place-details
 */

export interface GooglePlaceDetails {
  placeId: string
  displayName: string
  rating: number
  userRatingCount: number
  formattedAddress?: string
  googleMapsUri?: string
}

export interface GoogleReviewsResult {
  rating: number
  totalReviews: number
  distribution: {
    fiveStars: number
    fourStars: number
    threeStars: number
    twoStars: number
    oneStar: number
  }
  placeId: string
  url: string
}

/**
 * Busca detalhes de um local usando Place ID
 * Requer: GOOGLE_PLACES_API_KEY
 */
export async function getPlaceDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails> {
  // Normaliza o Place ID: adiciona prefixo "places/" se não tiver
  const normalizedPlaceId = placeId.startsWith('places/') ? placeId : `places/${placeId}`

  const fields = [
    'id',
    'displayName',
    'rating',
    'userRatingCount',
    'reviews',
    'formattedAddress',
    'googleMapsUri'
  ].join(',')

  const url = `https://places.googleapis.com/v1/${normalizedPlaceId}`

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': fields
  }
})

  console.log('Google Places API Response Status:', response.status)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error('Google Places API Error:', error)
    throw new Error(`Google Places API error: ${response.status} - ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  console.log('Google Places API Data:', JSON.stringify(data, null, 2))

  return {
    placeId: data.id || placeId,
    displayName: data.displayName?.text || 'Nome não disponível',
    rating: data.rating || 0,
    userRatingCount: data.userRatingCount || 0,
    formattedAddress: data.formattedAddress,
    googleMapsUri: data.googleMapsUri
  }
}

// ─── Avaliações individuais (para a coordenadora responder as ≠ 5 estrelas) ──────
export interface AvaliacaoGoogle {
  nota: number
  texto: string
  autor: string
  quando: string      // "há 2 semanas"
  publishTime: string // ISO
}

/**
 * Retorna as avaliações individuais que o Google Places devolve (até ~5, as mais
 * recentes/relevantes), já filtradas para as que NÃO são 5 estrelas.
 * ⚠️ Limitação da Google: a API não devolve todas as avaliações nem filtra por dia.
 */
export async function getAvaliacoesNaoCinco(
  placeId: string,
  apiKey: string,
): Promise<{ nota: number; totalAvaliacoes: number; url: string; avaliacoes: AvaliacaoGoogle[] }> {
  const normalizedPlaceId = placeId.startsWith('places/') ? placeId : `places/${placeId}`
  const fields = ['id', 'rating', 'userRatingCount', 'googleMapsUri', 'reviews'].join(',')

  // languageCode=pt-BR faz o Google devolver o texto traduzido para português.
  const response = await fetch(`https://places.googleapis.com/v1/${normalizedPlaceId}?languageCode=pt-BR`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fields },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Google Places API error: ${response.status} - ${JSON.stringify(error)}`)
  }
  const data = await response.json()

  const avaliacoes: AvaliacaoGoogle[] = (data.reviews || [])
    .map((r: any) => ({
      nota: Number(r.rating) || 0,
      texto: r.text?.text || r.originalText?.text || '',
      autor: r.authorAttribution?.displayName || 'Anônimo',
      quando: r.relativePublishTimeDescription || '',
      publishTime: r.publishTime || '',
    }))
    .filter((a: AvaliacaoGoogle) => a.nota > 0 && a.nota < 5)
    .sort((a: AvaliacaoGoogle, b: AvaliacaoGoogle) => (b.publishTime || '').localeCompare(a.publishTime || ''))

  return {
    nota: data.rating || 0,
    totalAvaliacoes: data.userRatingCount || 0,
    url: data.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    avaliacoes,
  }
}

/**
 * Busca Place ID de um local usando nome e endereço
 * Útil para encontrar o Place ID pela primeira vez
 */
export async function findPlaceId(
  query: string,
  apiKey: string
): Promise<{ placeId: string; displayName: string } | null> {
  const url = 'https://places.googleapis.com/v1/places:searchText'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName'
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Google Places API error: ${response.status} - ${JSON.stringify(error)}`)
  }

  const data = await response.json()

  if (!data.places || data.places.length === 0) {
    return null
  }

  const firstPlace = data.places[0]

  return {
    placeId: firstPlace.id,
    displayName: firstPlace.displayName?.text || 'Nome não disponível'
  }
}

/**
 * Estima a distribuição de estrelas baseado na nota média
 *
 * Como a Google Places API não fornece distribuição de estrelas,
 * usamos uma estimativa baseada em padrões estatísticos
 */
function estimateDistribution(rating: number, totalReviews: number) {
  // Se não há avaliações, retorna tudo zerado
  if (totalReviews === 0) {
    return {
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStar: 0
    }
  }

  // Algoritmo de estimativa baseado na nota média
  // Para uma nota alta (4.5+), a maioria será 5 e 4 estrelas
  // Para uma nota média (3-4), mais distribuído
  // Para uma nota baixa (<3), mais 1 e 2 estrelas

  const distribution = {
    fiveStars: 0,
    fourStars: 0,
    threeStars: 0,
    twoStars: 0,
    oneStar: 0
  }

  if (rating >= 4.7) {
    // Nota muito alta: 80% de 5 estrelas, 15% de 4, 5% resto
    distribution.fiveStars = Math.round(totalReviews * 0.80)
    distribution.fourStars = Math.round(totalReviews * 0.15)
    distribution.threeStars = Math.round(totalReviews * 0.03)
    distribution.twoStars = Math.round(totalReviews * 0.01)
    distribution.oneStar = totalReviews - (distribution.fiveStars + distribution.fourStars + distribution.threeStars + distribution.twoStars)
  } else if (rating >= 4.3) {
    // Nota alta: 65% de 5 estrelas, 25% de 4, 10% resto
    distribution.fiveStars = Math.round(totalReviews * 0.65)
    distribution.fourStars = Math.round(totalReviews * 0.25)
    distribution.threeStars = Math.round(totalReviews * 0.06)
    distribution.twoStars = Math.round(totalReviews * 0.02)
    distribution.oneStar = totalReviews - (distribution.fiveStars + distribution.fourStars + distribution.threeStars + distribution.twoStars)
  } else if (rating >= 3.7) {
    // Nota média-alta: 50% de 5, 30% de 4, 15% de 3, 5% resto
    distribution.fiveStars = Math.round(totalReviews * 0.50)
    distribution.fourStars = Math.round(totalReviews * 0.30)
    distribution.threeStars = Math.round(totalReviews * 0.15)
    distribution.twoStars = Math.round(totalReviews * 0.03)
    distribution.oneStar = totalReviews - (distribution.fiveStars + distribution.fourStars + distribution.threeStars + distribution.twoStars)
  } else {
    // Nota média ou baixa: mais distribuído
    distribution.fiveStars = Math.round(totalReviews * 0.30)
    distribution.fourStars = Math.round(totalReviews * 0.25)
    distribution.threeStars = Math.round(totalReviews * 0.25)
    distribution.twoStars = Math.round(totalReviews * 0.10)
    distribution.oneStar = totalReviews - (distribution.fiveStars + distribution.fourStars + distribution.threeStars + distribution.twoStars)
  }

  return distribution
}

/**
 * Busca dados completos de avaliações para o dashboard
 */
export async function getGoogleReviews(placeId: string, apiKey: string): Promise<GoogleReviewsResult> {
  const details = await getPlaceDetails(placeId, apiKey)

  // Estima a distribuição de estrelas
  const distribution = estimateDistribution(details.rating, details.userRatingCount)

  return {
    rating: details.rating,
    totalReviews: details.userRatingCount,
    distribution,
    placeId: details.placeId,
    url: details.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`
  }
}
