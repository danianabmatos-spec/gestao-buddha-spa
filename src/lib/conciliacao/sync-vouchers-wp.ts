import { prisma } from '@/lib/prisma'
import { scrapeVouchersWP } from '@/lib/wordpress/wp-scraper'
import { parseVouchersHTML, type Voucher } from '@/lib/wordpress/vouchers'
import { conciliarVouchersUnidade } from '@/lib/conciliacao/motor'

// ─── F3 · Sync AUTÔNOMO dos vouchers validados do WordPress ──────────────────────
// Usa o FlareSolverr (vence o Cloudflare) + login (captcha Jetpack) pra raspar a
// página de vouchers da unidade e gravar os validados em FonteExterna (VOUCHER_SITE).
// Depois reconcilia os dias tocados. É a "estrutura do Navvii", nossa e autônoma.

function toISO(s: string | undefined | null): string {
  const t = String(s ?? '').trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

export interface ResultadoSyncWP { unidadeSlug: string; validados: number; dias: number }

export async function sincronizarVouchersWP(
  unidadeSlug: string, dataIni: string, dataFim: string,
): Promise<ResultadoSyncWP> {
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
  if (!unidade) throw new Error(`Unidade não encontrada: ${unidadeSlug}`)
  const unidadeId = unidade.id

  const html = await scrapeVouchersWP(unidadeSlug, dataIni, dataFim)
  const parsed = parseVouchersHTML(html, dataIni, dataFim)
  const vouchers = parsed.vouchers as Voucher[]

  const dias = new Set<string>()
  let gravados = 0
  for (const v of vouchers) {
    const codigo = v.codigo ? v.codigo.toUpperCase().trim() : ''
    const data = toISO(v.dataTerapia || v.dataVenda)
    if (!codigo || !data) continue
    dias.add(data)
    await prisma.fonteExterna.upsert({
      where: { unidadeId_origem_refExterna: { unidadeId, origem: 'VOUCHER_SITE', refExterna: codigo } },
      create: {
        unidadeId, origem: 'VOUCHER_SITE', refExterna: codigo, data,
        valor: Number(v.valorReembolso) || 0, formaPagamento: 'Voucher',
        descricao: v.produto || null, raw: JSON.stringify(v),
      },
      update: {
        data, valor: Number(v.valorReembolso) || 0, formaPagamento: 'Voucher',
        descricao: v.produto || null, raw: JSON.stringify(v),
      },
    })
    gravados++
  }

  // Voucher casa por código na unidade inteira (cross-mês), não por dia.
  await conciliarVouchersUnidade(unidadeId)
  return { unidadeSlug, validados: gravados, dias: dias.size }
}
