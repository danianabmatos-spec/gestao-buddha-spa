/**
 * Configuração de credenciais Belle por unidade
 */
import { maybeDecrypt } from '@/lib/auth/crypto'

export interface UnidadeCredenciais {
  slug: string
  nome: string
  email: string
  password: string
  estab: number
  placeId: string
}

export function getUnidadeCredenciais(unidadeSlug: string): UnidadeCredenciais | null {
  const configs: Record<string, UnidadeCredenciais> = {
    'shopping-metropole': {
      slug: 'shopping-metropole',
      nome: 'Shopping Metrópole',
      email: process.env.BELLE_METROPOLE_EMAIL!,
      password: process.env.BELLE_METROPOLE_PASSWORD!,
      estab: Number(process.env.BELLE_METROPOLE_ESTAB!),
      placeId: process.env.PLACE_ID_SHOPPING_METROPOLE!,
    },
    'analia-franco': {
      slug: 'analia-franco',
      nome: 'Anália Franco',
      email: process.env.BELLE_ANALIA_FRANCO_EMAIL!,
      password: process.env.BELLE_ANALIA_FRANCO_PASSWORD!,
      estab: Number(process.env.BELLE_ANALIA_FRANCO_ESTAB!),
      placeId: process.env.PLACE_ID_ANALIA_FRANCO!,
    },
    'shopping-analia-franco': {
      slug: 'shopping-analia-franco',
      nome: 'Shopping Anália Franco',
      email: process.env.BELLE_SHOPPING_ANALIA_FRANCO_EMAIL!,
      password: process.env.BELLE_SHOPPING_ANALIA_FRANCO_PASSWORD!,
      estab: Number(process.env.BELLE_SHOPPING_ANALIA_FRANCO_ESTAB!),
      placeId: process.env.PLACE_ID_SHOPPING_ANALIA_FRANCO!,
    },
    'perdizes': {
      slug: 'perdizes',
      nome: 'Perdizes',
      email: process.env.BELLE_PERDIZES_EMAIL!,
      password: process.env.BELLE_PERDIZES_PASSWORD!,
      estab: Number(process.env.BELLE_PERDIZES_ESTAB!),
      placeId: process.env.PLACE_ID_PERDIZES!,
    },
    'tatuape-gomescardim': {
      slug: 'tatuape-gomescardim',
      nome: 'Tatuapé Gomes Cardim',
      email: process.env.BELLE_TATUAPE_GOMESCARDIM_EMAIL!,
      password: process.env.BELLE_TATUAPE_GOMESCARDIM_PASSWORD!,
      estab: Number(process.env.BELLE_TATUAPE_GOMESCARDIM_ESTAB!),
      placeId: process.env.PLACE_ID_TATUAPE_GOMESCARDIM!,
    },
    'mooca-plaza': {
      slug: 'mooca-plaza',
      nome: 'Mooca Plaza',
      email: process.env.BELLE_MOOCA_PLAZA_EMAIL!,
      password: process.env.BELLE_MOOCA_PLAZA_PASSWORD!,
      estab: Number(process.env.BELLE_MOOCA_PLAZA_ESTAB!),
      placeId: process.env.PLACE_ID_MOOCA_PLAZA!,
    },
    'higienopolis': {
      slug: 'higienopolis',
      nome: 'Higienópolis',
      email: process.env.BELLE_HIGIENOPOLIS_EMAIL!,
      password: process.env.BELLE_HIGIENOPOLIS_PASSWORD!,
      estab: Number(process.env.BELLE_HIGIENOPOLIS_ESTAB!),
      placeId: process.env.PLACE_ID_HIGIENOPOLIS!,
    },
  }

  const config = configs[unidadeSlug]
  if (!config) return null
  // Senha pode estar criptografada (enc:v1:...) no .env — decripta na leitura
  return { ...config, password: maybeDecrypt(config.password) }
}

export function getUnidadesDisponiveis(): string[] {
  return [
    'shopping-metropole',
    'analia-franco',
    'shopping-analia-franco',
    'perdizes',
    'tatuape-gomescardim',
    'mooca-plaza',
    'higienopolis'
  ]
}

export function getUnidadeNome(slug: string): string {
  const config = getUnidadeCredenciais(slug)
  return config?.nome || slug
}
