// Trava de concorrência da fila compartilhada (várias atendentes na Central pegam
// tarefas ao longo do dia). O ERP roda como processo único (PM2 fork), então um
// Map em memória basta. Reservas são efêmeras: expiram sozinhas por TTL.
//
// A segurança real do "não contatar 2x" NÃO é esta trava (que é só UX), e sim o
// /concluir — que grava `ultimoContato` e tira o cliente da fila para todo mundo.

const TTL_MS = 10 * 60 * 1000 // 10 minutos

interface Reserva { atendente: string; ate: number }
const reservas = new Map<number, Reserva>()

function limpar(): void {
  const agora = Date.now()
  for (const [id, r] of reservas) if (r.ate <= agora) reservas.delete(id)
}

/** Reserva um cliente para uma atendente. Falha se outra o mantém ativo (renova se for a mesma). */
export function reservar(clienteScoreId: number, atendente: string): { ok: boolean; ate?: number; por?: string } {
  limpar()
  const atual = reservas.get(clienteScoreId)
  if (atual && atual.atendente !== atendente) return { ok: false, por: atual.atendente }
  const ate = Date.now() + TTL_MS
  reservas.set(clienteScoreId, { atendente, ate })
  return { ok: true, ate }
}

/** Libera a reserva (envio concluído ou atendente desistiu). */
export function liberar(clienteScoreId: number): void {
  reservas.delete(clienteScoreId)
}

/** IDs atualmente reservados — a fila os esconde das demais atendentes. */
export function idsReservados(): Set<number> {
  limpar()
  return new Set(reservas.keys())
}
