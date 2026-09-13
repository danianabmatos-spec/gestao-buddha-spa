import { NextRequest } from 'next/server'
import { getFaturamentoMensal } from '@/lib/belle/bi'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const UNIDADES: Record<string, { email: string; senha: string; estab: string }> = {
  'shopping-metropole': {
    email: process.env.BELLE_METROPOLE_EMAIL!,
    senha: process.env.BELLE_METROPOLE_PASSWORD!,
    estab: process.env.BELLE_METROPOLE_ESTAB ?? '1',
  },
  'analia-franco': {
    email: process.env.BELLE_ANALIA_FRANCO_EMAIL!,
    senha: process.env.BELLE_ANALIA_FRANCO_PASSWORD!,
    estab: process.env.BELLE_ANALIA_FRANCO_ESTAB ?? '1',
  },
  'shopping-analia-franco': {
    email: process.env.BELLE_SHOPPING_ANALIA_FRANCO_EMAIL!,
    senha: process.env.BELLE_SHOPPING_ANALIA_FRANCO_PASSWORD!,
    estab: process.env.BELLE_SHOPPING_ANALIA_FRANCO_ESTAB ?? '1',
  },
  'perdizes': {
    email: process.env.BELLE_PERDIZES_EMAIL!,
    senha: process.env.BELLE_PERDIZES_PASSWORD!,
    estab: process.env.BELLE_PERDIZES_ESTAB ?? '1',
  },
  'tatuape-gomescardim': {
    email: process.env.BELLE_TATUAPE_GOMESCARDIM_EMAIL!,
    senha: process.env.BELLE_TATUAPE_GOMESCARDIM_PASSWORD!,
    estab: process.env.BELLE_TATUAPE_GOMESCARDIM_ESTAB ?? '1',
  },
  'mooca-plaza': {
    email: process.env.BELLE_MOOCA_PLAZA_EMAIL!,
    senha: process.env.BELLE_MOOCA_PLAZA_PASSWORD!,
    estab: process.env.BELLE_MOOCA_PLAZA_ESTAB ?? '1',
  },
  'higienopolis': {
    email: process.env.BELLE_HIGIENOPOLIS_EMAIL!,
    senha: process.env.BELLE_HIGIENOPOLIS_PASSWORD!,
    estab: process.env.BELLE_HIGIENOPOLIS_ESTAB ?? '1',
  },
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const unidadeSlug = searchParams.get('unidade') ?? 'shopping-metropole'

  // Aceita ?dataIni=YYYY-MM-DD&dataFim=YYYY-MM-DD  (prioridade)
  // ou ?mes=2026-06  (mês completo)
  // ou sem parâmetros → mês corrente acumulado até hoje
  const dataIniParam = searchParams.get('dataIni')
  const dataFimParam = searchParams.get('dataFim')
  const mesParam = searchParams.get('mes')
  let dataIni: string
  let dataFim: string

  if (dataIniParam && dataFimParam) {
    dataIni = dataIniParam
    dataFim = dataFimParam
  } else if (mesParam) {
    const ref = new Date(`${mesParam}-01`)
    dataIni = format(startOfMonth(ref), 'yyyy-MM-dd')
    dataFim = format(endOfMonth(ref), 'yyyy-MM-dd')
  } else {
    const hoje = new Date()
    dataIni = format(startOfMonth(hoje), 'yyyy-MM-dd')
    dataFim = format(hoje, 'yyyy-MM-dd')
  }

  const unidade = UNIDADES[unidadeSlug]
  if (!unidade) return Response.json({ error: 'Unidade não encontrada' }, { status: 404 })

  try {
    const resultado = await getFaturamentoMensal(
      unidade.email,
      unidade.senha,
      unidade.estab,
      dataIni,
      dataFim
    )
    return Response.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Belle Faturamento Error]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
