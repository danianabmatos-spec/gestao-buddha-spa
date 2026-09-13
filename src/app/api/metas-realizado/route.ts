import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getFaturamentoMensal, getVendasRecepcao } from '@/lib/belle/bi'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Realizado mensal (caixa/horas/recepção) do ano, com CACHE:
// - meses fechados → RealizadoMensalCache (caixa/horas reaproveitam FaturamentoHistorico)
// - mês atual → DashboardCache (já aquecido pelo cron), senão ao vivo
export async function GET(req: NextRequest) {
  const unidade = req.nextUrl.searchParams.get('unidade')
  const ano = Number(req.nextUrl.searchParams.get('ano') || '2026')
  if (!unidade) return NextResponse.json({ error: 'unidade obrigatória' }, { status: 400 })
  const cred = getUnidadeCredenciais(unidade)
  if (!cred) return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()
  const ultimoMes = ano < anoAtual ? 12 : ano === anoAtual ? mesAtual : 0

  const meses = await Promise.all(
    Array.from({ length: ultimoMes }, (_, i) => i + 1).map(async (m) => {
      const ehAtual = ano === anoAtual && m === mesAtual
      let caixa = 0, horas = 0, recepcao = 0

      try {
        if (ehAtual) {
          // Mês atual = mesma janela do dashboard (mês até hoje) → reusa o cache dele.
          const di = format(startOfMonth(hoje), 'yyyy-MM-dd')
          const df = format(hoje, 'yyyy-MM-dd')
          const dc = await prisma.dashboardCache.findUnique({ where: { chave: `${unidade}_${di}_${df}` } })
          if (dc) {
            const d = JSON.parse(dc.dados)
            caixa = d.faturamento?.caixa ?? 0
            horas = d.faturamento?.horasAtendimento ?? 0
            recepcao = d.vendas?.total?.valorLiquido ?? 0
          } else {
            const [f, v] = await Promise.all([
              getFaturamentoMensal(cred.email, cred.password, String(cred.estab), di, df),
              getVendasRecepcao(cred.email, cred.password, String(cred.estab), di, df),
            ])
            caixa = f.caixa; horas = f.horasAtendimento; recepcao = v.total.valorLiquido
          }
        } else {
          const cache = await prisma.realizadoMensalCache.findUnique({
            where: { unidadeSlug_ano_mes: { unidadeSlug: unidade, ano, mes: m } },
          })
          if (cache) {
            caixa = cache.caixa; horas = cache.horas; recepcao = cache.recepcao
          } else {
            const di = format(startOfMonth(new Date(ano, m - 1, 1)), 'yyyy-MM-dd')
            const df = format(endOfMonth(new Date(ano, m - 1, 1)), 'yyyy-MM-dd')
            // caixa/horas: reaproveita o histórico já cacheado; senão puxa do Belle
            const fh = await prisma.faturamentoHistorico.findUnique({
              where: { unidadeSlug_ano_mes: { unidadeSlug: unidade, ano, mes: m } },
            })
            let fCaixa = fh?.caixa
            let fHoras = fh?.horas
            const tarefas: Promise<void>[] = []
            if (fCaixa === undefined) {
              tarefas.push(getFaturamentoMensal(cred.email, cred.password, String(cred.estab), di, df).then((f) => { fCaixa = f.caixa; fHoras = f.horasAtendimento }))
            }
            tarefas.push(getVendasRecepcao(cred.email, cred.password, String(cred.estab), di, df).then((v) => { recepcao = v.total.valorLiquido }))
            await Promise.all(tarefas)
            caixa = fCaixa ?? 0; horas = fHoras ?? 0
            // Cacheia mês fechado com dado real (nunca zero-erro)
            if (caixa > 0 || horas > 0 || recepcao > 0) {
              await prisma.realizadoMensalCache.upsert({
                where: { unidadeSlug_ano_mes: { unidadeSlug: unidade, ano, mes: m } },
                create: { unidadeSlug: unidade, ano, mes: m, caixa, horas, recepcao },
                update: { caixa, horas, recepcao },
              })
            }
          }
        }
      } catch (e) {
        console.error(`[metas-realizado] ${unidade} ${ano}-${m}:`, e)
      }

      return { mes: m, caixa: Math.round(caixa), horas: Math.round(horas * 100) / 100, recepcao: Math.round(recepcao) }
    })
  )

  return NextResponse.json({ unidade, ano, meses })
}
