import { NextRequest } from 'next/server'
import { validarVoucher } from '@/lib/wordpress/client'

export async function POST(request: NextRequest) {
  try {
    const { codigo } = await request.json()
    if (!codigo) return Response.json({ error: 'Código do voucher é obrigatório' }, { status: 400 })

    const resultado = await validarVoucher(String(codigo).trim().toUpperCase())
    return Response.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Validar Voucher Error]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
