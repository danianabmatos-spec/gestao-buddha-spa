import { NextRequest } from 'next/server'
import { saveVoucherCacheByType } from '@/lib/cache-vouchers-multi'
import type { Voucher } from '@/lib/wordpress/vouchers'

/**
 * Seed de vouchers ABRIL/2026
 */
export async function POST(request: NextRequest) {
  try {
    const { tipo } = await request.json()

    if (tipo === 'omnichannel') {
      // VOUCHERS OMNICHANNEL - Abril 2026 (filtro por data de VENDA)
      const vouchersOmni = [
        {
          codigo: 'E7MNP3Q',
          produto: 'Vale Bem-Estar - Shopping Metrópole - R$ 500',
          dataVenda: '16/04/2026',
          dataTerapia: '22/04/2026',
          valorReembolso: 400.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
        {
          codigo: 'F2QRS8T',
          produto: 'Shiatsu - Shopping Metrópole - 45 minutos',
          dataVenda: '09/04/2026',
          dataTerapia: '16/04/2026',
          valorReembolso: 148.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
        {
          codigo: 'G6TUV1W',
          produto: 'Experiência Ayurveda - Shopping Metrópole - Ayur 60 + Ind. Head 20',
          dataVenda: '04/04/2026',
          dataTerapia: '',
          valorReembolso: 301.60,
          unidade: 'Shopping Metrópole',
          status: 'Disponível'
        },
        {
          codigo: 'H9WXY4Z',
          produto: 'Indian Head 20\' - Shopping Metrópole',
          dataVenda: '02/04/2026',
          dataTerapia: '08/04/2026',
          valorReembolso: 112.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
      ]

      const totalReembolso = vouchersOmni.reduce((sum, v) => sum + v.valorReembolso, 0)
      const utilizados = vouchersOmni.filter(v => v.status === 'Utilizado').length

      saveVoucherCacheByType('omnichannel', {
        dataIni: '2026-04-01',
        dataFim: '2026-04-30',
        totalReembolso,
        totalValidados: utilizados,
        pendentesValidacao: vouchersOmni.length - utilizados,
        validacaoManual: 0,
        validacaoAutomatica: 0,
        vouchers: vouchersOmni as any,
        savedAt: new Date().toISOString(),
      })

      return Response.json({
        ok: true,
        message: '✓ Vouchers Omnichannel ABRIL carregados!',
        periodo: 'Abril 2026 - Filtro por Data de VENDA',
        stats: {
          totalReembolso,
          totalVouchers: vouchersOmni.length,
          utilizados,
          disponiveis: vouchersOmni.length - utilizados,
        },
      })
    }

    if (tipo === 'cortesia') {
      // VOUCHERS CORTESIA - Abril 2026 - SEM DADOS (mês sem cortesias)
      saveVoucherCacheByType('cortesia', {
        dataIni: '2026-04-01',
        dataFim: '2026-04-30',
        totalReembolso: 0.00,
        totalValor: 0.00,
        totalValidados: 0,
        pendentesValidacao: 0,
        validacaoManual: 0,
        validacaoAutomatica: 0,
        vouchers: [],
        savedAt: new Date().toISOString(),
      })

      return Response.json({
        ok: true,
        message: '✓ Vouchers Cortesia ABRIL carregados (sem dados)',
        periodo: 'Abril 2026 - Filtro por Data de UTILIZAÇÃO',
        stats: {
          totalValor: 0.00,
          totalVouchers: 0,
        },
      })
    }

    // VOUCHERS SITE - Abril 2026 (filtro por data de UTILIZAÇÃO)
    const vouchersSite: Voucher[] = []
    let totalAcumulado = 0
    const valorAlvo = 24300.00 // Valor fictício para abril

    const valores = [154, 189, 164, 380, 680]
    let contador = 1

    while (totalAcumulado < valorAlvo) {
      const valorRestante = valorAlvo - totalAcumulado
      let valor = valores[Math.floor(Math.random() * valores.length)]

      if (valorRestante < 200) {
        valor = valorRestante
      }

      if (totalAcumulado + valor <= valorAlvo) {
        const dia = Math.floor(Math.random() * 30) + 1
        vouchersSite.push({
          codigo: String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                  Math.random().toString(36).substring(2, 8).toUpperCase(),
          produto: valor === 154 ? 'Massagem Relaxante 60min' :
                   valor === 189 ? 'Massagem Relaxante 90min' :
                   valor === 164 ? 'Massagem Terapêutica 60min' :
                   valor === 380 ? 'Day Spa Prime Individual' :
                   valor === 680 ? 'Day Spa Prime em Dupla' : 'Serviço Especial',
          dataTerapia: `${String(dia).padStart(2, '0')}/04/2026`,
          dataVenda: `${String(Math.max(1, dia - 5)).padStart(2, '0')}/04/2026`,
          status: 'Validado',
          formaValidacao: Math.random() > 0.1 ? 'Automatico' : 'Manual',
          valorReembolso: valor,
          unidade: 'Shopping Metrópole'
        })
        totalAcumulado += valor
        contador++
      } else {
        break
      }
    }

    const validacaoAutomatica = vouchersSite.filter(v => v.formaValidacao === 'Automatico').length
    const validacaoManual = vouchersSite.filter(v => v.formaValidacao === 'Manual').length

    saveVoucherCacheByType('site', {
      dataIni: '2026-04-01',
      dataFim: '2026-04-30',
      totalReembolso: totalAcumulado,
      totalValidados: vouchersSite.length,
      pendentesValidacao: 0,
      validacaoManual,
      validacaoAutomatica,
      vouchers: vouchersSite,
      savedAt: new Date().toISOString(),
    })

    return Response.json({
      ok: true,
      message: '✓ Vouchers Site ABRIL carregados!',
      periodo: 'Abril 2026 - Filtro por Data de UTILIZAÇÃO',
      stats: {
        totalReembolso: totalAcumulado,
        totalVouchers: vouchersSite.length,
        validacaoAutomatica,
        validacaoManual,
      },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
