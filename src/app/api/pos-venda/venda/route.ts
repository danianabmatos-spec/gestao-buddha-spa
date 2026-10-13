import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, unidadesPermitidas } from '@/lib/auth/guard'
import { enviarAnuncioGrupo } from '@/lib/bola/whatsapp'

export const dynamic = 'force-dynamic'

const PERFIS_OK = ['DONA', 'RECEPCAO', 'COORDENACAO']
const TIPOS = ['VOUCHER', 'NOVO_AGENDAMENTO', 'PRODUTO', 'PACOTE']

// POST /api/pos-venda/venda
//   { belleId, itens: [{ tipo, quantidade }], observacao? }
// A recepção confirma a venda e classifica o que converteu. Base da pontuação (F3):
// VOUCHER/NOVO_AGENDAMENTO/PRODUTO = 1 pt (×qtd); PACOTE = nº de sessões pagas.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!PERFIS_OK.includes(session.perfil)) {
    return NextResponse.json({ error: 'Acesso restrito à recepção/coordenação.' }, { status: 403 })
  }

  const { belleId, itens, observacao } = await req.json().catch(() => ({}))
  if (!belleId || !Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Informe o atendimento e ao menos um item vendido.' }, { status: 400 })
  }
  const limpos = itens
    .filter((i: { tipo?: string }) => TIPOS.includes(i?.tipo ?? ''))
    .map((i: { tipo: string; quantidade?: number }) => ({
      tipo: i.tipo,
      quantidade: Math.max(1, Math.floor(Number(i.quantidade) || 1)),
    }))
  if (limpos.length === 0) {
    return NextResponse.json({ error: 'Itens inválidos.' }, { status: 400 })
  }

  const rec = await prisma.recomendacao.findUnique({ where: { belleId: String(belleId) } })
  if (!rec) return NextResponse.json({ error: 'Recomendação não encontrada.' }, { status: 404 })
  const permitidas = unidadesPermitidas(session)
  if (permitidas !== null && !permitidas.includes(rec.unidadeSlug)) {
    return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  }

  const venda = await prisma.venda.upsert({
    where: { recomendacaoId: rec.id },
    create: {
      recomendacaoId: rec.id, belleId: rec.belleId, unidadeSlug: rec.unidadeSlug,
      confirmadoPorId: session.sub, confirmadoPorNome: session.nome, observacao: observacao ? String(observacao) : null,
    },
    update: { confirmadoPorId: session.sub, confirmadoPorNome: session.nome, observacao: observacao ? String(observacao) : null },
  })
  await prisma.vendaItem.deleteMany({ where: { vendaId: venda.id } })
  await prisma.vendaItem.createMany({ data: limpos.map((i) => ({ vendaId: venda.id, tipo: i.tipo, quantidade: i.quantidade })) })
  const eraVendida = rec.status === 'VENDIDA'
  await prisma.recomendacao.update({ where: { id: rec.id }, data: { status: 'VENDIDA' } })

  // Aviso no grupo PEx — só na 1ª venda (não re-avisa em edição). Isolado: falha
  // no WhatsApp não derruba o registro da venda.
  if (!eraVendida) {
    try {
      // Fonte: a própria recomendação (sempre tem terapeuta/cliente) — funciona
      // inclusive quando veio da bola e ainda não há Atendimento sincronizado.
      if (rec.terapeutaNome) {
        const primeiro = (n: string) => n.trim().split(/\s+/)[0] || n.trim()
        const pontos = limpos.reduce((s, i) => s + i.quantidade, 0)
        const LABEL: Record<string, (q: number) => string> = {
          VOUCHER: (q) => (q > 1 ? `${q} vouchers` : 'um voucher'),
          NOVO_AGENDAMENTO: (q) => (q > 1 ? `${q} novos agendamentos` : 'um novo agendamento'),
          PRODUTO: (q) => (q > 1 ? `${q} produtos` : 'um produto'),
          PACOTE: (q) => `um pacote de ${q} sessões`,
        }
        const desc = limpos.map((i) => LABEL[i.tipo](i.quantidade)).join(' + ')
        const msg = `🌟 ${primeiro(rec.terapeutaNome)}, sua cliente ${primeiro(rec.clienteNome)} fechou ${desc} conforme sua recomendação — você ganhou ${pontos} ponto${pontos > 1 ? 's' : ''}! Parabéns, brilhou!! 🎉`
        await enviarAnuncioGrupo(rec.unidadeSlug, msg, 'pex')
      }
    } catch (e) {
      console.error('[pos-venda/venda] aviso PEx:', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ ok: true, vendaId: venda.id })
}
