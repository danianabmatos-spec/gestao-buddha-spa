import { prisma } from '@/lib/prisma'
import { getUnidadeCredenciais } from '@/lib/belle/unidades-config'
import { getVouchersUsados, filtrarVouchersEcommerce } from '@/lib/belle/relatorio-vouchers'
import { getVoucherCacheFlexivel } from '@/lib/cache-vouchers'
import { conciliarVouchersUnidade } from '@/lib/conciliacao/motor'

// ─── F3 · Ingestão de Vouchers do site ──────────────────────────────────────────
// USADO  = Belle Report 2422 (getVouchersUsados) → MovimentacaoBelle forma 'Voucher'
// VALIDADO = cache do WordPress (getVoucherCacheFlexivel, alimentado pelo sync manual)
//           → FonteExterna VOUCHER_SITE
// A conciliação casa por CÓDIGO: usado sem validação = reembolso em risco (SEM_VALIDACAO).

interface VoucherWP { codigo?: string; dataTerapia?: string; dataVenda?: string; valorReembolso?: number; produto?: string }

// Extrai o ID do cliente de "14574000 - Nathalia…" (Report 2422 col Cliente).
function parseClienteId(cli: string | undefined | null): string | null {
  const m = String(cli ?? '').match(/^(\d+)\s*-/)
  return m ? m[1] : null
}

// Normaliza "2026-06-01T…" ou "01/06/2026" → "YYYY-MM-DD".
function toISO(s: string | undefined | null): string {
  const t = String(s ?? '').trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

export interface ResultadoVouchers {
  unidadeSlug: string
  usados: number
  validados: number
  dias: number
}

export async function ingerirVouchers(
  unidadeSlug: string, dataIniISO: string, dataFimISO: string,
): Promise<ResultadoVouchers> {
  const cred = getUnidadeCredenciais(unidadeSlug)
  if (!cred) throw new Error(`Unidade sem credenciais: ${unidadeSlug}`)
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
  if (!unidade) throw new Error(`Unidade não encontrada: ${unidadeSlug}`)
  const unidadeId = unidade.id
  const dias = new Set<string>()

  // ── USADOS (Belle Report 2422) → MovimentacaoBelle forma 'Voucher' ──
  // SÓ vouchers do SITE. O "Tipo" do Belle sozinho NÃO basta (ele marca vouchers
  // internos/omnichannel como "E-commerce"). Dois critérios, ambos verificados nos
  // 486 códigos reais do WordPress:
  //   1) Tipo = "E-commerce" → exclui os "Normal" (vouchers da própria unidade);
  //      todo voucher do site é E-commerce (nenhum código do WP veio como "Normal").
  //   2) código ALFANUMÉRICO (tem letra) → exclui internos/omnichannel, que têm código
  //      só-números (ex.: 1055259859..., 1511779...) e NUNCA estão no WordPress
  //      (todos os 486 códigos do WP têm letra). Voucher da unidade não entra.
  const usados = await getVouchersUsados(cred.email, cred.password, dataIniISO, dataFimISO, cred.estab)
  const ecom = filtrarVouchersEcommerce(usados, dataIniISO, dataFimISO)
    .filter((v) => v.tipo === 'E-commerce')
    .filter((v) => /[A-Za-z]/.test(v.codigoVoucher ?? ''))
  let gravadosUsados = 0
  for (const v of ecom) {
    const data = toISO(v.dataExecucao)
    if (!data || !v.idVenda) continue
    const codigo = v.codigoVoucher ? v.codigoVoucher.toUpperCase().trim() : null
    dias.add(data)
    await prisma.movimentacaoBelle.upsert({
      where: { unidadeId_belleMovId: { unidadeId, belleMovId: `VCH-${v.idVenda}` } },
      create: {
        unidadeId, belleMovId: `VCH-${v.idVenda}`, vendaRef: codigo, data,
        clienteNome: v.cliente || '', clienteId: parseClienteId(v.cliente),
        servico: v.descricao || null, tipoVenda: 'Voucher - Usado',
        formaPagamento: 'Voucher', valorBruto: v.valorFinal || 0, valorLiquido: v.valorFinal || 0,
        statusConcil: 'PENDENTE',
      },
      update: {
        vendaRef: codigo, data, clienteNome: v.cliente || '', clienteId: parseClienteId(v.cliente),
        servico: v.descricao || null, valorBruto: v.valorFinal || 0, valorLiquido: v.valorFinal || 0,
      },
    })
    gravadosUsados++
  }

  // ── VALIDADOS (cache WordPress, do sync manual) → FonteExterna VOUCHER_SITE ──
  const cacheWP = getVoucherCacheFlexivel(dataIniISO, dataFimISO)
  let gravadosValidados = 0
  const vouchersWP = (cacheWP?.vouchers ?? []) as VoucherWP[]
  for (const w of vouchersWP) {
    const codigo = w.codigo ? w.codigo.toUpperCase().trim() : null
    const data = toISO(w.dataTerapia || w.dataVenda)
    if (!codigo || !data) continue
    dias.add(data)
    await prisma.fonteExterna.upsert({
      where: { unidadeId_origem_refExterna: { unidadeId, origem: 'VOUCHER_SITE', refExterna: codigo } },
      create: {
        unidadeId, origem: 'VOUCHER_SITE', refExterna: codigo, data,
        valor: Number(w.valorReembolso) || 0, formaPagamento: 'Voucher - Site',
        descricao: w.produto || null, raw: JSON.stringify(w),
      },
      update: {
        data, valor: Number(w.valorReembolso) || 0, formaPagamento: 'Voucher - Site',
        descricao: w.produto || null, raw: JSON.stringify(w),
      },
    })
    gravadosValidados++
  }

  // Voucher casa por código na unidade inteira (cross-mês), não por dia.
  await conciliarVouchersUnidade(unidadeId)

  return { unidadeSlug, usados: gravadosUsados, validados: gravadosValidados, dias: dias.size }
}
