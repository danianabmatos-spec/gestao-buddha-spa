import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'cache')

export interface VoucherCacheData {
  dataIni: string
  dataFim: string
  totalReembolso: number
  totalValor?: number // Usado para cortesias (valor cheio, não reembolso)
  totalValidados: number
  pendentesValidacao: number
  validacaoManual: number
  validacaoAutomatica: number
  vouchers: unknown[]
  savedAt: string
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

export function saveVoucherCacheByType(tipo: 'site' | 'omnichannel' | 'cortesia', data: VoucherCacheData): void {
  ensureCacheDir()
  const fileName = `vouchers-${tipo}.json`
  const filePath = path.join(CACHE_DIR, fileName)

  const cache: Record<string, VoucherCacheData> = loadCacheByType(tipo)
  const key = `${data.dataIni}_${data.dataFim}`
  cache[key] = { ...data, savedAt: new Date().toISOString() }

  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8')
}

export function getVoucherCacheByType(tipo: 'site' | 'omnichannel' | 'cortesia', dataIni: string, dataFim: string): VoucherCacheData | null {
  const cache = loadCacheByType(tipo)
  const key = `${dataIni}_${dataFim}`
  return cache[key] ?? null
}

function loadCacheByType(tipo: 'site' | 'omnichannel' | 'cortesia'): Record<string, VoucherCacheData> {
  ensureCacheDir()
  const fileName = `vouchers-${tipo}.json`
  const filePath = path.join(CACHE_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    return {}
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}
