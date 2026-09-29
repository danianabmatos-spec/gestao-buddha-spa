import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { carregarBelleBola } from './belle'
import { casarNome } from '@/lib/belle/matching'
import { hojeBrasilia } from './dados'

// Diagnóstico de PRONTIDÃO da bola por unidade (read-only). Diz exatamente o que
// falta pra unidade operar: credencial Belle, terapeutas cadastradas casadas com o
// Belle, e quem ainda não tem login (não consegue dar "Cheguei"). É o instrumento
// do rollout "unidade-modelo → replicar".

export interface Prontidao {
  unidade: string
  belleOk: boolean
  belleErro?: string
  belleTerapeutas: { cod: string; nome: string }[]
  cadastradas: number
  semCadastro: string[] // nomes do Belle que não têm Terapeuta cadastrada
  semLogin: string[] // Terapeuta cadastrada mas sem login (usuarioId null)
  pronto: boolean
}

export async function diagnosticoProntidao(unidadeSlug: string): Promise<Prontidao> {
  const cadastradas = await prisma.terapeuta.findMany({
    where: { unidadeSlug, ativo: true },
    select: { id: true, nome: true, nomeBelle: true, usuarioId: true },
  })

  let belleTerapeutas: { cod: string; nome: string }[] = []
  let belleOk = true
  let belleErro: string | undefined
  try {
    const cred = getUnidadeCredenciais(unidadeSlug)
    if (!cred) throw new Error('sem credenciais Belle (env/config)')
    const belle = await carregarBelleBola(cred.email, cred.password, cred.estab, hojeBrasilia())
    belleTerapeutas = belle.profissionais
      .filter((p) => p.cod_profissional !== 'Banho' && !/banho de imers/i.test(p.nome_profiss || p.nome || ''))
      .map((p) => ({ cod: String(p.cod_profissional), nome: (p.nome_profiss || p.nome || '').trim() }))
  } catch (e) {
    belleOk = false
    belleErro = e instanceof Error ? e.message : 'falha ao ler o Belle'
  }

  const semCadastro = belleTerapeutas.filter((b) => !casarNome(b.nome, cadastradas)).map((b) => b.nome)
  const semLogin = cadastradas.filter((t) => !t.usuarioId).map((t) => t.nome)
  const pronto = belleOk && cadastradas.length > 0 && semCadastro.length === 0 && semLogin.length === 0

  return {
    unidade: unidadeSlug,
    belleOk,
    belleErro,
    belleTerapeutas,
    cadastradas: cadastradas.length,
    semCadastro,
    semLogin,
    pronto,
  }
}
