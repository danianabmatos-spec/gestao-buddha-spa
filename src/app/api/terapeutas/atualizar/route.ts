import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { buscarTerapeutasBelle } from '@/lib/terapeutas/belle-fetch'

function periodoSemestre(dataFim: string): string {
  const [ano, mes] = dataFim.split('-').map(Number)
  return `${ano}-S${mes <= 6 ? 1 : 2}`
}

// "Atualizar agora": consulta o Belle (única rota que faz isso) e grava no cache.
// Em erro (conta bloqueada, rate limit), NÃO apaga o cache existente — devolve mensagem.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const unidade = String(body.unidade || '').trim()
  const dataIni = String(body.dataIni || '').trim()
  const dataFim = String(body.dataFim || '').trim()
  if (!unidade || !dataIni || !dataFim) {
    return NextResponse.json({ ok: false, error: 'unidade, dataIni e dataFim são obrigatórios' }, { status: 400 })
  }
  const periodo = periodoSemestre(dataFim)

  try {
    const dados = await buscarTerapeutasBelle(unidade, dataIni, dataFim)
    const agora = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TerapeutaBelleCache" ("unidadeSlug","periodo","dados","atualizadoEm","atualizadoPor")
       VALUES (?,?,?,?,?)
       ON CONFLICT("unidadeSlug","periodo") DO UPDATE SET
         "dados" = excluded."dados", "atualizadoEm" = excluded."atualizadoEm", "atualizadoPor" = excluded."atualizadoPor"`,
      unidade, periodo, JSON.stringify(dados), agora, session.nome || session.email || '',
    )
    return NextResponse.json({ ok: true, atualizadoEm: agora, total: dados.length })
  } catch (e) {
    console.error('Erro ao atualizar terapeutas (Belle):', e)
    const msg = e instanceof Error ? e.message : String(e)
    const amigavel =
      /401|bloquead|inválid/i.test(msg)
        ? 'O Belle desta unidade recusou o acesso (conta bloqueada ou 2FA). Verifique o login da unidade no Belle.'
        : /429/.test(msg)
        ? 'O Belle está limitando as requisições agora. Tente novamente em alguns minutos.'
        : 'Falha ao consultar o Belle. Tente novamente.'
    return NextResponse.json({ ok: false, error: amigavel, detalhe: msg }, { status: 502 })
  }
}
