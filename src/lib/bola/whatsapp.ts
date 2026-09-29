// Anúncio da bola no grupo de WhatsApp da unidade (mão única: recepção → equipe).
// O ENVIO REAL fica atrás de uma trava (BOLA_WHATSAPP_ATIVO) — enquanto desligado,
// roda em dry-run (só monta e loga a mensagem). Ligar = conectar ao servidor
// WhatsApp (whatsapp-web.js na VPS) + configurar o group id de cada unidade.

export interface AnuncioBola {
  terapeutaNome: string
  clienteNome?: string | null
  servicoNome: string
  duracaoMin: number
  salaNome?: string | null
}

/** Monta a mensagem padronizada que o robô posta no grupo. */
export function montarAnuncioBola(a: AnuncioBola): string {
  const partes = [a.terapeutaNome]
  if (a.clienteNome) partes.push(a.clienteNome)
  partes.push(`${a.servicoNome} (${a.duracaoMin}min)`)
  if (a.salaNome) partes.push(`Sala ${a.salaNome}`)
  return `🔔 Próximo atendimento\n${partes.join(' → ')}`
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: unidadeSlug, texto: mensagem }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) return { enviado: false, motivo: `servidor WhatsApp respondeu ${resp.status}`, mensagem }
    return { enviado: true, motivo: 'ok', mensagem }
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : 'falha no envio', mensagem }
  }
}
