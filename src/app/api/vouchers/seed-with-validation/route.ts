import { NextRequest } from 'next/server'
import { saveVoucherCache } from '@/lib/cache-vouchers'
import { validarVouchersComBelle, calcularEstatisticas } from '@/lib/wordpress/auto-validator'
import type { Voucher } from '@/lib/wordpress/vouchers'

/**
 * Seed com validação automática simulada
 * Cria vouchers + agendamentos correspondentes e valida
 */
export async function POST(request: NextRequest) {
  try {
    // Vouchers do site (alguns pendentes)
    // Formato de código real: 7 caracteres alfanuméricos (ex: D9FLX5K)
    const vouchersBrutos: Voucher[] = [
      {
        codigo: 'A8KMN2X',
        produto: 'Massagem Relaxante 60min',
        dataTerapia: '02/06/2026',
        dataVenda: '28/05/2026',
        status: 'Pendente', // ← Será validado automaticamente
        formaValidacao: 'Pendente',
        valorReembolso: 154,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'B3PLQ7Y',
        produto: 'Day Spa Prime Individual',
        dataTerapia: '03/06/2026',
        dataVenda: '30/05/2026',
        status: 'Pendente', // ← Será validado automaticamente
        formaValidacao: 'Pendente',
        valorReembolso: 380,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'C6RWT9Z',
        produto: 'Massagem Relaxante 60min',
        dataTerapia: '04/06/2026',
        dataVenda: '01/06/2026',
        status: 'Pendente', // ← SEM agendamento correspondente
        formaValidacao: 'Pendente',
        valorReembolso: 154,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'D5XHV4M',
        produto: 'Massagem Terapêutica 60min',
        dataTerapia: '05/06/2026',
        dataVenda: '02/06/2026',
        status: 'Pendente', // ← Será validado automaticamente
        formaValidacao: 'Pendente',
        valorReembolso: 164,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'E9FLX5K',
        produto: 'Day Spa Prime em Dupla',
        dataTerapia: '05/06/2026',
        dataVenda: '03/06/2026',
        status: 'Validado', // ← Já validado manualmente
        formaValidacao: 'Manualmente',
        valorReembolso: 680,
        unidade: 'Shopping Metrópole'
      },
      {
        codigo: 'F2JNP8Q',
        produto: 'Massagem Relaxante 90min',
        dataTerapia: '06/06/2026',
        dataVenda: '04/06/2026',
        status: 'Pendente', // ← Será validado automaticamente
        formaValidacao: 'Pendente',
        valorReembolso: 189,
        unidade: 'Shopping Metrópole'
      },
    ]

    // Agendamentos correspondentes do Belle (simulado)
    const agendamentosBelle = [
      {
        data: '2026-06-02',
        servico: 'Massagem Relaxante',
        cliente: 'Maria Silva',
        terapeuta: 'Ana Santos',
        status: 'Confirmado'
      },
      {
        data: '2026-06-03',
        servico: 'Day Spa Prime Individual',
        cliente: 'João Pereira',
        terapeuta: 'Carla Lima',
        status: 'Confirmado'
      },
      {
        data: '2026-06-05',
        servico: 'Massagem Terapêutica',
        cliente: 'Pedro Costa',
        terapeuta: 'Beatriz Alves',
        status: 'Confirmado'
      },
      {
        data: '2026-06-06',
        servico: 'Massagem Relaxante 90min',
        cliente: 'Fernanda Souza',
        terapeuta: 'Juliana Rocha',
        status: 'Confirmado'
      },
      // Nota: 04/06 NÃO tem agendamento correspondente ao VCH-2026-003
    ]

    // VALIDAÇÃO AUTOMÁTICA
    const vouchersValidados = validarVouchersComBelle(
      vouchersBrutos as unknown as Parameters<typeof validarVouchersComBelle>[0],
      agendamentosBelle as unknown as Parameters<typeof validarVouchersComBelle>[1],
    )

    // Calcula estatísticas
    const stats = calcularEstatisticas(vouchersValidados)

    // Salva no cache
    const savedAt = new Date().toISOString()
    saveVoucherCache({
      dataIni: '2026-06-01',
      dataFim: '2026-06-06',
      ...stats,
      vouchers: vouchersValidados,
      savedAt,
    })

    // Conta quantos foram validados automaticamente agora
    const autoValidadosAgora = vouchersValidados.filter(
      v => v.formaValidacao === 'Automatico'
    ).length

    return Response.json({
      ok: true,
      message: '✓ Validação automática executada com sucesso!',
      stats: {
        ...stats,
        totalVouchers: vouchersValidados.length,
        autoValidadosAgora,
      },
      detalhes: {
        agendamentosEncontrados: agendamentosBelle.length,
        vouchers: vouchersValidados.map(v => ({
          codigo: v.codigo,
          produto: v.produto,
          data: v.dataTerapia,
          status: v.status,
          validacao: v.formaValidacao,
        }))
      },
      savedAt,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
