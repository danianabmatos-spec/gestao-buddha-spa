// ─── Plano de envio: teto diário (com aquecimento) + alocação por prioridade ────
// Objetivo: distribuir as mensagens ao longo do mês sem estourar o WhatsApp.

// Teto diário por dias úteis desde o 1º envio da unidade: aquece 20 → 30 → 40.
export function tetoDiario(diasUteisDesdePrimeiroEnvio: number): number {
  if (diasUteisDesdePrimeiroEnvio < 5) return 20
  if (diasUteisDesdePrimeiroEnvio < 10) return 30
  return 40
}

// Conta dias úteis (seg–sex) entre duas datas (inclusive início, exclusivo fim).
export function diasUteisEntre(inicio: Date, fim: Date): number {
  const a = new Date(inicio); a.setHours(0, 0, 0, 0)
  const b = new Date(fim); b.setHours(0, 0, 0, 0)
  let dias = 0
  for (const d = new Date(a); d < b; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) dias++
  }
  return dias
}

export function ehFimDeSemana(d = new Date()): boolean {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

// Prioridade de envio (ordem em que a cota do dia é preenchida) + limite por cluster/dia.
// key = statusPacote / statusFrequencia / TP0 / TP1.  tab = para onde a fila leva.
export interface ItemPrioridade {
  key: string
  grupo: 'pacote' | 'freq' | 'totalpass'
  label: string
  limite: number   // máx. desse cluster por dia (urgentes = alto)
  destino: 'fila' | 'totalpass'
}

export const PRIORIDADE_ENVIO: ItemPrioridade[] = [
  // Topo, todo dia — urgentes por prazo + pacote ativo (convite p/ agendar)
  { key: 'VENCIDO_ATE30',       grupo: 'pacote',    label: 'Vencido ≤30 (uso grátis)',   limite: 99, destino: 'fila' },
  { key: 'A_VENCER',            grupo: 'pacote',    label: 'A Vencer',                    limite: 99, destino: 'fila' },
  { key: 'FINALIZADO_30',       grupo: 'pacote',    label: 'Finalizado ≤30',              limite: 99, destino: 'fila' },
  { key: 'ATIVO',               grupo: 'pacote',    label: 'Pacote ativo (agendar)',      limite: 15, destino: 'fila' },
  // TotalPass — no início do mês; re-lembrete natural ~3 semanas depois (regra dos 20 dias)
  { key: 'TP0',                 grupo: 'totalpass', label: 'TotalPass — agendar as 2',    limite: 20, destino: 'totalpass' },
  { key: 'TP1',                 grupo: 'totalpass', label: 'TotalPass — agendar a 2ª',    limite: 20, destino: 'totalpass' },
  // Recuperação e valor
  { key: 'EM_RISCO',            grupo: 'freq',      label: 'Em Risco',                    limite: 12, destino: 'fila' },
  { key: 'VENCIDO_MAIS30',      grupo: 'pacote',    label: 'Vencido +30 (reativar 20%)',  limite: 99, destino: 'fila' },
  { key: 'FINALIZADO_90',       grupo: 'pacote',    label: 'Finalizado ≤90',              limite: 10, destino: 'fila' },
  { key: 'FREQUENTE_SEM_PACOTE',grupo: 'freq',      label: 'Frequente sem pacote',        limite: 8,  destino: 'fila' },
  // Reativação de longo prazo (preenche a cota restante)
  { key: 'FINALIZADO_180',      grupo: 'pacote',    label: 'Finalizado ≤180',             limite: 6,  destino: 'fila' },
  { key: 'FINALIZADO_PLUS',     grupo: 'pacote',    label: 'Finalizado +180',             limite: 6,  destino: 'fila' },
  { key: 'PERDIDO',             grupo: 'freq',      label: 'Perdido (reativação)',        limite: 15, destino: 'fila' },
  { key: 'NOVO',                grupo: 'freq',      label: 'Novos (boas-vindas)',         limite: 8,  destino: 'fila' },
]

export interface ItemPlano extends ItemPrioridade {
  pendentes: number
  aFazer: number
}

// Aloca a cota restante do dia entre os clusters, na ordem de prioridade.
export function montarPlano(
  pendentes: Record<string, number>,
  cap: number,
  enviadasHoje: number,
): { itens: ItemPlano[]; totalAFazer: number; restante: number } {
  let restante = Math.max(0, cap - enviadasHoje)
  const itens: ItemPlano[] = []
  for (const p of PRIORIDADE_ENVIO) {
    if (restante <= 0) break
    const pend = pendentes[p.key] ?? 0
    if (pend <= 0) continue
    const aFazer = Math.min(pend, p.limite, restante)
    if (aFazer > 0) {
      itens.push({ ...p, pendentes: pend, aFazer })
      restante -= aFazer
    }
  }
  const totalAFazer = itens.reduce((s, i) => s + i.aFazer, 0)
  return { itens, totalAFazer, restante }
}
