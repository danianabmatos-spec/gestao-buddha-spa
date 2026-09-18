import { prisma } from '@/lib/prisma'
import { conciliarDia } from '@/lib/conciliacao/motor'

// ─── F3 · Fontes externas (casca genérica) ──────────────────────────────────────
// Ponto único de entrada pra transações reais vindas de fora do Belle (operadora de
// cartão, banco/Pix, parceiros). Cada conector específico (Rede/Getnet/Stone, Itaú/
// Santander, TotalPass/Gympass) puxa os dados da sua API, normaliza pra este formato
// e chama salvarFontesExternas(). Depois disso a conciliação do dia roda automática.

export type OrigemFonte =
  | 'OPERADORA_CARTAO'
  | 'BANCO_PIX'
  | 'CAIXA_DINHEIRO'
  | 'TOTALPASS'
  | 'GYMPASS'
  | 'VOUCHER_SITE'

// Transação externa normalizada (o "idioma comum" que todo conector entrega).
export interface TransacaoExterna {
  origem: OrigemFonte
  refExterna: string          // NSU / id da transação / id do check-in (chave estável)
  data: string                // "YYYY-MM-DD" (data da venda)
  dataHora?: Date | null
  valor: number               // valor BRUTO da venda (o que casa com o Belle)
  formaPagamento?: string | null  // bandeira / tipo / adquirente
  descricao?: string | null
  raw?: unknown               // payload cru da fonte (auditoria)
}

export interface ResultadoFontes {
  unidadeSlug: string
  gravadas: number
  dias: string[]
}

/**
 * Grava (upsert idempotente por origem+refExterna) as transações externas de uma
 * unidade e reconcilia os dias afetados. Retorna o que foi gravado.
 */
export async function salvarFontesExternas(
  unidadeSlug: string,
  registros: TransacaoExterna[],
): Promise<ResultadoFontes> {
  const unidade = await prisma.unidade.findUnique({ where: { slug: unidadeSlug } })
  if (!unidade) throw new Error(`Unidade não encontrada: ${unidadeSlug}`)
  const unidadeId = unidade.id

  const dias = new Set<string>()
  for (const t of registros) {
    if (!t.refExterna || !t.data) continue
    dias.add(t.data)
    await prisma.fonteExterna.upsert({
      where: { unidadeId_origem_refExterna: { unidadeId, origem: t.origem, refExterna: t.refExterna } },
      create: {
        unidadeId, origem: t.origem, refExterna: t.refExterna, data: t.data,
        dataHora: t.dataHora ?? null, valor: t.valor, formaPagamento: t.formaPagamento ?? null,
        descricao: t.descricao ?? null, raw: t.raw != null ? JSON.stringify(t.raw) : null,
      },
      update: {
        data: t.data, dataHora: t.dataHora ?? null, valor: t.valor,
        formaPagamento: t.formaPagamento ?? null, descricao: t.descricao ?? null,
        raw: t.raw != null ? JSON.stringify(t.raw) : null,
      },
    })
  }

  for (const data of dias) {
    await conciliarDia(unidadeId, data)
  }

  return { unidadeSlug, gravadas: registros.length, dias: [...dias] }
}

// ─── Conectores de operadora de cartão (a implementar quando os acessos chegarem) ──
// Cada adquirente vira um ConectorCartao: recebe as credenciais da unidade + período,
// chama a API da operadora, e devolve as transações no formato TransacaoExterna.
export interface ConectorCartao {
  nome: string  // 'Rede' | 'Getnet' | 'Stone'
  buscar(cred: Record<string, string>, dataIniISO: string, dataFimISO: string): Promise<TransacaoExterna[]>
}

// Registro dos conectores por adquirente. Vazio por enquanto — plugar Rede/Getnet/Stone
// aqui assim que as credenciais de API forem liberadas (ver mapa por unidade).
export const CONECTORES_CARTAO: Record<string, ConectorCartao> = {
  // rede: new ConectorRede(),      // TODO F3: quando o acesso da Rede chegar
  // getnet: new ConectorGetnet(),  // TODO F3: Higienópolis
  // stone: new ConectorStone(),    // TODO F3: Anália, Shop Anália, Perdizes, Mooca
}
