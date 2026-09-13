import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'vouchers.json')
const CACHE_FILE_SITE = path.join(CACHE_DIR, 'vouchers-site.json')
const CACHE_FILE_OMNICHANNEL = path.join(CACHE_DIR, 'vouchers-omnichannel.json')
const CACHE_FILE_CORTESIA = path.join(CACHE_DIR, 'vouchers-cortesia.json')

export interface VoucherCacheData {
  dataIni: string
  dataFim: string
  totalReembolso: number
  totalValidados: number
  pendentesValidacao: number
  validacaoManual: number
  validacaoAutomatica: number
  vouchers: unknown[]
  savedAt: string
}

// Garante que o diretório de cache existe
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

// Salva cache
export function saveVoucherCache(data: VoucherCacheData): void {
  ensureCacheDir()
  const cache: Record<string, VoucherCacheData> = loadAllCache()
  const key = `${data.dataIni}_${data.dataFim}`
  cache[key] = { ...data, savedAt: new Date().toISOString() }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

// Carrega cache específico (busca exata)
export function getVoucherCache(dataIni: string, dataFim: string): VoucherCacheData | null {
  const cache = loadAllCache()
  const key = `${dataIni}_${dataFim}`
  return cache[key] ?? null
}

// Busca flexível: retorna vouchers de qualquer cache que se sobreponha ao período
// 🔍 IMPORTANTE: Por enquanto busca APENAS cache SITE (omnichannel será tratado separadamente)
export function getVoucherCacheFlexivel(dataIni: string, dataFim: string): VoucherCacheData | null {
  // Carrega APENAS cache SITE
  const cacheSite = loadCacheFromFile(CACHE_FILE)

  // Função auxiliar para extrair vouchers de um cache e criar um Map por código
  const extractToMap = (cache: Record<string, VoucherCacheData>): Map<string, any> => {
    const map = new Map<string, any>()
    Object.values(cache).forEach(cacheEntry => {
      if (Array.isArray(cacheEntry.vouchers)) {
        cacheEntry.vouchers.forEach((voucher: any) => {
          // Filtra por data de terapia (formato dd/MM/yyyy ou dd/MM/yyyy HH:mm)
          if (voucher.dataTerapia) {
            const dataParts = voucher.dataTerapia.split(' ')[0].split('/')
            const [dia, mes, ano] = dataParts
            const dataVoucher = `${ano}-${mes}-${dia}`

            if (dataVoucher >= dataIni && dataVoucher <= dataFim) {
              const codigo = voucher.codigo?.toUpperCase().trim()
              if (codigo) {
                map.set(codigo, voucher)
              }
            }
          }
        })
      }
    })
    return map
  }

  // Extrai apenas do cache SITE
  const vouchersMap = extractToMap(cacheSite)
  const vouchersUnicos = Array.from(vouchersMap.values())

  if (vouchersUnicos.length === 0) return null

  // Recalcula estatísticas baseado nos vouchers únicos filtrados
  const totalReembolso = vouchersUnicos.reduce((sum, v) => sum + (v.valorReembolso || 0), 0)
  const totalValidados = vouchersUnicos.filter(v => v.status === 'Validado' || v.status === 'Utilizado').length
  const pendentesValidacao = vouchersUnicos.filter(v => v.status === 'Pendente').length
  const validacaoManual = vouchersUnicos.filter(v => v.formaValidacao === 'Manualmente').length
  const validacaoAutomatica = vouchersUnicos.filter(v => v.formaValidacao === 'Automatico').length

  console.log(`📦 Cache SITE: ${vouchersUnicos.length} vouchers únicos`)
  console.log(`   Períodos disponíveis: ${cacheSite ? Object.keys(cacheSite).length : 0}`)

  return {
    dataIni,
    dataFim,
    totalReembolso,
    totalValidados,
    pendentesValidacao,
    validacaoManual,
    validacaoAutomatica,
    vouchers: vouchersUnicos,
    savedAt: new Date().toISOString()
  }
}

// Carrega todo o cache do arquivo padrão
function loadAllCache(): Record<string, VoucherCacheData> {
  return loadCacheFromFile(CACHE_FILE)
}

// Carrega cache de um arquivo específico
function loadCacheFromFile(filePath: string): Record<string, VoucherCacheData> {
  ensureCacheDir()
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
