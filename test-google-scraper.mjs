import puppeteer from 'puppeteer'

async function testScraper() {
  console.log('🚀 Iniciando teste do scraper Google Reviews...\n')

  const browser = await puppeteer.launch({
    headless: false, // Deixar visível para debug
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )

    console.log('📍 Navegando para o Google Maps...')
    const url = 'https://www.google.com/maps/search/Buddha+Spa+Shopping+Metr%C3%B3pole+S%C3%A3o+Bernardo'

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    console.log('⏳ Aguardando carregamento dos dados...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Tira um screenshot para debug
    await page.screenshot({ path: 'google-maps-debug.png' })
    console.log('📸 Screenshot salvo em: google-maps-debug.png')

    // Extrai a nota e total de avaliações
    console.log('\n🔍 Buscando nota e total de avaliações...')
    const { rating, totalReviews } = await page.evaluate(() => {
      let rating = 0
      let totalReviews = 0

      const allText = document.body.innerText
      console.log('Texto da página (primeiras 500 chars):', allText.substring(0, 500))

      // Busca rating
      const ratingMatch = allText.match(/(\d+[,.]?\d*)\s*estrelas?/i)
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1].replace(',', '.'))
      }

      // Busca total de avaliações
      const reviewPatterns = [
        /(\d+\.?\d*)\s*avalia[çc][õo]es/i,
        /(\d+\.?\d*)\s*reviews?/i,
        /(\d+[,.]?\d*[kK]?)\s*avalia[çc][õo]es/i
      ]

      for (const pattern of reviewPatterns) {
        const match = allText.match(pattern)
        if (match) {
          console.log('Match encontrado:', match[0])
          let num = match[1].replace(',', '.')
          if (num.toLowerCase().includes('k')) {
            num = parseFloat(num.replace(/k/i, '')) * 1000
          }
          totalReviews = parseInt(num)
          break
        }
      }

      return { rating, totalReviews }
    })

    console.log('⭐ Nota encontrada:', rating)
    console.log('📊 Total de avaliações:', totalReviews)

    console.log('\n✅ Teste concluído!')
    console.log('\nResultado:')
    console.log('  Nota:', rating)
    console.log('  Total de avaliações:', totalReviews)

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    console.log('\n⏳ Fechando navegador em 10 segundos...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    await browser.close()
  }
}

testScraper()
