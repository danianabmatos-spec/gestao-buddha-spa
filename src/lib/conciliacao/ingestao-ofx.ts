import { parseOFX, ehPixRecebido } from '@/lib/conciliacao/ofx'
import { salvarFontesExternas, type TransacaoExterna } from '@/lib/conciliacao/fontes-externas'

// ─── Ingestão de extrato OFX → conciliação de Pix ────────────────────────────────
// Lê o OFX exportado do banco (Itaú/Santander), separa os Pix RECEBIDOS (crédito),
// grava como FonteExterna BANCO_PIX e dispara a conciliação mão-dupla contra os "PIX"
// do Belle (conciliarPixDia dentro de conciliarDia). Idempotente por FITID.

export interface ResultadoOFX {
  unidadeSlug: string
  lidas: number        // total de transações no arquivo
  pixRecebidos: number // Pix (crédito) detectados
  gravadas: number     // fontes externas gravadas
  dias: string[]
  periodo: { de: string; ate: string } | null
}

export async function ingerirOFX(unidadeSlug: string, conteudoOFX: string): Promise<ResultadoOFX> {
  const txns = parseOFX(conteudoOFX)
  const pix = txns.filter(ehPixRecebido)

  const registros: TransacaoExterna[] = pix.map((t) => ({
    origem: 'BANCO_PIX',
    refExterna: t.fitid,
    data: t.data,
    valor: Number(t.valor.toFixed(2)),
    formaPagamento: 'Pix - Banco',
    descricao: (t.nome || t.memo || '').slice(0, 200) || null,
    raw: t,
  }))

  const res = await salvarFontesExternas(unidadeSlug, registros)

  const datas = pix.map((t) => t.data).sort()
  return {
    unidadeSlug,
    lidas: txns.length,
    pixRecebidos: pix.length,
    gravadas: res.gravadas,
    dias: res.dias,
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
  }
}
