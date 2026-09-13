import { getUnidadesDisponiveis } from '../belle/unidades-config'
import { calcularScoresUnidade } from './motor'

const INTERVALO_HORAS = 3
let _iniciado = false

async function syncTodas() {
  const slugs = getUnidadesDisponiveis()
  console.log(`[auto-sync] Iniciando sync de ${slugs.length} unidades...`)
  for (const slug of slugs) {
    try {
      const n = await calcularScoresUnidade(slug)
      console.log(`[auto-sync] ${slug}: ${n} clientes`)
    } catch (err) {
      console.error(`[auto-sync] ${slug}: erro —`, err instanceof Error ? err.message : String(err))
    }
  }
  console.log(`[auto-sync] Concluído. Próximo em ${INTERVALO_HORAS}h.`)
}

// Chamado na primeira requisição a qualquer API de inteligência.
// A partir daí roda a cada INTERVALO_HORAS sem depender de ação manual.
export function ensureAutoSync(): void {
  if (_iniciado) return
  _iniciado = true

  // Em produção com cron de sistema (CRON_SECRET definido), o agendador in-process
  // é desativado para não sincronizar em dobro — o cron cuida disso de forma robusta.
  if (process.env.CRON_SECRET) {
    console.log('[auto-sync] desativado — usando cron de sistema externo')
    return
  }

  // Primeiro sync: aguarda 10s de warmup para o servidor subir
  setTimeout(syncTodas, 10_000)

  // Syncs periódicos
  setInterval(syncTodas, INTERVALO_HORAS * 60 * 60 * 1_000)
}
