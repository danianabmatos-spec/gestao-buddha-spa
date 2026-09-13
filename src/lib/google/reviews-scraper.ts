import puppeteer from 'puppeteer'

export interface GoogleReviewsData {
  rating: number
  totalReviews: number
  distribution: {
    fiveStars: number
    fourStars: number
    threeStars: number
    twoStars: number
    oneStar: number
  }
  placeId?: string
  url: string
}

/**
 * Busca dados de avaliações do Google Maps usando Puppeteer
 * @param searchUrl URL de busca ou URL direta do Google Maps
 */
export async function scrapeGoogleReviews(searchUrl: string): Promise<GoogleReviewsData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    // Define user agent para evitar bloqueios
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )

    // Navega para a URL
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // Aguarda o carregamento dos dados do painel lateral
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Extrai a nota e total de avaliações
    const { rating, totalReviews } = await page.evaluate(() => {
      let rating = 0
      let totalReviews = 0

      // Busca todos os elementos de texto
      const allText = document.body.innerText

      // Tenta encontrar padrões como "4,9" ou "4.9" seguido de "estrelas"
      const ratingMatch = allText.match(/(\d+[,.]?\d*)\s*estrelas?/i)
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1].replace(',', '.'))
      }

      // Tenta encontrar o total de avaliações - vários formatos possíveis
      const reviewPatterns = [
        /(\d+\.?\d*)\s*avalia[çc][õo]es/i,
        /(\d+\.?\d*)\s*reviews?/i,
        /(\d+[,.]?\d*[kK]?)\s*avalia[çc][õo]es/i
      ]

      for (const pattern of reviewPatterns) {
        const match = allText.match(pattern)
        if (match) {
          let num = match[1].replace(',', '.')
          // Se termina com K, multiplica por 1000
          if (num.toLowerCase().includes('k')) {
            num = String(parseFloat(num.replace(/k/i, '')) * 1000)
          }
          totalReviews = parseInt(num)
          break
        }
      }

      return { rating, totalReviews }
    })

    // Tenta clicar no botão de avaliações para ver a distribuição
    let distribution = {
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStar: 0
    }

    try {
      // Procura por elementos clicáveis que abrem as avaliações
      const reviewsButton = await page.$('button[aria-label*="avalia"]')
      if (reviewsButton) {
        await reviewsButton.click()
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Extrai a distribuição de estrelas
        distribution = await page.evaluate(() => {
          const dist = {
            fiveStars: 0,
            fourStars: 0,
            threeStars: 0,
            twoStars: 0,
            oneStar: 0
          }

          // Procura pelas barras de distribuição de estrelas
          const text = document.body.innerText
          const lines = text.split('\n')

          // Procura por padrões como "5 estrelas: 123 avaliações" ou "5 estrelas 123"
          lines.forEach(line => {
            const match5 = line.match(/5\s*estrelas?.*?(\d+)/i)
            const match4 = line.match(/4\s*estrelas?.*?(\d+)/i)
            const match3 = line.match(/3\s*estrelas?.*?(\d+)/i)
            const match2 = line.match(/2\s*estrelas?.*?(\d+)/i)
            const match1 = line.match(/1\s*estrela?.*?(\d+)/i)

            if (match5) dist.fiveStars = Math.max(dist.fiveStars, parseInt(match5[1]))
            if (match4) dist.fourStars = Math.max(dist.fourStars, parseInt(match4[1]))
            if (match3) dist.threeStars = Math.max(dist.threeStars, parseInt(match3[1]))
            if (match2) dist.twoStars = Math.max(dist.twoStars, parseInt(match2[1]))
            if (match1) dist.oneStar = Math.max(dist.oneStar, parseInt(match1[1]))
          })

          return dist
        })
      }
    } catch (error) {
      console.log('Não foi possível extrair distribuição de estrelas:', error)
    }

    // Tenta extrair Place ID da URL
    const currentUrl = page.url()
    const placeIdMatch = currentUrl.match(/!1s([^!]+)/)
    const placeId = placeIdMatch ? placeIdMatch[1] : undefined

    return {
      rating,
      totalReviews,
      distribution,
      placeId,
      url: currentUrl
    }

  } finally {
    await browser.close()
  }
}
