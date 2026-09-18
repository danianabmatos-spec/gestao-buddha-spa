import { prisma } from '@/lib/prisma'

// Apuração da pontuação das terapeutas no mês (F3). Regra da Daniana:
//   VOUCHER / NOVO_AGENDAMENTO / PRODUTO = 1 ponto (× quantidade);
//   PACOTE = nº de sessões pagas (= quantidade).
// A unidade precisa somar ≥100 pts pra ativar o prêmio; ≥150 libera o sorteio.
// Conta pela VENDA efetivada no mês (Venda.criadoEm) e credita a terapeuta que recomendou.

export interface PontosTerapeuta {
  terapeutaNome: string
  voucher: number
  agendamento: number
  produto: number
  pacote: number
  total: number
}
export interface Apuracao {
  ref: string
  porTerapeuta: PontosTerapeuta[]
  totalUnidade: number
  metaPremio: number
  metaSorteio: number
  premioAtivo: boolean
  sorteioAtivo: boolean
  ganhador: string | null
}

const META_PREMIO = 100
const META_SORTEIO = 150

function faixaMes(ref: string): { gte: Date; lt: Date } {
  const [ano, mes] = ref.split('-').map(Number)
  return { gte: new Date(ano, mes - 1, 1), lt: new Date(ano, mes, 1) }
}

export async function apurarPontuacao(unidadeSlug: string, ref: string): Promise<Apuracao> {
  const { gte, lt } = faixaMes(ref)
  const vendas = await prisma.venda.findMany({
    where: { unidadeSlug, criadoEm: { gte, lt } },
    include: { itens: true, recomendacao: { select: { terapeutaNome: true } } },
  })

  const map = new Map<string, PontosTerapeuta>()
  for (const v of vendas) {
    const nome = v.recomendacao?.terapeutaNome || '—'
    const p = map.get(nome) || { terapeutaNome: nome, voucher: 0, agendamento: 0, produto: 0, pacote: 0, total: 0 }
    for (const it of v.itens) {
      const q = it.quantidade || 1
      if (it.tipo === 'VOUCHER') p.voucher += q
      else if (it.tipo === 'NOVO_AGENDAMENTO') p.agendamento += q
      else if (it.tipo === 'PRODUTO') p.produto += q
      else if (it.tipo === 'PACOTE') p.pacote += q
      p.total += q
    }
    map.set(nome, p)
  }

  const porTerapeuta = [...map.values()].sort((a, b) => b.total - a.total || a.terapeutaNome.localeCompare(b.terapeutaNome))
  const totalUnidade = porTerapeuta.reduce((s, t) => s + t.total, 0)
  const premioAtivo = totalUnidade >= META_PREMIO
  const sorteioAtivo = totalUnidade >= META_SORTEIO
  const ganhador = premioAtivo && (porTerapeuta[0]?.total ?? 0) > 0 ? porTerapeuta[0].terapeutaNome : null

  return { ref, porTerapeuta, totalUnidade, metaPremio: META_PREMIO, metaSorteio: META_SORTEIO, premioAtivo, sorteioAtivo, ganhador }
}

// ─── Consolidado "geral" (todas as unidades) — visão da dona ─────────────────────
export interface ResumoUnidade {
  slug: string
  nome: string
  totalUnidade: number
  premioAtivo: boolean
  sorteioAtivo: boolean
  ganhador: string | null
  topTotal: number
}
export interface Consolidado {
  ref: string
  unidades: ResumoUnidade[]
  totalGeral: number
  metaPremio: number
  metaSorteio: number
  unidadesComPremio: number
}

export async function apurarConsolidado(unidades: { slug: string; nome: string }[], ref: string): Promise<Consolidado> {
  const linhas: ResumoUnidade[] = []
  for (const u of unidades) {
    const a = await apurarPontuacao(u.slug, ref)
    linhas.push({
      slug: u.slug, nome: u.nome,
      totalUnidade: a.totalUnidade, premioAtivo: a.premioAtivo, sorteioAtivo: a.sorteioAtivo,
      ganhador: a.ganhador, topTotal: a.porTerapeuta[0]?.total ?? 0,
    })
  }
  linhas.sort((a, b) => b.totalUnidade - a.totalUnidade || a.nome.localeCompare(b.nome))
  const totalGeral = linhas.reduce((s, u) => s + u.totalUnidade, 0)
  return {
    ref, unidades: linhas, totalGeral,
    metaPremio: META_PREMIO, metaSorteio: META_SORTEIO,
    unidadesComPremio: linhas.filter((u) => u.premioAtivo).length,
  }
}
