import { NextRequest } from 'next/server'
import { saveVoucherCache } from '@/lib/cache-vouchers'
import { calcularEstatisticas } from '@/lib/wordpress/auto-validator'

/**
 * Importa vouchers diretamente de JSON
 */
export async function POST(request: NextRequest) {
  try {
    const { vouchers, dataIni, dataFim } = await request.json()

    if (!Array.isArray(vouchers) || vouchers.length === 0) {
      return Response.json({ error: 'Envie um array de vouchers' }, { status: 400 })
    }

    // Calcula estatísticas
    const stats = calcularEstatisticas(vouchers)

    // Salva no cache
    saveVoucherCache({
      dataIni: dataIni || '2026-06-01',
      dataFim: dataFim || '2026-06-06',
      ...stats,
      vouchers,
      savedAt: new Date().toISOString(),
    })

    return Response.json({
      ok: true,
      message: '✓ Vouchers importados com sucesso!',
      stats: {
        ...stats,
        totalVouchers: vouchers.length,
      },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
