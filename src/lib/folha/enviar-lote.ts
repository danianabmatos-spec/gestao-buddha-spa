import { prisma } from '@/lib/prisma'

// Envia ao app FOLHA o LOTE de atendimentos confirmados/ajustados de um fechamento
// (disparado quando a coordenadora libera). Mesmo padrão da integração de metas:
// FOLHA_BASE_URL + header x-integracao-key. Best-effort: em falha NÃO lança (a
// liberação no gestao já ocorreu); marca enviadoFolhaEm só no sucesso (permite reenvio).

const FOLHA_BASE = process.env.FOLHA_BASE_URL || 'http://localhost:3003'
const KEY = process.env.INTEGRACAO_KEY || ''
// Interruptor de segurança: enquanto != '1', NENHUM envio real vai à folha.
// O dry-run (simulação) ignora a trava — serve justamente pra testar sem gravar.
const PONTE_ATIVA = process.env.PONTE_FOLHA_ATIVA === '1'

export interface ForcadoItem { terapeuta: string; pendentes: number }

export async function enviarLoteFolha(opts: {
  unidadeSlug: string
  ref: string
  forcado: boolean
  forcadoInfo: ForcadoItem[]
  liberadoPorNome: string
  dryRun?: boolean       // simulação: folha casa tudo e devolve relatório, sem gravar
  incluirTodos?: boolean // p/ teste: inclui todos os status (não só CONFIRMADO/AJUSTADO)
  explicito?: boolean    // envio real deliberado (rota de teste, 1 unidade) — dispensa a trava global
}): Promise<{ ok: boolean; erro?: string; resposta?: unknown; desativada?: boolean }> {
  const { unidadeSlug, ref, forcado, forcadoInfo, liberadoPorNome, dryRun, incluirTodos, explicito } = opts

  // Trava: envio real automático (fluxo de liberação) só quando a ponte estiver ligada.
  // Um envio explícito (rota de teste, autorizado) pode passar mesmo com a trava desligada.
  if (!dryRun && !PONTE_ATIVA && !explicito) {
    return { ok: false, desativada: true, erro: 'Ponte com a folha desligada (defina PONTE_FOLHA_ATIVA=1 para ativar).' }
  }

  try {
    const statusFiltro = incluirTodos
      ? undefined
      : { in: ['CONFIRMADO', 'AJUSTADO'] as string[] }
    const confirmados = await prisma.atendimento.findMany({
      where: { unidadeSlug, fechamentoRef: ref, ...(statusFiltro ? { statusValidacao: statusFiltro } : {}) },
      select: { belleId: true, terapeutaNome: true, clienteNome: true, servico: true, data: true, valorComissao: true },
    })
    const atendimentos = confirmados.map((a) => ({
      belleId: a.belleId,
      terapeutaNome: a.terapeutaNome,
      clienteNome: a.clienteNome,
      servico: a.servico,
      data: a.data,
      valorComissao: a.valorComissao,
    }))

    const resp = await fetch(`${FOLHA_BASE}/api/integracao/atendimentos-confirmados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-integracao-key': KEY },
      body: JSON.stringify({ unidadeSlug, ref, atendimentos, forcado, forcadoInfo, liberadoPorNome, dryRun: !!dryRun }),
      signal: AbortSignal.timeout(30_000),
    })
    const resposta = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return { ok: false, erro: (resposta as { error?: string }).error || `Folha respondeu ${resp.status}`, resposta }
    }
    // Só marca "enviado" quando foi envio REAL (dry-run não grava nada).
    if (!dryRun) {
      await prisma.fechamentoValidacao
        .update({ where: { unidadeSlug_ref: { unidadeSlug, ref } }, data: { enviadoFolhaEm: new Date() } })
        .catch(() => {})
    }
    return { ok: true, resposta }
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}
