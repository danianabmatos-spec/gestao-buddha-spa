// Anúncio da bola no grupo de WhatsApp da unidade (mão única: recepção → equipe).
// O ENVIO REAL fica atrás de uma trava (BOLA_WHATSAPP_ATIVO) — enquanto desligado,
// roda em dry-run (só monta e loga a mensagem). Ligado, faz POST em BOLA_WHATSAPP_URL
// = endpoint da Central (POST /v1/integracao/bola, auth x-bola-key=BOLA_WHATSAPP_KEY),
// que posta no grupo interno da unidade via Baileys. O mapa unidade→grupo vive na Central.

export interface AnuncioBola {
  terapeutaNome: string
  clienteNome?: string | null
  servicoNome: string
  duracaoMin: number
  salaNome?: string | null
}

/** Só o primeiro nome do cliente (privacidade no grupo). */
const primeiroNome = (n: string): string => n.trim().split(/\s+/)[0] || n.trim()

/** Monta a mensagem padronizada que o robô posta no grupo. */
export function montarAnuncioBola(a: AnuncioBola): string {
  const partes = [a.terapeutaNome]
  if (a.clienteNome) partes.push(primeiroNome(a.clienteNome))
  partes.push(`${a.servicoNome} (${a.duracaoMin}min)`)
  if (a.salaNome) partes.push(`Sala ${a.salaNome}`)
  return `🔔 Próximo atendimento\n${partes.join(' → ')}`
}

/** Mensagem de CANCELAMENTO de uma bola já anunciada. */
export function montarCancelamentoBola(a: { terapeutaNome: string; clienteNome?: string | null; servicoNome?: string | null }): string {
  const partes = [a.terapeutaNome]
  if (a.clienteNome) partes.push(primeiroNome(a.clienteNome))
  if (a.servicoNome) partes.push(a.servicoNome)
  return `❌ Bola cancelada\n${partes.join(' → ')}`
}

export interface ResultadoEnvio {
  enviado: boolean
  motivo: string
  mensagem: string
}

function ativo(): boolean {
  const v = (process.env.BOLA_WHATSAPP_ATIVO || '').toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

/**
 * Envia o anúncio ao grupo da unidade. Enquanto a trava estiver desligada, apenas
 * loga (dry-run) e retorna enviado=false — nenhum dado sai para o WhatsApp.
 */
export async function enviarAnuncioGrupo(unidadeSlug: string, mensagem: string): Promise<ResultadoEnvio> {
  if (!ativo()) {
    console.log(`[bola][dry-run] WhatsApp ${unidadeSlug} (envio desligado):\n${mensagem}`)
    return { enviado: false, motivo: 'envio desligado (BOLA_WHATSAPP_ATIVO)', mensagem }
  }

  // TODO (quando liberado, fora do período de backup da VPS):
  //   - BOLA_WHATSAPP_URL: endpoint do servidor whatsapp-web.js
  //   - group id por unidade (ex.: BOLA_WHATSAPP_GRUPO_<slug> ou tabela de config)
  //   - fetch POST { grupo, texto: mensagem } com timeout curto e retry leve
  const url = process.env.BOLA_WHATSAPP_URL
  if (!url) {
    return { enviado: false, motivo: 'BOLA_WHATSAPP_URL não configurada', mensagem }
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bola-key': process.env.BOLA_WHATSAPP_KEY || '' },
      body: JSON.stringify({ unidade: unidadeSlug, texto: mensagem }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) return { enviado: false, motivo: `servidor WhatsApp respondeu ${resp.status}`, mensagem }
    return { enviado: true, motivo: 'ok', mensagem }
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : 'falha no envio', mensagem }
  }
}
