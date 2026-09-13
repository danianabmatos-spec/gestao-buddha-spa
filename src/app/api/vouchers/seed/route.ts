import { NextRequest } from 'next/server'
import { saveVoucherCache } from '@/lib/cache-vouchers'

export async function POST(request: NextRequest) {
  try {
    const vouchersTeste = [
      {
        codigo: 'VCH-2026-001',
        produto: 'Massagem Relaxante 60min',
        dataTerapia: '02/06/2026',
        dataVenda: '28/05/2026',
        status: 'Validado',
        formaValidacao: 'Automatico',
        valorReembolso: 154,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'VCH-2026-002',
        produto: 'Day Spa Prime Individual',
        dataTerapia: '03/06/2026',
        dataVenda: '30/05/2026',
        status: 'Validado',
        formaValidacao: 'Manualmente',
        valorReembolso: 380,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'VCH-2026-003',
        produto: 'Massagem Relaxante 60min',
        dataTerapia: '04/06/2026',
        dataVenda: '01/06/2026',
        status: 'Pendente',
        formaValidacao: 'Pendente',
        valorReembolso: 154,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'VCH-2026-004',
        produto: 'Massagem Terapêutica 60min',
        dataTerapia: '05/06/2026',
        dataVenda: '02/06/2026',
        status: 'Validado',
        formaValidacao: 'Automatico',
        valorReembolso: 164,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'VCH-2026-005',
        produto: 'Day Spa Prime em Dupla',
        dataTerapia: '05/06/2026',
        dataVenda: '03/06/2026',
        status: 'Validado',
        formaValidacao: 'Automatico',
        valorReembolso: 680,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'VCH-2026-006',
        produto: 'Massagem Relaxante 60min',
        dataTerapia: '06/06/2026',
        dataVenda: '04/06/2026',
        status: 'Pendente',
        formaValidacao: 'Pendente',
        valorReembolso: 154,
        unidade: 'Shopping Metrópole'
      },
    ]

    const validados = vouchersTeste.filter(v => v.status === 'Validado')
    const pendentes = vouchersTeste.filter(v => v.status === 'Pendente')
    const automaticos = validados.filter(v => v.formaValidacao === 'Automatico')
    const manuais = validados.filter(v => v.formaValidacao === 'Manualmente')
    const totalReembolso = validados.reduce((sum, v) => sum + v.valorReembolso, 0)

    const savedAt = new Date().toISOString()

    saveVoucherCache({
      dataIni: '2026-06-01',
      dataFim: '2026-06-06',
      totalReembolso,
      totalValidados: validados.length,
      pendentesValidacao: pendentes.length,
      validacaoManual: manuais.length,
      validacaoAutomatica: automaticos.length,
      vouchers: vouchersTeste,
      savedAt,
    })

    return Response.json({
      ok: true,
      message: 'Cache populado com dados de teste',
      stats: {
        totalReembolso,
        totalValidados: validados.length,
        pendentesValidacao: pendentes.length,
        validacaoManual: manuais.length,
        validacaoAutomatica: automaticos.length,
        totalVouchers: vouchersTeste.length,
      },
      savedAt,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
