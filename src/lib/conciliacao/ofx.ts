// ─── Parser de OFX (extrato bancário) ───────────────────────────────────────────
// OFX (Open Financial Exchange) é o formato que o Itaú/Santander exportam no internet
// banking. É SGML (OFX 1.x) — tags de folha sem fechamento, valor na mesma linha. As
// transações vêm em blocos <STMTTRN>...</STMTTRN>. Parser tolerante a OFX 1.x e 2.x.

export interface OfxTransacao {
  fitid: string      // ID único da transação no banco (chave estável p/ idempotência)
  tipo: string       // CREDIT | DEBIT | PIX | ... (TRNTYPE)
  data: string       // "YYYY-MM-DD" (DTPOSTED)
  valor: number      // positivo = crédito (entrou); negativo = débito (saiu)
  memo: string       // descrição/histórico
  nome: string       // contraparte (NAME), quando houver
}

function tag(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`<${nome}>\\s*([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : ''
}

// "20260917120000[-03:EST]" ou "20260917" → "2026-09-17"
function dtToISO(v: string): string {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

// "150.00", "-50.00" ou "1.234,56" → number
function parseValor(v: string): number {
  let s = v.trim()
  if (!s) return 0
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function parseOFX(conteudo: string): OfxTransacao[] {
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1)
  const out: OfxTransacao[] = []
  for (const b0 of blocos) {
    const bloco = b0.split(/<\/STMTTRN>/i)[0]
    const fitid = tag(bloco, 'FITID')
    if (!fitid) continue
    const data = dtToISO(tag(bloco, 'DTPOSTED'))
    if (!data) continue
    out.push({
      fitid,
      tipo: tag(bloco, 'TRNTYPE').toUpperCase(),
      data,
      valor: parseValor(tag(bloco, 'TRNAMT')),
      memo: tag(bloco, 'MEMO'),
      nome: tag(bloco, 'NAME'),
    })
  }
  return out
}

// Detecta se uma transação é um Pix RECEBIDO (crédito direto na conta).
// ⚠️ ajustar o padrão quando vermos um OFX real do Itaú (o texto do histórico varia).
const RE_PIX = /\bpix\b/i
export function ehPixRecebido(t: OfxTransacao): boolean {
  return t.valor > 0 && (RE_PIX.test(t.memo) || RE_PIX.test(t.nome) || RE_PIX.test(t.tipo))
}
