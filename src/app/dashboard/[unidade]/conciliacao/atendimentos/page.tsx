'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, ChevronLeft, ChevronRight, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUnidadeNome } from '@/lib/belle/unidades-config'
import { DescontosCortesias, type ResumoDC } from '@/components/conciliacao/descontos-cortesias'

// ─── Tipos ──────────────────────────────────────────────────────────────────────
interface Problema {
  id: number; data: string; horario: string | null; clienteNome: string; servico: string | null
  tempo: number | null; profissional: string | null; classificacao: string; valor: number
  justificado: boolean; origemDesconto: string | null; divergenciaId: number | null; divergenciaStatus: string | null
  justificativa: string | null; sugestao: string | null; motivoAuto: string | null; tratadaPorNome: string | null
}
interface Resumo {
  total: number; justificados: number; sinalizados: number; valorAberto: number
  porClassificacao: Record<string, number>; divergenciasAbertas: number
}
interface Dados { ano: number; mes: number; resumo: Resumo; problemas: Problema[] }

const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Categorias (ordem + cor da paleta Buddha). Justificadas → tons orgânicos; ação → marsala/terra.
const CATS: { key: string; label: string; color: string; ok: boolean }[] = [
  { key: 'FINANCEIRO', label: 'Pago', color: '#425F1D', ok: true },
  { key: 'PLANO', label: 'Plano/Pacote', color: '#6E8E4E', ok: true },
  { key: 'VOUCHER', label: 'Voucher', color: '#D78B18', ok: true },
  { key: 'PARCERIA', label: 'Parceria', color: '#C0A062', ok: true },
  { key: 'CORTESIA_COLABORADOR', label: 'Cortesia colaborador', color: '#8FA96B', ok: true },
  { key: 'CORTESIA_PROPRIETARIO', label: 'Cortesia proprietário', color: '#6E8E4E', ok: true },
  { key: 'CORTESIA', label: 'Cortesia p/ rever', color: '#7E0000', ok: false },
  { key: 'DESCONTO', label: 'Desconto p/ rever', color: '#A63A3A', ok: false },
  { key: 'SEM_JUSTIFICATIVA', label: 'Sem justificativa', color: '#3A1010', ok: false },
]
const CLASS_LABEL: Record<string, string> = {
  SEM_JUSTIFICATIVA: 'Sem justificativa',
  CORTESIA: 'Cortesia sem autorização',
  CORTESIA_COLABORADOR: 'Cortesia de colaborador acima do direito',
  CORTESIA_PROPRIETARIO: 'Cortesia de proprietário(a)',
  DESCONTO: 'Desconto discricionário',
}

function hoje() {
  const s = new Date().toLocaleDateString('en-CA')
  return { ano: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)) }
}
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export default function AtendimentosPage() {
  const params = useParams()
  const unidadeSlug = params.unidade as string

  const [ano, setAno] = useState(hoje().ano)
  const [mes, setMes] = useState(hoje().mes)
  const [resumo, setResumo] = useState<ResumoDC | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const sincronizar = async () => {
    setSincronizando(true); setErro(null)
    try {
      const ultimo = new Date(ano, mes, 0).getDate()
      const dataIni = `${ano}-${String(mes).padStart(2, '0')}-01`
      const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
      const r = await fetch('/api/conciliacao/sincronizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade: unidadeSlug, dataIni, dataFim }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro ao sincronizar'); return }
      setReloadKey((n) => n + 1)
    } catch { setErro('Falha ao sincronizar') } finally { setSincronizando(false) }
  }

  const mudarMes = (delta: number) => {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }
    setMes(m); setAno(a)
  }

  const totalBar = resumo?.total || 1

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-1">
        <Link href={`/dashboard/${unidadeSlug}/conciliacao`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Conciliação financeira
        </Link>
        <Button variant="outline" size="sm" onClick={sincronizar} disabled={sincronizando}>
          <RefreshCw className={`w-4 h-4 mr-1 ${sincronizando ? 'animate-spin' : ''}`} /> Sincronizar mês
        </Button>
      </div>
      <h1 className="text-xl md:text-2xl font-semibold text-[#7E0000]">Conciliação de Atendimentos</h1>
      <p className="text-sm text-muted-foreground mb-4">{getUnidadeNome(unidadeSlug)} — todo atendimento realizado precisa de uma justificativa</p>

      {/* Navegação de mês */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="font-medium min-w-[9rem] text-center">{MESES[mes]} {ano}</span>
        <Button variant="ghost" size="icon" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {erro && <div className="mb-4 rounded-md bg-[#7E0000]/10 text-[#7E0000] px-3 py-2 text-sm">{erro}</div>}

      {resumo && (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Card titulo="Atendimentos" valor={String(resumo.total)} />
            <Card titulo="Justificados" valor={String(resumo.justificados)} cor="#425F1D" icone={<CheckCircle2 className="w-4 h-4" />} />
            <Card titulo="A revisar" valor={String(resumo.sinalizados)} cor="#7E0000" icone={<AlertTriangle className="w-4 h-4" />} />
            <Card titulo="Valor em aberto" valor={brl(resumo.valorAberto)} cor="#7E0000" />
          </div>

          {/* Barra de categorias */}
          <div className="mb-2 flex h-4 w-full overflow-hidden rounded-full bg-muted">
            {CATS.map((c) => {
              const n = resumo.porClassificacao[c.key] || 0
              if (!n) return null
              return <div key={c.key} style={{ width: `${(n / totalBar) * 100}%`, backgroundColor: c.color }} title={`${c.label}: ${n}`} />
            })}
          </div>
          <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {CATS.map((c) => {
              const n = resumo.porClassificacao[c.key] || 0
              if (!n) return null
              return (
                <span key={c.key} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  {c.label} <b>{n}</b>
                </span>
              )
            })}
          </div>

        </>
      )}

      {/* Lista de descontos e cortesias (componente compartilhado, com justificativa + aprovação) */}
      <DescontosCortesias unidadeSlug={unidadeSlug} ano={ano} mes={mes} reloadKey={reloadKey} onResumo={setResumo} />
    </div>
  )
}

function Card({ titulo, valor, cor, icone }: { titulo: string; valor: string; cor?: string; icone?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1" style={{ color: cor }}>{icone}{titulo}</div>
      <div className="text-lg font-semibold" style={{ color: cor }}>{valor}</div>
    </div>
  )
}
