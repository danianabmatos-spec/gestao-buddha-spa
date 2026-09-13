import { NextRequest } from 'next/server'
import { parseVouchersHTML, parseVouchersCortesia } from '@/lib/wordpress/vouchers'
import { saveVoucherCache, getVoucherCache, getVoucherCacheFlexivel } from '@/lib/cache-vouchers'
import { saveVoucherCacheByType, getVoucherCacheByType } from '@/lib/cache-vouchers-multi'
import { syncVouchersComBelle, atualizarEstatisticas } from '@/lib/wordpress/sync-with-belle'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://buddhaspa.com.br',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// Recebe dados sincronizados via POST
// Aceita: { dataIni, dataFim, html, tipo?, belleCredenciais? } OU { dataIni, dataFim, vouchers, totalReembolso, tipo?, ... }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dataIni, dataFim, tipo, belleCredenciais } = body

    if (!dataIni || !dataFim) {
      return Response.json({ error: 'dataIni e dataFim são obrigatórios' }, { status: 400, headers: CORS_HEADERS })
    }

    let resultado
    if (body.html) {
      // Modo HTML scraping
      if (tipo === 'cortesia') {
        resultado = parseVouchersCortesia(body.html, dataIni, dataFim)
      } else {
        resultado = parseVouchersHTML(body.html, dataIni, dataFim)
      }

      // Se forneceu credenciais do Belle, faz validação automática
      if (belleCredenciais && tipo !== 'cortesia') {
        console.log('[Sync] Sincronizando com Belle para validação automática...')
        const vouchersValidados = await syncVouchersComBelle(
          resultado.vouchers,
          dataIni,
          dataFim,
          belleCredenciais
        )
        resultado = atualizarEstatisticas(resultado, vouchersValidados)
      }
    } else {
      // Modo pre-parsed (postMessage do browser)
      resultado = {
        periodo: { ini: dataIni, fim: dataFim },
        totalReembolso: body.totalReembolso ?? 0,
        totalValor: body.totalValor,
        totalValidados: body.totalValidados ?? body.vouchers?.length ?? 0,
        pendentesValidacao: body.pendentesValidacao ?? 0,
        validacaoManual: body.validacaoManual ?? 0,
        validacaoAutomatica: body.validacaoAutomatica ?? 0,
        vouchers: body.vouchers ?? [],
      }
    }

    // Salva no cache - usa cache por tipo se especificado
    if (tipo && ['site', 'omnichannel', 'cortesia'].includes(tipo)) {
      saveVoucherCacheByType(tipo as 'site' | 'omnichannel' | 'cortesia', {
        dataIni,
        dataFim,
        totalReembolso: resultado.totalReembolso,
        totalValor: resultado.totalValor ?? 0,
        totalValidados: resultado.totalValidados,
        pendentesValidacao: resultado.pendentesValidacao ?? 0,
        validacaoManual: resultado.validacaoManual ?? 0,
        validacaoAutomatica: resultado.validacaoAutomatica ?? 0,
        vouchers: resultado.vouchers,
        savedAt: new Date().toISOString(),
      })
    } else {
      // Compatibilidade com cache antigo (sem tipo)
      saveVoucherCache({
        dataIni,
        dataFim,
        totalReembolso: resultado.totalReembolso,
        totalValidados: resultado.totalValidados,
        pendentesValidacao: resultado.pendentesValidacao ?? 0,
        validacaoManual: resultado.validacaoManual ?? 0,
        validacaoAutomatica: resultado.validacaoAutomatica ?? 0,
        vouchers: resultado.vouchers,
        savedAt: new Date().toISOString(),
      })
    }

    return Response.json({ ok: true, tipo, savedAt: new Date().toISOString(), ...(resultado as object) }, { headers: CORS_HEADERS })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500, headers: CORS_HEADERS })
  }
}

// Lê dados do cache (busca flexível)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const dataIni = searchParams.get('dataIni')
  const dataFim = searchParams.get('dataFim')

  if (!dataIni || !dataFim) {
    return Response.json({ error: 'dataIni e dataFim são obrigatórios' }, { status: 400 })
  }

  // Tenta busca flexível (filtra vouchers por data mesmo que período não seja exato)
  const cached = getVoucherCacheFlexivel(dataIni, dataFim)

  if (!cached) {
    return Response.json({ error: 'Sem dados em cache para este período. Sincronize primeiro.' }, { status: 404 })
  }

  return Response.json({
    periodo: { ini: dataIni, fim: dataFim },
    totalReembolso: cached.totalReembolso,
    totalValidados: cached.totalValidados,
    pendentesValidacao: cached.pendentesValidacao,
    validacaoManual: cached.validacaoManual,
    validacaoAutomatica: cached.validacaoAutomatica,
    vouchers: cached.vouchers,
    fromCache: true,
    fromFlexibleSearch: true,
    savedAt: cached.savedAt,
  }, { headers: CORS_HEADERS })
}
