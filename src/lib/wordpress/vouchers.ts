export interface Voucher {
  codigo: string
  produto: string
  dataTerapia: string   // Data da Utilização
  dataVenda?: string
  statusVoucher?: string
  status: 'Validado' | 'Utilizado' | 'Pendente' | 'Cancelado' | string
  formaValidacao?: 'Automatico' | 'Manualmente' | 'Pendente' | string
  valorReembolso: number
  valor?: string        // valor formatado "R$ 154,00"
  unidade?: string
}

export interface VouchersResumo {
  periodo: { ini: string; fim: string }
  totalReembolso: number
  totalValor?: number
  totalValidados: number
  pendentesValidacao: number
  validacaoManual: number
  validacaoAutomatica: number
  vouchers: Voucher[]
}

function parseMoeda(txt: string): number {
  if (!txt) return 0
  return parseFloat(txt.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

export function parseVouchersHTML(html: string, dataIni: string, dataFim: string): VouchersResumo {
  // Extrai total de reembolso do card de resumo
  const totalMatch = html.match(/<span>R\$\s*([\d.,]+)<\/span><\/h5>\s*<div[^>]*>Reembolso/)
    ?? html.match(/R\$\s*([\d.,]+)\s*<\/div>\s*[\s\S]{0,100}Reembolso/)
  const totalReembolso = parseMoeda(totalMatch?.[1] ?? '0')

  // Extrai linhas da tabela de vouchers (novo formato com data-colname)
  // Busca especificamente o tbody com id="the-list" que contém os vouchers
  const vouchers: Voucher[] = []
  const tbodyMatch = html.match(/<tbody[^>]*id=["']the-list["'][^>]*>([\s\S]*?)<\/tbody>/)
  if (tbodyMatch) {
    const rows = tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)
    for (const row of rows) {
      // Extrai células com data-colname
      const tdMatches = row[1].matchAll(/<td[^>]*data-colname=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/g)
      const cellMap = new Map<string, string>()

      for (const match of tdMatches) {
        const colName = match[1].toLowerCase().trim()
        const content = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
        cellMap.set(colName, content)
      }

      if (cellMap.size >= 6) {
        const produto = cellMap.get('nome') ?? ''
        const dataVenda = cellMap.get('data da venda') ?? ''
        const dataTerapia = cellMap.get('data da utilização') ?? cellMap.get('data de utilização') ?? ''
        const unidade = cellMap.get('unidade') ?? ''
        const valorStr = cellMap.get('valor de reembolso') ?? ''
        const codigo = cellMap.get('código') ?? ''
        const statusVoucher = cellMap.get('status') ?? ''

        vouchers.push({
          codigo,
          produto: produto.replace('Mostrar mais detalhes', '').trim(),
          dataTerapia,
          dataVenda,
          statusVoucher,
          status: statusVoucher.includes('Utilizado') ? 'Utilizado' : (statusVoucher.includes('Validado') ? 'Validado' : 'Pendente'),
          formaValidacao: 'Automatico', // WordPress não diferencia
          valorReembolso: parseMoeda(valorStr),
          unidade,
        })
      }
    }
  }

  // NÃO filtra aqui - salva TODOS os vouchers no cache
  // O filtro será aplicado na camada de Belle quando cruza com WP
  const validados       = vouchers.filter(v => v.status === 'Validado' || v.status === 'Utilizado')
  const pendentes       = vouchers.filter(v => v.status === 'Pendente' || v.status === '')
  const automaticos     = validados.filter(v => v.formaValidacao === 'Automatico')
  const manuais         = validados.filter(v => v.formaValidacao === 'Manualmente')

  // Se não conseguiu o total do HTML, soma da tabela
  const totalCalculado = validados.reduce((acc, v) => acc + v.valorReembolso, 0)

  return {
    periodo: { ini: dataIni, fim: dataFim },
    totalReembolso: totalReembolso || totalCalculado,
    totalValidados: validados.length,
    pendentesValidacao: pendentes.length,
    validacaoManual: manuais.length,
    validacaoAutomatica: automaticos.length,
    vouchers,
  }
}

// Parser específico para cortesias (valorReembolso = 0)
export function parseVouchersCortesia(html: string, dataIni: string, dataFim: string): VouchersResumo & { totalValor: number } {
  const resultado = parseVouchersHTML(html, dataIni, dataFim)

  // Filtra apenas vouchers com valorReembolso = 0 (cortesias)
  const vouchersCortesia = resultado.vouchers.filter(v => v.valorReembolso === 0)

  // Para cortesias, precisamos extrair o valor original do produto
  // Por enquanto, vamos somar os valores que aparecem no nome do produto
  let totalValor = 0
  for (const v of vouchersCortesia) {
    // Tenta extrair valor do nome do produto (ex: "Vale Bem-Estar - R$ 150")
    const valorMatch = v.produto.match(/R\$\s*([\d.,]+)/)
    if (valorMatch) {
      totalValor += parseMoeda(valorMatch[1])
    }
  }

  return {
    periodo: resultado.periodo,
    totalReembolso: 0, // Cortesias não têm reembolso
    totalValor,
    totalValidados: vouchersCortesia.filter(v => v.status === 'Validado' || v.status === 'Utilizado').length,
    pendentesValidacao: vouchersCortesia.filter(v => v.status === 'Pendente').length,
    validacaoManual: vouchersCortesia.filter(v => v.formaValidacao === 'Manualmente').length,
    validacaoAutomatica: vouchersCortesia.filter(v => v.formaValidacao === 'Automatico').length,
    vouchers: vouchersCortesia,
  }
}

// Mantido para compatibilidade futura (quando o auth WP for resolvido)
export async function getVouchers(_dataIni: string, _dataFim: string): Promise<VouchersResumo> {
  throw new Error('Autenticação WP requer sessão de browser. Use /api/vouchers/sync via browser relay.')
}
