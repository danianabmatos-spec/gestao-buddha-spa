import { prisma } from '@/lib/prisma'

// Integração com o app FOLHA (fonte oficial de metas e premiações).
// O Folha expõe /api/integracao/metas-premiacao protegido por INTEGRACAO_KEY.

const FOLHA_BASE = process.env.FOLHA_BASE_URL || 'http://localhost:3003'
const KEY = process.env.INTEGRACAO_KEY || ''

// Nome da unidade no Folha → slug do Gestão.
const NOME_PARA_SLUG: Record<string, string> = {
  'analia franco': 'analia-franco',
  'higienopolis': 'higienopolis',
  'mooca plaza': 'mooca-plaza',
  'perdizes': 'perdizes',
  'shopping analia franco': 'shopping-analia-franco',
  'shopping metropole': 'shopping-metropole',
  'tatuape gomescardim': 'tatuape-gomescardim',
}

function normalizar(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

export interface MetaFolhaMes {
  mes: number
  metaFaturamento: number
  metaRecepcao: number
  metaHoras: number
}
export interface FaixaCoordenadora {
  faixaMinPct: number
  faixaMaxPct: number
  bonusFaturamento: number
  bonusHoras: number
}
export interface UnidadeFolha {
  grupoPremio: 'A' | 'B' | 'PERDIZES' | null
  metas: MetaFolhaMes[]
  premioRecepcao: Record<string, number[]> | null
  perdizesPercentuais: number[] | null
  premioCoordenadora: FaixaCoordenadora[] | null
}
export interface MetasFolha {
  ano: number
  faixasPremio: { minPct: number; maxPct: number; label: string }[]
  cargosPremio: { chave: string; label: string }[]
  faixasPerdizes: { minPct: number; maxPct: number; percentual: number; label: string }[]
  comissaoPerdizesPct: number
  porSlug: Record<string, UnidadeFolha>
  atualizadoEm?: string
  fonte?: 'folha' | 'cache'
}

// Busca no Folha (ao vivo), mapeia por slug e cacheia. Se o Folha falhar, cai no cache.
export async function getMetasFolha(ano: number): Promise<MetasFolha | null> {
  try {
    const resp = await fetch(`${FOLHA_BASE}/api/integracao/metas-premiacao?ano=${ano}`, {
      headers: { 'x-integracao-key': KEY },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) throw new Error(`Folha respondeu ${resp.status}`)
    const raw = await resp.json()

    const porSlug: Record<string, UnidadeFolha> = {}
    for (const u of raw.unidades || []) {
      const slug = NOME_PARA_SLUG[normalizar(u.nome)]
      if (!slug) continue
      porSlug[slug] = {
        grupoPremio: u.grupoPremio ?? null,
        metas: u.metas || [],
        premioRecepcao: u.premioRecepcao ?? null,
        perdizesPercentuais: u.perdizesPercentuais ?? null,
        premioCoordenadora: u.premioCoordenadora ?? null,
      }
    }

    const dados: MetasFolha = {
      ano: raw.ano,
      faixasPremio: raw.faixasPremio || [],
      cargosPremio: raw.cargosPremio || [],
      faixasPerdizes: raw.faixasPerdizes || [],
      comissaoPerdizesPct: raw.comissaoPerdizesPct ?? 0,
      porSlug,
    }

    await prisma.metasFolhaCache.upsert({
      where: { ano },
      create: { ano, dados: JSON.stringify(dados) },
      update: { dados: JSON.stringify(dados) },
    })
    return { ...dados, fonte: 'folha' }
  } catch (e) {
    console.error('[folha/metas] falha ao ler o Folha, usando cache:', e)
    const cache = await prisma.metasFolhaCache.findUnique({ where: { ano } })
    if (cache) return { ...(JSON.parse(cache.dados) as MetasFolha), atualizadoEm: cache.atualizadoEm.toISOString(), fonte: 'cache' }
    return null
  }
}
