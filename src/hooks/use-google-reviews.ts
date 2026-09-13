import { useState, useEffect, useRef } from 'react'
import type { GoogleReviewsData } from '@/lib/google/reviews-scraper'

// Cache global para prevenir múltiplas chamadas
const fetchCache = new Map<string, Promise<any>>()
const dataCache = new Map<string, { data: GoogleReviewsData; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutos (dados do Google mudam pouco)

export function useGoogleReviews(unidade: string) {
  const [data, setData] = useState<GoogleReviewsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const cacheKey = `google-${unidade}`

    // Verifica cache
    const cached = dataCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data)
      setLoading(false)
      return
    }

    const fetchData = async () => {
      // Se já existe uma requisição em andamento para esta chave, aguarda ela
      if (fetchCache.has(cacheKey)) {
        try {
          const result = await fetchCache.get(cacheKey)
          if (mountedRef.current) {
            setData(result)
            setLoading(false)
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar Google Reviews')
            setLoading(false)
          }
        }
        return
      }

      setLoading(true)
      setError(null)

      // Cria a promise e adiciona ao cache de requisições
      const fetchPromise = fetch(`/api/google/reviews?unidade=${unidade}`)
        .then(async (resp) => {
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          return await resp.json()
        })

      fetchCache.set(cacheKey, fetchPromise)

      try {
        const result = await fetchPromise

        // Salva no cache de dados
        dataCache.set(cacheKey, { data: result, timestamp: Date.now() })

        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Erro ao buscar Google Reviews')
          setLoading(false)
        }
      } finally {
        // Remove a promise do cache de requisições após completar
        fetchCache.delete(cacheKey)
      }
    }

    fetchData()
  }, [unidade])

  return { data, loading, error }
}
