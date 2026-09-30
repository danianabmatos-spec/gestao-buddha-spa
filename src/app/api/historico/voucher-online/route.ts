import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseVouchersHTML, type Voucher } from '@/lib/wordpress/vouchers'

export const dynamic = 'force-dynamic'

// Backfill do histórico de VOUCHER ONLINE (site/WordPress) por unidade/mês.
// Alimentado por um script de console rodando em buddhaspa.com.br (sessão real da
// Daniana) que faz POST cross-origin com o HTML já baixado — mesma lógica do
// bookmarklet do reembolso, que passa pelo Cloudflare porque roda no navegador dela.
const CORS = {
  'Access-Control-Allow-Origin': 'https://buddhaspa.com.br',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// POST { unidadeSlug, ano, mes, html }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const unidadeSlug = String(b.unidadeSlug || '')
    const ano = Number(b.ano)
    const mes = Number(b.mes)
    if (!unidadeSlug || !ano || !mes || mes < 1 || mes > 12) {
      return Response.json({ ok: false, error: 'unidadeSlug/ano/mes inválidos' }, { status: 400, headers: CORS })
    }

    const mm = String(mes).padStart(2, '0')
    const dataIni = `${ano}-${mm}-01`
    const dataFim = `${ano}-${mm}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`

    const parsed = parseVouchersHTML(String(b.html || ''), dataIni, dataFim) as { vouchers: Voucher[] }
    const vouchers = parsed.vouchers || []
    const total = vouchers.reduce((s, v) => s + (Number(v.valorReembolso) || 0), 0)

    // Grava só voucherOnline (não toca em caixa/horas/gympass/totalpass da linha).
    await prisma.faturamentoHistorico.upsert({
      where: { unidadeSlug_ano_mes: { unidadeSlug, ano, mes } },
      create: { unidadeSlug, ano, mes, voucherOnline: total },
      update: { voucherOnline: total },
    })

    return Response.json({ ok: true, unidadeSlug, ano, mes, vouchers: vouchers.length, voucherOnline: total }, { headers: CORS })
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500, headers: CORS })
  }
}
