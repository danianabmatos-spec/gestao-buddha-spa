import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { buscarAtendimentosBelle } from '@/lib/belle/atendimentos'
import { casarNome } from '@/lib/belle/matching'

// Recursos/salas e nomes de estabelecimento NÃO são terapeutas — não entram na validação.
// Ex.: "Banho de Imersão", "Banho superior/inferior", "Banho Individual EVEREST",
// "Banho Casal TAJ MAHAL", "Banho I", "Buddha Spa Shopping...", "---".
function ehProfissionalValido(nome: string): boolean {
  const n = nome.trim().toLowerCase()
  if (!n) return false
  if (/^[-\s]+$/.test(n)) return false
  if (/^banho\b/.test(n)) return false        // qualquer "Banho ..."
  if (/^buddha\s*spa\b/.test(n)) return false  // nome do estabelecimento
  return true
}

export interface ResultadoSync {
  unidadeSlug: string
  periodo: { dataIni: string; dataFim: string }
  totalBelle: number
  gravados: number
  terapeutasCriadas: number
}

// Sincroniza os atendimentos do Belle de uma unidade para dentro do gestao.
// - casa o profissional do Belle com a Terapeuta cadastrada (auto-cria se for nova);
// - grava/atualiza o Atendimento por belleId SEM tocar na validação já feita
//   pela terapeuta (statusValidacao / observacaoContestacao / respostaCoord).
export async function syncAtendimentosUnidade(
  unidadeSlug: string,
  dataIni: string,
  dataFim: string,
): Promise<ResultadoSync> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred || !cred.email || !cred.password) {
    throw new Error(`Sem credenciais Belle para "${unidadeSlug}"`)
  }

  const belle = await buscarAtendimentosBelle(cred.email, cred.password, cred.estab, dataIni, dataFim)

  let pool = await prisma.terapeuta.findMany({ where: { unidadeSlug, ativo: true } })
  let terapeutasCriadas = 0
  let gravados = 0

  for (const at of belle) {
    const nomeProf = (at.profissionalNome || '').trim()
    if (!ehProfissionalValido(nomeProf)) continue

    let ter = casarNome(nomeProf, pool)
    if (!ter) {
      ter = await prisma.terapeuta.create({
        data: { nome: nomeProf, nomeBelle: nomeProf, unidadeSlug },
      })
      pool = [...pool, ter]
      terapeutasCriadas++
    }

    const belleFields = {
      unidadeSlug,
      terapeutaId: ter.id,
      terapeutaNome: nomeProf,
      clienteNome: at.clienteNome || 'Cliente',
      servico: at.servico || null,
      data: at.data,
      valorComissao: at.comissaoR || 0,
      fechamentoRef: at.data.slice(0, 7),
    }

    await prisma.atendimento.upsert({
      where: { belleId: at.belleId },
      // Preserva statusValidacao/observacao no update — o sync não desfaz a validação.
      create: { belleId: at.belleId, statusValidacao: 'PENDENTE', ...belleFields },
      update: belleFields,
    })
    gravados++
  }

  return {
    unidadeSlug,
    periodo: { dataIni, dataFim },
    totalBelle: belle.length,
    gravados,
    terapeutasCriadas,
  }
}
