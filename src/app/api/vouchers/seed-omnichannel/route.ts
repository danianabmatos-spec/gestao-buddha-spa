import { NextRequest } from 'next/server'
import { saveVoucherCache } from '@/lib/cache-vouchers'

/**
 * Seed de vouchers Omnichannel (TotalPass, Gympass, etc)
 * Período de VENDA: 01-05/06/2026
 */
export async function POST(request: NextRequest) {
  try {
    const vouchersOmnichannel = [
      { codigo: 'TP2026001', produto: 'Massagem Relaxante 60min', parceiro: 'TotalPass', dataVenda: '01/06/2026', dataTerapia: '03/06/2026', valor: 0, valorReembolso: 89, unidade: 'Shopping Metrópole', status: 'Validado' },
      { codigo: 'GP2026001', produto: 'Massagem Relaxante 60min', parceiro: 'Gympass', dataVenda: '01/06/2026', dataTerapia: '04/06/2026', valor: 0, valorReembolso: 85, unidade: 'Shopping Metrópole', status: 'Validado' },
      { codigo: 'TP2026002', produto: 'Massagem Terapêutica 60min', parceiro: 'TotalPass', dataVenda: '02/06/2026', dataTerapia: '05/06/2026', valor: 0, valorReembolso: 95, unidade: 'Shopping Metrópole', status: 'Validado' },
      { codigo: 'GP2026002', produto: 'Reflexologia 60min', parceiro: 'Gympass', dataVenda: '02/06/2026', dataTerapia: '06/06/2026', valor: 0, valorReembolso: 85, unidade: 'Shopping Metrópole', status: 'Pendente' },
      { codigo: 'TP2026003', produto: 'Massagem Relaxante 60min', parceiro: 'TotalPass', dataVenda: '03/06/2026', dataTerapia: '07/06/2026', valor: 0, valorReembolso: 89, unidade: 'Shopping Metrópole', status: 'Pendente' },
      { codigo: 'GP2026003', produto: 'Shiatsu 60min', parceiro: 'Gympass', dataVenda: '03/06/2026', dataTerapia: '08/06/2026', valor: 0, valorReembolso: 90, unidade: 'Shopping Metrópole', status: 'Pendente' },
      { codigo: 'TP2026004', produto: 'Massagem Relaxante 60min', parceiro: 'TotalPass', dataVenda: '04/06/2026', dataTerapia: '09/06/2026', valor: 0, valorReembolso: 89, unidade: 'Shopping Metrópole', status: 'Pendente' },
      { codigo: 'GP2026004', produto: 'Massagem Relaxante 60min', parceiro: 'Gympass', dataVenda: '04/06/2026', dataTerapia: '10/06/2026', valor: 0, valorReembolso: 85, unidade: 'Shopping Metrópole', status: 'Pendente' },
      { codigo: 'TP2026005', produto: 'Massagem Terapêutica 60min', parceiro: 'TotalPass', dataVenda: '05/06/2026', dataTerapia: '11/06/2026', valor: 0, valorReembolso: 95, unidade: 'Shopping Metrópole', status: 'Pendente' },
      { codigo: 'GP2026005', produto: 'Massagem Relaxante 60min', parceiro: 'Gympass', dataVenda: '05/06/2026', dataTerapia: '12/06/2026', valor: 0, valorReembolso: 85, unidade: 'Shopping Metrópole', status: 'Pendente' },
    ]

    const totalReembolso = vouchersOmnichannel.reduce((sum, v) => sum + v.valorReembolso, 0)
    const totalValidados = vouchersOmnichannel.filter(v => v.status === 'Validado').length

    // Salva em cache separado
    const cacheKey = 'omnichannel_2026-06-01_2026-06-05'
    saveVoucherCache({
      dataIni: '2026-06-01',
      dataFim: '2026-06-05',
      totalReembolso,
      totalValidados,
      pendentesValidacao: vouchersOmnichannel.length - totalValidados,
      validacaoManual: 0,
      validacaoAutomatica: totalValidados,
      vouchers: vouchersOmnichannel,
      savedAt: new Date().toISOString(),
    })

    return Response.json({
      ok: true,
      message: '✓ Vouchers Omnichannel carregados!',
      stats: {
        totalReembolso,
        totalVouchers: vouchersOmnichannel.length,
        totalValidados,
        totalPendentes: vouchersOmnichannel.length - totalValidados,
      },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
