import { prisma } from '@/lib/prisma'

// ─── Integração ERP → LeadFlow (Nível 1: espelhar mensagens) ────────────────────
// Espelhar = registrar no LeadFlow o histórico das mensagens enviadas pelo ERP.
// NÃO envia nada ao cliente — apenas grava. E só roda quando LIGADO explicitamente.

const MAX_TENTATIVAS = 5

/** A sincronização só acontece quando LEADFLOW_SYNC_ENABLED === 'true'. */
export function syncHabilitado(): boolean {
  return process.env.LEADFLOW_SYNC_ENABLED === 'true'
}

interface EntradaOutbox {
  unidadeSlug: string
  nomeCliente: string
  telefone: string | null
  texto: string
  motivo: string
}

/** Enfileira uma mensagem para espelhar. Sempre grava (mesmo desligado) — nada se perde. */
export async function enfileirarMensagem(d: EntradaOutbox) {
  return prisma.leadFlowOutbox.create({
    data: {
      unidadeSlug: d.unidadeSlug,
      nomeCliente: d.nomeCliente,
      telefone: d.telefone,
      texto: d.texto,
      motivo: d.motivo,
    },
  })
}

/** Processa a fila: envia os pendentes ao LeadFlow. No-op se estiver desligado. */
export async function processarOutbox(limite = 50): Promise<{ skipped?: boolean; ok?: number; falha?: number; motivo?: string }> {
  if (!syncHabilitado()) return { skipped: true, motivo: 'LEADFLOW_SYNC_ENABLED != true' }

  const url = process.env.LEADFLOW_URL
  const key = process.env.ERP_INTEGRATION_KEY
  if (!url || !key) return { skipped: true, motivo: 'LEADFLOW_URL / ERP_INTEGRATION_KEY ausentes' }

  const pendentes = await prisma.leadFlowOutbox.findMany({
    where: { status: { in: ['PENDENTE', 'ERRO'] }, tentativas: { lt: MAX_TENTATIVAS } },
    orderBy: { criadoEm: 'asc' },
    take: limite,
  })

  let ok = 0, falha = 0
  for (const item of pendentes) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/api/erp/mensagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-erp-key': key },
        body: JSON.stringify({
          telefone: item.telefone,
          nome: item.nomeCliente,
          unidade: item.unidadeSlug,
          texto: item.texto,
          motivo: item.motivo,
          enviadoEm: item.criadoEm,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await prisma.leadFlowOutbox.update({
        where: { id: item.id },
        data: { status: 'ENVIADO', enviadoEm: new Date(), erro: null, tentativas: { increment: 1 } },
      })
      ok++
    } catch (e) {
      const tentativas = item.tentativas + 1
      await prisma.leadFlowOutbox.update({
        where: { id: item.id },
        data: {
          tentativas,
          status: tentativas >= MAX_TENTATIVAS ? 'ERRO' : 'PENDENTE',
          erro: e instanceof Error ? e.message : String(e),
        },
      })
      falha++
    }
  }
  return { ok, falha }
}

/** Contagem por status (para painel/monitoramento). */
export async function statusOutbox() {
  const grupos = await prisma.leadFlowOutbox.groupBy({ by: ['status'], _count: { status: true } })
  const contagem: Record<string, number> = { PENDENTE: 0, ENVIADO: 0, ERRO: 0 }
  for (const g of grupos) contagem[g.status] = g._count.status
  return { habilitado: syncHabilitado(), contagem }
}
