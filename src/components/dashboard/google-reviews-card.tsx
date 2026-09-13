import { Star } from 'lucide-react'
import type { GoogleReviewsData } from '@/lib/google/reviews-scraper'

interface GoogleReviewsCardProps {
  data: GoogleReviewsData | null
  loading?: boolean
}

export function GoogleReviewsCard({ data, loading }: GoogleReviewsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-[#DDC7A4]/30">
        <div className="animate-pulse">
          <div className="h-4 bg-[#DDC7A4]/20 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-[#DDC7A4]/20 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-6 bg-[#DDC7A4]/20 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-[#DDC7A4]/30">
        <p className="text-sm text-[#392617]/60">Dados do Google não disponíveis</p>
      </div>
    )
  }

  const { rating, totalReviews, distribution } = data

  // Calcula a porcentagem de cada estrela
  const getPercentage = (count: number) => {
    if (totalReviews === 0) return 0
    return Math.round((count / totalReviews) * 100)
  }

  const stars = [
    { label: '5', count: distribution.fiveStars, color: 'bg-[#425F1D]' },
    { label: '4', count: distribution.fourStars, color: 'bg-[#D78B18]' },
    { label: '3', count: distribution.threeStars, color: 'bg-[#DDC7A4]' },
    { label: '2', count: distribution.twoStars, color: 'bg-[#7E0000]/40' },
    { label: '1', count: distribution.oneStar, color: 'bg-[#7E0000]' }
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-[#DDC7A4]/30">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-[#392617]/70 uppercase tracking-wide">
          Avaliações Google
        </h3>
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#7E0000] hover:underline"
        >
          Ver no Google
        </a>
      </div>

      {/* Nota geral */}
      <div className="flex items-baseline gap-3 mb-6">
        <div className="text-5xl font-bold text-[#392617]">
          {rating.toFixed(1)}
        </div>
        <div className="flex flex-col">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
              <Star
                key={i}
                size={16}
                className={`${
                  i <= Math.round(rating)
                    ? 'fill-[#D78B18] text-[#D78B18]'
                    : 'fill-none text-[#DDC7A4]'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-[#392617]/60 mt-1">
            {totalReviews.toLocaleString('pt-BR')} avaliações
          </p>
        </div>
      </div>

      {/* Distribuição de estrelas */}
      <div className="space-y-2">
        {stars.map(({ label, count, color }) => {
          const percentage = getPercentage(count)
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1 w-8">
                <span className="text-xs font-medium text-[#392617]">{label}</span>
                <Star size={12} className="fill-[#D78B18] text-[#D78B18]" />
              </div>
              <div className="flex-1 bg-[#F5F0EB] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${color} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="w-16 text-right">
                <span className="text-xs font-medium text-[#392617]">
                  {count}
                </span>
                <span className="text-xs text-[#392617]/60 ml-1">
                  ({percentage}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
