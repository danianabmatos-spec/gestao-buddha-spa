// ─── METAS ANUAIS 2026 — Shopping Metrópole ────────────────────────────────
// Fonte: planilha "meta faturamento metropole.jpeg"

export const METAS_ANUAIS_2026: Record<number, { faturamento: number; horas: number; vendas: number }> = {
  6:  { faturamento: 90000,  horas: 600, vendas: 60000 },
  7:  { faturamento: 90000,  horas: 600, vendas: 60000 },
  8:  { faturamento: 95000,  horas: 650, vendas: 60000 },
  9:  { faturamento: 95000,  horas: 650, vendas: 60000 },
  10: { faturamento: 100000, horas: 650, vendas: 60000 },
  11: { faturamento: 120000, horas: 700, vendas: 60000 },
  12: { faturamento: 150000, horas: 700, vendas: 60000 },
}

export function getMetaMes(mes: number) {
  return METAS_ANUAIS_2026[mes] ?? { faturamento: 90000, horas: 600, vendas: 60000 }
}

// ─── BONIFICAÇÃO COORDENADORA ──────────────────────────────────────────────
// Fonte: planilha "remuneração meta metropole.jpeg"
// Remuneração fixa (PJ): R$ 3.000
// Variável máximo: R$ 3.000 (faturamento R$1.800 + horas R$1.200)
// Total possível: R$ 6.000

export const FIXO_COORDENADORA = 3000

export interface FaixaBonificacao {
  minPct: number   // inclusive
  maxPct: number   // inclusive (use Infinity para sem limite superior)
  label: string
  valor: number
}

export const BONIF_COORD_FATURAMENTO: FaixaBonificacao[] = [
  { minPct: 0,   maxPct: 89,       label: '< 90%',    valor: 0     },
  { minPct: 90,  maxPct: 99,       label: '90–99%',   valor: 900   },
  { minPct: 100, maxPct: 109,      label: '100–109%', valor: 1260  },
  { minPct: 110, maxPct: 119,      label: '110–119%', valor: 1530  },
  { minPct: 120, maxPct: Infinity, label: '≥ 120%',   valor: 1800  },
]

export const BONIF_COORD_HORAS: FaixaBonificacao[] = [
  { minPct: 0,   maxPct: 89,       label: '< 90%',    valor: 0    },
  { minPct: 90,  maxPct: 99,       label: '90–99%',   valor: 600  },
  { minPct: 100, maxPct: 109,      label: '100–109%', valor: 840  },
  { minPct: 110, maxPct: 119,      label: '110–119%', valor: 1020 },
  { minPct: 120, maxPct: Infinity, label: '≥ 120%',   valor: 1200 },
]

// ─── BONIFICAÇÃO RECEPÇÃO ──────────────────────────────────────────────────
// Fonte: planilha "meta recepção metropole.jpeg"
// Baseada em vendas extraordinárias (planos, vouchers, produtos)
// Proporcional aos dias trabalhados no mês

export interface FaixaRecepcao {
  minPct: number
  maxPct: number
  label: string
  vendasDe: number | null
  vendasAte: number | null
  cargos: Record<string, number>
}

// Fonte: planilha "meta recepção metropole.jpeg" (tabela completa)
export const FAIXAS_RECEPCAO: FaixaRecepcao[] = [
  { minPct: 0,   maxPct: 70,       label: '0–70%',    vendasDe: null,  vendasAte: 42000, cargos: { assistente: 0, esp_junior: 0,    esp_pleno: 0,    esp_senior: 0    } },
  { minPct: 71,  maxPct: 85,       label: '71–85%',   vendasDe: 42001, vendasAte: 51000, cargos: { assistente: 0, esp_junior: 175,  esp_pleno: 252,  esp_senior: 321  } },
  { minPct: 86,  maxPct: 99,       label: '86–99%',   vendasDe: 51001, vendasAte: 59999, cargos: { assistente: 0, esp_junior: 350,  esp_pleno: 504,  esp_senior: 643  } },
  { minPct: 100, maxPct: 110,      label: '100–110%', vendasDe: 60000, vendasAte: 66000, cargos: { assistente: 0, esp_junior: 583,  esp_pleno: 840,  esp_senior: 1072 } },
  { minPct: 111, maxPct: 120,      label: '111–120%', vendasDe: 66001, vendasAte: 72000, cargos: { assistente: 0, esp_junior: 874,  esp_pleno: 1260, esp_senior: 1607 } },
  { minPct: 121, maxPct: Infinity, label: '+120%',    vendasDe: 72001, vendasAte: null,  cargos: { assistente: 0, esp_junior: 1166, esp_pleno: 1680, esp_senior: 2143 } },
]

export const CARGOS_RECEPCAO: Record<string, string> = {
  assistente:  'Assistente',
  esp_junior:  'Espec. Junior',
  esp_pleno:   'Espec. Pleno',
  esp_senior:  'Espec. Sênior',
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

export function getFaixaCoord(faixas: FaixaBonificacao[], pct: number): FaixaBonificacao {
  return faixas.find(f => pct >= f.minPct && pct <= f.maxPct) ?? faixas[0]
}

export function getFaixaRecepcao(pct: number): FaixaRecepcao {
  return FAIXAS_RECEPCAO.find(f => pct >= f.minPct && pct <= f.maxPct) ?? FAIXAS_RECEPCAO[0]
}

export function calcPct(atual: number, meta: number): number {
  if (meta <= 0) return 0
  return Math.round((atual / meta) * 100)
}
