/**
 * Script para encontrar Place IDs das unidades Buddha Spa
 *
 * Como usar:
 * 1. Configure GOOGLE_PLACES_API_KEY no .env.local
 * 2. Execute: node scripts/find-place-id.mjs
 */

import dotenv from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Carrega variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

if (!API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY não encontrada no .env.local')
  console.log('\n📝 Siga o guia em GOOGLE-PLACES-API.md para configurar')
  process.exit(1)
}

// Unidades Buddha Spa para buscar
const UNIDADES = [
  {
    nome: 'shopping-metropole',
    query: 'Buddha Spa Shopping Metrópole São Bernardo do Campo'
  },
  {
    nome: 'analia-franco',
    query: 'Buddha Spa Anália Franco São Paulo'
  },
  {
    nome: 'shopping-analia-franco',
    query: 'Buddha Spa Shopping Anália Franco São Paulo'
  },
  {
    nome: 'perdizes',
    query: 'Buddha Spa Perdizes São Paulo'
  },
  {
    nome: 'tatuape-gomescardim',
    query: 'Buddha Spa Tatuapé Gomes Cardim São Paulo'
  },
  {
    nome: 'mooca-plaza',
    query: 'Buddha Spa Mooca Plaza São Paulo'
  },
  {
    nome: 'higienopolis',
    query: 'Buddha Spa Higienópolis São Paulo'
  }
]

async function findPlaceId(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount'
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

  return data.places[0]
}

async function main() {
  console.log('🔍 Buscando Place IDs das unidades Buddha Spa...\n')

  const results = []

  for (const unidade of UNIDADES) {
    console.log(`📍 Buscando: ${unidade.query}`)

    try {
      const place = await findPlaceId(unidade.query)

      if (place) {
        const placeId = place.id.replace('places/', '')

        console.log(`  ✅ Encontrado!`)
        console.log(`     Nome: ${place.displayName?.text || 'N/A'}`)
        console.log(`     Place ID: ${placeId}`)
        console.log(`     Endereço: ${place.formattedAddress || 'N/A'}`)
        console.log(`     Rating: ${place.rating || 'N/A'} (${place.userRatingCount || 0} avaliações)`)
        console.log('')

        results.push({
          nome: unidade.nome,
          placeId,
          displayName: place.displayName?.text,
          address: place.formattedAddress,
          rating: place.rating,
          reviews: place.userRatingCount
        })
      } else {
        console.log(`  ❌ Não encontrado`)
        console.log('')
      }
    } catch (error) {
      console.log(`  ❌ Erro: ${error.message}`)
      console.log('')
    }

    // Aguarda 1 segundo entre requisições para evitar rate limit
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Exibe resumo formatado para copiar no .env.local
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 COPIE E COLE NO SEU .env.local:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (results.length === 0) {
    console.log('❌ Nenhum Place ID encontrado.')
    console.log('\n💡 Dicas:')
    console.log('   - Verifique se a API key está correta')
    console.log('   - Verifique se ativou a Places API (New) no Google Cloud')
    console.log('   - Tente buscar manualmente em: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder')
    return
  }

  results.forEach(result => {
    const varName = `PLACE_ID_${result.nome.toUpperCase().replace(/-/g, '_')}`
    console.log(`${varName}=${result.placeId}`)
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`\n✅ ${results.length} de ${UNIDADES.length} unidades encontradas!`)
  console.log('\n📝 Próximos passos:')
  console.log('   1. Copie as variáveis acima')
  console.log('   2. Cole no arquivo .env.local')
  console.log('   3. Reinicie o servidor: npm run dev')
  console.log('   4. Acesse o dashboard e veja as avaliações do Google!')
}

main().catch(console.error)
