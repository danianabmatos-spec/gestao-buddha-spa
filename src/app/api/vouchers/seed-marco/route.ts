import { NextRequest } from 'next/server'
import { saveVoucherCacheByType } from '@/lib/cache-vouchers-multi'
import type { Voucher } from '@/lib/wordpress/vouchers'

/**
 * Seed de vouchers MARÇO/2026
 */
export async function POST(request: NextRequest) {
  try {
    const { tipo } = await request.json()

    if (tipo === 'omnichannel') {
      // VOUCHERS OMNICHANNEL - Março 2026 (filtro por data de VENDA)
      const vouchersOmni = [
        {
          codigo: 'L6GHI9J',
          produto: 'Shiatsu - Shopping Metrópole - 45 minutos',
          dataVenda: '25/03/2026',
          dataTerapia: '30/03/2026',
          valorReembolso: 148.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
        {
          codigo: 'M1JKL4N',
          produto: 'Vale Bem-Estar - Shopping Metrópole - R$ 500',
          dataVenda: '19/03/2026',
          dataTerapia: '26/03/2026',
          valorReembolso: 400.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
        {
          codigo: 'N7MNO2P',
          produto: 'Indian Head 20\' - Shopping Metrópole',
          dataVenda: '14/03/2026',
          dataTerapia: '',
          valorReembolso: 112.00,
          unidade: 'Shopping Metrópole',
          status: 'Disponível'
        },
      ]

      const totalReembolso = vouchersOmni.reduce((sum, v) => sum + v.valorReembolso, 0)
      const utilizados = vouchersOmni.filter(v => v.status === 'Utilizado').length

      saveVoucherCacheByType('omnichannel', {
        dataIni: '2026-03-01',
        dataFim: '2026-03-31',
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
        message: '✓ Vouchers Omnichannel MARÇO carregados!',
        periodo: 'Março 2026 - Filtro por Data de VENDA',
        stats: {
          totalReembolso,
          totalVouchers: vouchersOmni.length,
          utilizados,
          disponiveis: vouchersOmni.length - utilizados,
        },
      })
    }

    if (tipo === 'cortesia') {
      // VOUCHERS CORTESIA - Março 2026 (dados reais)
      const vouchersCortesia = [
        {
          codigo: 'S64F8KH',
          produto: 'Relaxante Corporal 60\' - Cortesia rede',
          dataCriacao: '11/03/2026 15:48:26',
          dataTerapia: '24/03/2026 18:39:45',
          valorReembolso: 0.00,
          valor: 233.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
        {
          codigo: 'PX61P1X',
          produto: 'Relaxante Corporal 60\' - Cortesia rede',
          dataCriacao: '11/03/2026 15:48:23',
          dataTerapia: '24/03/2026 17:16:08',
          valorReembolso: 0.00,
          valor: 233.00,
          unidade: 'Shopping Metrópole',
          status: 'Utilizado'
        },
      ]

      const totalReembolso = 0.00
      const totalValor = vouchersCortesia.reduce((sum, v) => sum + v.valor, 0)

      saveVoucherCacheByType('cortesia', {
        dataIni: '2026-03-01',
        dataFim: '2026-03-31',
        totalReembolso,
        totalValor,
        totalValidados: vouchersCortesia.length,
        pendentesValidacao: 0,
        validacaoManual: 0,
        validacaoAutomatica: 0,
        vouchers: vouchersCortesia as any,
        savedAt: new Date().toISOString(),
      })

      return Response.json({
        ok: true,
        message: '✓ Vouchers Cortesia MARÇO carregados!',
        periodo: 'Março 2026 - Filtro por Data de UTILIZAÇÃO',
        stats: {
          totalReembolso,
          totalValor,
          totalVouchers: vouchersCortesia.length,
        },
      })
    }

    // VOUCHERS SITE - Março 2026 (filtro por data de UTILIZAÇÃO)
    const vouchersSite: Voucher[] = []
    let totalAcumulado = 0
    const valorAlvo = 21700.00 // Valor fictício para março

    const valores = [154, 189, 164, 380, 680]
    let contador = 1

    while (totalAcumulado < valorAlvo) {
      const valorRestante = valorAlvo - totalAcumulado
      let valor = valores[Math.floor(Math.random() * valores.length)]

      if (valorRestante < 200) {
        valor = valorRestante
      }

      if (totalAcumulado + valor <= valorAlvo) {
        const dia = Math.floor(Math.random() * 31) + 1
        vouchersSite.push({
          codigo: String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                  Math.random().toString(36).substring(2, 8).toUpperCase(),
          produto: valor === 154 ? 'Massagem Relaxante 60min' :
                   valor === 189 ? 'Massagem Relaxante 90min' :
                   valor === 164 ? 'Massagem Terapêutica 60min' :
                   valor === 380 ? 'Day Spa Prime Individual' :
                   valor === 680 ? 'Day Spa Prime em Dupla' : 'Serviço Especial',
          dataTerapia: `${String(dia).padStart(2, '0')}/03/2026`,
          dataVenda: `${String(Math.max(1, dia - 5)).padStart(2, '0')}/03/2026`,
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
      dataIni: '2026-03-01',
      dataFim: '2026-03-31',
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
      message: '✓ Vouchers Site MARÇO carregados!',
      periodo: 'Março 2026 - Filtro por Data de UTILIZAÇÃO',
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
