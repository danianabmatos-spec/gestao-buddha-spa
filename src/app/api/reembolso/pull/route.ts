import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { salvarPull, mesEstaFechado } from '@/lib/reembolso/motor'
import { resolverSlug } from '@/lib/reembolso/unidades'

export const dynamic = 'force-dynamic'

// A busca é feita pelo bookmarklet rodando em buddhaspa.com.br (sessão real da
// Daniana), que faz POST cross-origin. Liberamos CORS para esse domínio.
const CORS = {
  'Access-Control-Allow-Origin': 'https://buddhaspa.com.br',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// POST /api/reembolso/pull
// Body: { ano, mes, vouchers, omnichannel, cortesias[],
//         unidadeId? | unidadeNome? | contaWp? | affiliation? }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const ano = Number(b.ano)
    const mes = Number(b.mes)
    if (!ano || !mes || mes < 1 || mes > 12) {
      return Response.json({ ok: false, error: 'ano/mes inválidos' }, { status: 400, headers: CORS })
    }
    if (await mesEstaFechado(ano, mes)) {
      return Response.json({ ok: false, error: 'Mês fechado — reabra no ERP para atualizar.' }, { status: 423, headers: CORS })
    }

    // Resolve a unidade: id explícito OU pelos sinais do WordPress
    let unidadeId: number | null = b.unidadeId ? Number(b.unidadeId) : null
    if (!unidadeId) {
      const slug = resolverSlug({ unidadeNome: b.unidadeNome, contaWp: b.contaWp, affiliation: b.affiliation })
      if (!slug) {
        return Response.json({ ok: false, error: `Não reconheci a unidade (conta: "${b.contaWp ?? ''}" / unidade: "${b.unidadeNome ?? ''}")` }, { status: 422, headers: CORS })
      }
      const u = await prisma.unidade.findUnique({ where: { slug }, select: { id: true } })
      if (!u) return Response.json({ ok: false, error: `Unidade "${slug}" não existe no ERP` }, { status: 404, headers: CORS })
      unidadeId = u.id
    }

    const cortesias = Array.isArray(b.cortesias) ? b.cortesias.map((c: Record<string, unknown>) => ({
      codigo: String(c.codigo ?? c.cod ?? ''),
      nome: String(c.nome ?? ''),
      valor: Number(c.valor ?? c.val ?? 0) || 0,
      dataUtilizacao: (c.dataUtilizacao ?? c.data ?? null) as string | null,
    })) : []

    await salvarPull({
      ano, mes, unidadeId,
      vouchers: Number(b.vouchers) || 0,
      omnichannel: Number(b.omnichannel) || 0,
      cortesias,
    })

    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId }, select: { nome: true } })
    return Response.json({
      ok: true,
      unidade: unidade?.nome,
      ano, mes,
      vouchers: Number(b.vouchers) || 0,
      omnichannel: Number(b.omnichannel) || 0,
      cortesias: cortesias.length,
      cortesiaUsada: cortesias.reduce((a: number, c: { valor: number }) => a + c.valor, 0),
    }, { headers: CORS })
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500, headers: CORS })
  }
}
