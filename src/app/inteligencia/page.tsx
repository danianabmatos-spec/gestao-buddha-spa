'use client'

import { useState, useEffect, useCallback } from 'react'
import { gerarMensagemWhatsApp } from '@/lib/inteligencia/mensagens'
import type { StatusFrequencia, StatusPacote } from '@/lib/inteligencia/mensagens'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ClienteScore {
  id: number
  nomeCliente: string
  telefone: string | null
  email: string | null
  dataCadastro: string | null
  ultimaSessao: string | null
  totalSessoes: number
  statusFrequencia: StatusFrequencia
  temPacote: boolean
  statusPacote: StatusPacote | null
  nomePlano: string | null
  dataVencimentoPacote: string | null
  sessoesRestantes: number
  isFrequenteSemPacote: boolean
  temPacoteAtivo: boolean
  temPacoteSuspenso: boolean
  temAgendamentoFuturo: boolean
  ultimoContato: string | null
  diasSemSessao: number | null
  diasParaVencer: number | null
  prioridade: number
  bloqueado: boolean
  motivoBloqueio: string | null
}

interface Resumo {
  frequencia: Record<string, number>
  pacote: Record<string, number>
}

interface Stats {
  contatadosHoje: number
  contatadosSemana: number
  porMotivo: Record<string, number>
}

type GrupoPacote =
  | 'PACOTE_ATIVO' | 'PACOTE_A_VENCER'
  | 'PACOTE_FINALIZADO_30' | 'PACOTE_FINALIZADO_90' | 'PACOTE_FINALIZADO_180' | 'PACOTE_FINALIZADO_PLUS'
  | 'PACOTE_VENCIDO_ATE30' | 'PACOTE_VENCIDO_MAIS30'

type GrupoCliente = 'NOVO' | 'EM_RISCO' | 'PERDIDO' | 'FREQUENTE_SEM_PACOTE'

// ─── Unidades ─────────────────────────────────────────────────────────────────

const UNIDADES = [
  { slug: 'shopping-metropole',     nome: 'Shopping Metrópole' },
  { slug: 'tatuape-gomescardim',    nome: 'Tatuapé' },
  { slug: 'mooca-plaza',            nome: 'Mooca Plaza' },
  { slug: 'analia-franco',          nome: 'Anália Franco' },
  { slug: 'perdizes',               nome: 'Perdizes' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália' },
  { slug: 'higienopolis',           nome: 'Higienópolis' },
]

// ─── Grupos ───────────────────────────────────────────────────────────────────

type BlocoPacote = 'atual' | 'finalizado' | 'vencido'

// Cores dos status — todas dentro da paleta Buddha (marsala, dourado, flora, terra).
// Sem azul/lilás. Finalizados usam uma escala terrosa (esfria conforme envelhece).
const GRUPOS_PACOTE: { id: GrupoPacote; bloco: BlocoPacote; label: string; cor: string; descricao: string; dica?: string }[] = [
  // ── Atuais ──
  { id: 'PACOTE_A_VENCER',      bloco: 'atual',      label: 'A Vencer',        cor: '#8B6914', descricao: 'Vence nos próximos 30 dias',                 dica: '🔥 Prioridade máxima — renovar antes do vencimento' },
  { id: 'PACOTE_ATIVO',         bloco: 'atual',      label: 'Ativo',           cor: '#425F1D', descricao: 'Pacote em dia com sessões restantes',        dica: '💡 Convide para agendar — quem já agendou aparece bloqueado' },
  // ── Finalizados (por dias desde a última sessão) ──
  { id: 'PACOTE_FINALIZADO_30',   bloco: 'finalizado', label: '≤30 dias',      cor: '#8a5a3c', descricao: 'Usou tudo; última sessão há até 30 dias',    dica: '🔥 Renovação quente — acabou de finalizar' },
  { id: 'PACOTE_FINALIZADO_90',   bloco: 'finalizado', label: '≤90 dias',      cor: '#6f4630', descricao: 'Usou tudo; última sessão entre 31 e 90 dias' },
  { id: 'PACOTE_FINALIZADO_180',  bloco: 'finalizado', label: '≤180 dias',     cor: '#553526', descricao: 'Usou tudo; última sessão entre 91 e 180 dias' },
  { id: 'PACOTE_FINALIZADO_PLUS', bloco: 'finalizado', label: '+180 dias',     cor: '#392617', descricao: 'Usou tudo; última sessão há mais de 180 dias' },
  // ── Vencidos (regra dos 30 dias) ──
  { id: 'PACOTE_VENCIDO_ATE30',   bloco: 'vencido',    label: '≤30 dias · uso grátis', cor: '#a85a1e', descricao: 'Venceu há até 30 dias — ainda pode usar sem custo', dica: '⚡ Pode usar de graça em até 30 dias do vencimento — agende já!' },
  { id: 'PACOTE_VENCIDO_MAIS30',  bloco: 'vencido',    label: '+30 dias · reativar 20%', cor: '#7E0000', descricao: 'Venceu há mais de 30 dias — reativar com 20% do valor', dica: '📞 Oferecer reativação das sessões com 20% do valor' },
]

const BLOCOS_PACOTE: { bloco: BlocoPacote; titulo: string }[] = [
  { bloco: 'atual',      titulo: 'Pacotes atuais' },
  { bloco: 'finalizado', titulo: 'Finalizados (usou todas as sessões)' },
  { bloco: 'vencido',    titulo: 'Vencidos (sessões não usadas)' },
]

const GRUPOS_CLIENTE: { id: GrupoCliente; label: string; cor: string; descricao: string; dica?: string }[] = [
  { id: 'EM_RISCO',             label: 'Em Risco',             cor: '#D78B18', descricao: 'Não voltam entre 60 e 89 dias',           dica: '🔥 Prioridade máxima — recuperar antes de perder' },
  { id: 'FREQUENTE_SEM_PACOTE', label: 'Frequentes s/ Pacote', cor: '#557A1E', descricao: '3+ sessões avulsas — candidatos a pacote', dica: '💡 Já amam o Buddha — converter para pacote' },
  { id: 'NOVO',                 label: 'Novos',                cor: '#425F1D', descricao: 'Cadastrados nos últimos 30 dias',          dica: '👋 Boas-vindas — fidelizar desde o início' },
  { id: 'PERDIDO',              label: 'Perdidos',             cor: '#7E0000', descricao: 'Não voltam há 90–180 dias',               dica: '📞 Esforço de reativação — vale tentar' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filtrarPacote(clientes: ClienteScore[], grupo: GrupoPacote): ClienteScore[] {
  const map: Record<GrupoPacote, (c: ClienteScore) => boolean> = {
    PACOTE_ATIVO:           c => c.statusPacote === 'ATIVO',
    PACOTE_A_VENCER:        c => c.statusPacote === 'A_VENCER',
    PACOTE_FINALIZADO_30:   c => c.statusPacote === 'FINALIZADO_30',
    PACOTE_FINALIZADO_90:   c => c.statusPacote === 'FINALIZADO_90',
    PACOTE_FINALIZADO_180:  c => c.statusPacote === 'FINALIZADO_180',
    PACOTE_FINALIZADO_PLUS: c => c.statusPacote === 'FINALIZADO_PLUS',
    PACOTE_VENCIDO_ATE30:   c => c.statusPacote === 'VENCIDO_ATE30',
    PACOTE_VENCIDO_MAIS30:  c => c.statusPacote === 'VENCIDO_MAIS30',
  }
  return clientes.filter(map[grupo])
}

function filtrarCliente(clientes: ClienteScore[], grupo: GrupoCliente): ClienteScore[] {
  // Mesma prioridade da mensagem (cascata): pacote > frequente-sem-pacote > frequência.
  // Assim cada cliente aparece em UM único cluster.
  const map: Record<GrupoCliente, (c: ClienteScore) => boolean> = {
    NOVO:                 c => !c.temPacote && !c.isFrequenteSemPacote && c.statusFrequencia === 'NOVO',
    EM_RISCO:             c => !c.temPacote && !c.isFrequenteSemPacote && c.statusFrequencia === 'EM_RISCO',
    PERDIDO:              c => !c.temPacote && !c.isFrequenteSemPacote && c.statusFrequencia === 'PERDIDO',
    FREQUENTE_SEM_PACOTE: c => c.isFrequenteSemPacote,
  }
  return clientes.filter(map[grupo])
}

function contagemPacote(resumo: Resumo, id: GrupoPacote): number {
  const keys: Record<GrupoPacote, string> = {
    PACOTE_ATIVO: 'ATIVO', PACOTE_A_VENCER: 'A_VENCER',
    PACOTE_FINALIZADO_30: 'FINALIZADO_30', PACOTE_FINALIZADO_90: 'FINALIZADO_90',
    PACOTE_FINALIZADO_180: 'FINALIZADO_180', PACOTE_FINALIZADO_PLUS: 'FINALIZADO_PLUS',
    PACOTE_VENCIDO_ATE30: 'VENCIDO_ATE30', PACOTE_VENCIDO_MAIS30: 'VENCIDO_MAIS30',
  }
  return resumo.pacote[keys[id]] ?? 0
}

function contagemCliente(resumo: Resumo, id: GrupoCliente): number {
  if (id === 'FREQUENTE_SEM_PACOTE') return resumo.pacote['FREQUENTE_SEM_PACOTE'] ?? 0
  return resumo.frequencia[id] ?? 0
}

function mensagemWpp(c: ClienteScore, templates?: Record<string, string>): string {
  return gerarMensagemWhatsApp(
    c.statusFrequencia, c.statusPacote, c.isFrequenteSemPacote,
    c.nomeCliente, c.diasParaVencer, templates,
    { sessoes: c.sessoesRestantes, validade: c.dataVencimentoPacote },
  )
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// Célula "Última msg enviada pelo ERP" — mostra a data + recência, com destaque se ≤7 dias
function CelulaUltimaMsg({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-xs text-[#392617]/30">nunca</span>
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  const rel = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias}d`
  const recente = dias <= 7
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${recente ? 'bg-[#D78B18]/15 text-[#8B6914] font-medium' : 'text-[#392617]/60'}`}
      title={`Última mensagem enviada pelo ERP: ${formatarData(iso)}`}
    >
      {recente && '⏱ '}{rel}
    </span>
  )
}

// ─── TabsRow ──────────────────────────────────────────────────────────────────

function TabsRow<T extends string>({
  grupos, ativo, setAtivo, resumo, contar,
}: {
  grupos: { id: T; label: string; cor: string; descricao: string; dica?: string }[]
  ativo: T
  setAtivo: (id: T) => void
  resumo: Resumo
  contar: (resumo: Resumo, id: T) => number
}) {
  return (
    <div className="flex flex-wrap gap-2 p-4 border-b border-[#DDC7A4]/50">
      {grupos.map(({ id, label, cor }) => {
        const count = contar(resumo, id)
        const isAtivo = ativo === id
        return (
          <button
            key={id}
            onClick={() => setAtivo(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              isAtivo
                ? 'text-white border-transparent shadow-md'
                : 'bg-white border-[#DDC7A4] text-[#392617] hover:border-current'
            }`}
            style={isAtivo ? { backgroundColor: cor, borderColor: cor } : {}}
          >
            <span className="text-base font-bold" style={{ color: isAtivo ? 'white' : cor }}>
              {count}
            </span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── TabsRowPacote (agrupado em blocos: Atuais / Finalizados / Vencidos) ────────

function TabsRowPacote({
  ativo, setAtivo, resumo,
}: {
  ativo: GrupoPacote
  setAtivo: (id: GrupoPacote) => void
  resumo: Resumo
}) {
  return (
    <div className="p-4 border-b border-[#DDC7A4]/50 space-y-3">
      {BLOCOS_PACOTE.map(({ bloco, titulo }) => {
        const grupos = GRUPOS_PACOTE.filter(g => g.bloco === bloco)
        const totalBloco = grupos.reduce((s, g) => s + contagemPacote(resumo, g.id), 0)
        return (
          <div key={bloco}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-[#392617]/45">{titulo}</span>
              <span className="text-[11px] text-[#392617]/35">({totalBloco})</span>
              <div className="flex-1 h-px bg-[#DDC7A4]/40" />
            </div>
            <div className="flex flex-wrap gap-2">
              {grupos.map(({ id, label, cor }) => {
                const count = contagemPacote(resumo, id)
                const isAtivo = ativo === id
                return (
                  <button
                    key={id}
                    onClick={() => setAtivo(id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      isAtivo ? 'text-white border-transparent shadow-md' : 'bg-white border-[#DDC7A4] text-[#392617] hover:border-current'
                    }`}
                    style={isAtivo ? { backgroundColor: cor, borderColor: cor } : {}}
                  >
                    <span className="text-base font-bold" style={{ color: isAtivo ? 'white' : cor }}>{count}</span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── TabelaPacotes ────────────────────────────────────────────────────────────

function TabelaPacotes({
  clientes, loading, grupoLabel, copiado, confirmando, onCopiar, onContatou, onAbrir, onCancelar, gerarMsg,
}: {
  clientes: ClienteScore[]
  loading: boolean
  grupoLabel: string
  copiado: number | null
  confirmando: number | null
  onCopiar: (c: ClienteScore) => void
  onContatou: (c: ClienteScore) => void
  onAbrir: (c: ClienteScore) => void
  onCancelar: () => void
  gerarMsg: (c: ClienteScore) => string
}) {
  if (loading) return <div className="py-10 text-center text-[#392617]/40 text-sm">Carregando...</div>
  if (clientes.length === 0) return (
    <div className="py-10 text-center text-[#392617]/40 text-sm">
      Nenhum cliente em <strong>{grupoLabel}</strong> nesta unidade.
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#DDC7A4]/20 text-[#392617]/60 text-xs font-medium">
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-left">Plano</th>
            <th className="px-4 py-2 text-center">Sessões</th>
            <th className="px-4 py-2 text-center">Validade</th>
            <th className="px-4 py-2 text-center">Agendado?</th>
            <th className="px-4 py-2 text-center">Última msg</th>
            <th className="px-4 py-2 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DDC7A4]/30">
          {clientes.map((c) => (
            <tr key={c.id} className="hover:bg-[#DDC7A4]/10 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-[#392617] truncate max-w-[180px]">{c.nomeCliente}</p>
                {c.telefone && <p className="text-xs text-[#392617]/50">📱 {c.telefone}</p>}
              </td>
              <td className="px-4 py-3 text-[#392617]/70 text-xs max-w-[140px]">
                <span className="truncate block">{c.nomePlano || '—'}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-[#392617] font-medium">{c.sessoesRestantes}</span>
                <span className="text-[#392617]/40 text-xs"> rest.</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-[#392617]/80 text-xs">{formatarData(c.dataVencimentoPacote)}</span>
                {c.diasParaVencer !== null && (
                  <p className="text-xs" style={{ color: c.diasParaVencer < 0 ? '#7E0000' : c.diasParaVencer <= 30 ? '#8B6914' : '#425F1D' }}>
                    {c.diasParaVencer < 0 ? `${Math.abs(c.diasParaVencer)}d atrás` : `${c.diasParaVencer}d`}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {c.temAgendamentoFuturo
                  ? <span className="text-xs bg-[#425F1D]/12 text-[#425F1D] px-2 py-0.5 rounded-full font-medium">✓ Sim</span>
                  : <span className="text-xs text-[#392617]/30">—</span>
                }
              </td>
              <td className="px-4 py-3 text-center"><CelulaUltimaMsg iso={c.ultimoContato} /></td>
              <td className="px-4 py-3 text-right">
                {confirmando === c.id ? (
                  <div className="flex gap-1.5 justify-end items-center">
                    <span className="text-xs text-[#392617]/60 mr-1">Enviou?</span>
                    <button
                      onClick={() => onContatou(c)}
                      className="text-xs bg-[#425F1D] text-white px-3 py-1.5 rounded-lg hover:bg-[#37501a] transition-colors"
                    >
                      ✓ Sim
                    </button>
                    <button
                      onClick={() => onCancelar()}
                      className="text-xs border border-[#DDC7A4] text-[#392617] px-3 py-1.5 rounded-lg hover:bg-[#DDC7A4]/20 transition-colors"
                    >
                      ✗ Não
                    </button>
                  </div>
                ) : (
                  c.bloqueado ? (
                    <span
                      className="text-xs bg-[#7E0000]/8 text-[#7E0000] border border-[#7E0000]/20 px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                      title="Bloqueado pela trava anti-mensagem-errada"
                    >
                      🚫 {c.motivoBloqueio}
                    </span>
                  ) : (
                  <div className="flex gap-1.5 justify-end items-center">
                    {c.temPacoteSuspenso && (
                      <span
                        className="text-xs bg-[#D78B18]/12 text-[#8B6914] border border-[#D78B18]/30 px-2 py-1 rounded-lg whitespace-nowrap"
                        title="Pacote suspenso no Belle — não pode ser usado. Verifique o caso antes de enviar."
                      >
                        ⚠️ Suspenso
                      </span>
                    )}
                    {c.telefone && (
                      <a
                        href={`https://wa.me/55${c.telefone}?text=${encodeURIComponent(gerarMsg(c))}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={() => onAbrir(c)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-[#25D366] text-white px-4 py-2 rounded-lg shadow-sm hover:bg-[#1ebe5b] hover:shadow transition-all whitespace-nowrap"
                      >
                        💬 Enviar
                      </a>
                    )}
                    <button
                      onClick={() => onCopiar(c)}
                      title="Copiar a mensagem pronta"
                      className="text-sm border border-[#DDC7A4] text-[#392617] px-2.5 py-2 rounded-lg hover:bg-[#DDC7A4]/20 transition-colors"
                    >
                      {copiado === c.id ? '✓' : '📋'}
                    </button>
                  </div>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── TabelaClientes ───────────────────────────────────────────────────────────

function TabelaClientes({
  clientes, loading, grupoLabel, copiado, confirmando, onCopiar, onContatou, onAbrir, onCancelar, gerarMsg,
}: {
  clientes: ClienteScore[]
  loading: boolean
  grupoLabel: string
  copiado: number | null
  confirmando: number | null
  onCopiar: (c: ClienteScore) => void
  onContatou: (c: ClienteScore) => void
  onAbrir: (c: ClienteScore) => void
  onCancelar: () => void
  gerarMsg: (c: ClienteScore) => string
}) {
  if (loading) return <div className="py-10 text-center text-[#392617]/40 text-sm">Carregando...</div>
  if (clientes.length === 0) return (
    <div className="py-10 text-center text-[#392617]/40 text-sm">
      Nenhum cliente em <strong>{grupoLabel}</strong> nesta unidade.
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#DDC7A4]/20 text-[#392617]/60 text-xs font-medium">
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-center">Última visita</th>
            <th className="px-4 py-2 text-center">Sessões</th>
            <th className="px-4 py-2 text-center">Última msg</th>
            <th className="px-4 py-2 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DDC7A4]/30">
          {clientes.map((c) => (
            <tr key={c.id} className="hover:bg-[#DDC7A4]/10 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-[#392617] truncate max-w-[200px]">{c.nomeCliente}</p>
                {c.telefone && <p className="text-xs text-[#392617]/50">📱 {c.telefone}</p>}
                {c.statusFrequencia === 'NOVO' && c.dataCadastro && (
                  <p className="text-xs text-[#425F1D]">Cadastro: {formatarData(c.dataCadastro)}</p>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <p className="text-[#392617]/80 text-xs">{formatarData(c.ultimaSessao)}</p>
                {c.diasSemSessao !== null && (
                  <p className="text-xs" style={{ color: c.diasSemSessao >= 90 ? '#7E0000' : c.diasSemSessao >= 60 ? '#D78B18' : '#392617' }}>
                    {c.diasSemSessao}d atrás
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-center text-[#392617]/70">
                {c.totalSessoes > 0 ? c.totalSessoes : '—'}
              </td>
              <td className="px-4 py-3 text-center"><CelulaUltimaMsg iso={c.ultimoContato} /></td>
              <td className="px-4 py-3 text-right">
                {confirmando === c.id ? (
                  <div className="flex gap-1.5 justify-end items-center">
                    <span className="text-xs text-[#392617]/60 mr-1">Enviou?</span>
                    <button
                      onClick={() => onContatou(c)}
                      className="text-xs bg-[#425F1D] text-white px-3 py-1.5 rounded-lg hover:bg-[#37501a] transition-colors"
                    >
                      ✓ Sim
                    </button>
                    <button
                      onClick={() => onCancelar()}
                      className="text-xs border border-[#DDC7A4] text-[#392617] px-3 py-1.5 rounded-lg hover:bg-[#DDC7A4]/20 transition-colors"
                    >
                      ✗ Não
                    </button>
                  </div>
                ) : (
                  c.bloqueado ? (
                    <span
                      className="text-xs bg-[#7E0000]/8 text-[#7E0000] border border-[#7E0000]/20 px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                      title="Bloqueado pela trava anti-mensagem-errada"
                    >
                      🚫 {c.motivoBloqueio}
                    </span>
                  ) : (
                  <div className="flex gap-1.5 justify-end items-center">
                    {c.temPacoteSuspenso && (
                      <span
                        className="text-xs bg-[#D78B18]/12 text-[#8B6914] border border-[#D78B18]/30 px-2 py-1 rounded-lg whitespace-nowrap"
                        title="Pacote suspenso no Belle — não pode ser usado. Verifique o caso antes de enviar."
                      >
                        ⚠️ Suspenso
                      </span>
                    )}
                    {c.telefone && (
                      <a
                        href={`https://wa.me/55${c.telefone}?text=${encodeURIComponent(gerarMsg(c))}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={() => onAbrir(c)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-[#25D366] text-white px-4 py-2 rounded-lg shadow-sm hover:bg-[#1ebe5b] hover:shadow transition-all whitespace-nowrap"
                      >
                        💬 Enviar
                      </a>
                    )}
                    <button
                      onClick={() => onCopiar(c)}
                      title="Copiar a mensagem pronta"
                      className="text-sm border border-[#DDC7A4] text-[#392617] px-2.5 py-2 rounded-lg hover:bg-[#DDC7A4]/20 transition-colors"
                    >
                      {copiado === c.id ? '✓' : '📋'}
                    </button>
                  </div>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Me {
  nome: string
  perfil: 'DONA' | 'RECEPCAO'
  unidadeSlug: string | null
}

export default function InteligenciaPage() {
  const [me, setMe]                     = useState<Me | null>(null)
  const [templates, setTemplates]       = useState<Record<string, string>>({})
  const [unidade, setUnidade]           = useState('shopping-metropole')
  const [grupoPacote, setGrupoPacote]   = useState<GrupoPacote>('PACOTE_A_VENCER')
  const [grupoCliente, setGrupoCliente] = useState<GrupoCliente>('EM_RISCO')
  const [clientes, setClientes]         = useState<ClienteScore[]>([])
  const [resumo, setResumo]             = useState<Resumo>({ frequencia: {}, pacote: {} })
  const [stats, setStats]               = useState<Stats>({ contatadosHoje: 0, contatadosSemana: 0, porMotivo: {} })
  const [loading, setLoading]           = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [ultimoSync, setUltimoSync]     = useState<string | null>(null)
  const [copiado, setCopiado]           = useState<number | null>(null)
  const [confirmando, setConfirmando]   = useState<number | null>(null)
  const [colapsadoPacote, setColapsadoPacote]   = useState(false)
  const [colapsadoCliente, setColapsadoCliente] = useState(false)
  const [teto, setTeto]                 = useState<{ cap: number; enviadasHoje: number } | null>(null)

  const carregarStats = useCallback(async () => {
    const r = await fetch(`/api/inteligencia/contato?unidade=${unidade}`)
    if (r.ok) setStats(await r.json())
  }, [unidade])

  const carregarStatus = useCallback(async () => {
    const r = await fetch('/api/inteligencia/status')
    const d = await r.json()
    if (d.ultimoSync) setUltimoSync(d.ultimoSync)
  }, [])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetch(`/api/inteligencia/scores?unidade=${unidade}`)
          .then(r => r.json())
          .then(d => {
            setClientes(d.clientes || [])
            setResumo({ frequencia: d.resumoFrequencia || {}, pacote: d.resumoPacote || {} })
          }),
        carregarStats(),
        carregarStatus(),
      ])
    } finally {
      setLoading(false)
    }
  }, [unidade, carregarStats, carregarStatus])

  // Identidade do usuário logado — trava a unidade da recepção
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d?.usuario) return
        setMe(d.usuario)
        if (d.usuario.perfil === 'RECEPCAO' && d.usuario.unidadeSlug) {
          setUnidade(d.usuario.unidadeSlug)
        }
      })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/login'
  }

  // Textos editáveis por cluster — usados ao gerar as mensagens
  useEffect(() => {
    fetch('/api/inteligencia/mensagens')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.itens) {
          setTemplates(Object.fromEntries(d.itens.map((i: { cluster: string; texto: string }) => [i.cluster, i.texto])))
        }
      })
      .catch(() => {})
  }, [])

  const gerarMsg = useCallback((c: ClienteScore) => mensagemWpp(c, templates), [templates])

  // Teto diário de envios (contador anti-ban)
  useEffect(() => {
    fetch(`/api/inteligencia/plano-dia?unidade=${unidade}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setTeto({ cap: d.cap, enviadasHoje: d.enviadasHoje }) })
      .catch(() => {})
  }, [unidade])

  // Abre a aba certa quando vem do Plano do Dia (?grupo=...)
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get('grupo')
    if (!g) return
    if (GRUPOS_PACOTE.some(x => x.id === g)) { setGrupoPacote(g as GrupoPacote); setColapsadoPacote(false) }
    else if (GRUPOS_CLIENTE.some(x => x.id === g)) { setGrupoCliente(g as GrupoCliente); setColapsadoCliente(false) }
  }, [])

  useEffect(() => {
    carregarDados()
    const t = setTimeout(() => carregarDados(), 30_000)
    return () => clearTimeout(t)
  }, [carregarDados])

  const handleSync = async () => {
    setSyncing(true)
    await fetch('/api/inteligencia/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setSyncing(false)
    setTimeout(() => carregarDados(), 30_000)
    setTimeout(() => carregarDados(), 120_000)
  }

  const marcarContatado = useCallback(async (c: ClienteScore, motivo: string) => {
    // Só chega aqui depois que a recepção confirma que enviou a mensagem
    setConfirmando(null)
    setClientes(prev => prev.filter(x => x.id !== c.id))
    // Persiste no backend (inclui o texto enviado, para espelhar no LeadFlow)
    await fetch('/api/inteligencia/contato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteScoreId: c.id, motivoContato: motivo, mensagem: gerarMsg(c) }),
    })
    // Atualiza stats + contador de teto
    setStats(prev => ({ ...prev, contatadosHoje: prev.contatadosHoje + 1 }))
    setTeto(prev => prev ? { ...prev, enviadasHoje: prev.enviadasHoje + 1 } : prev)
  }, [gerarMsg])

  const copiarMensagem = (c: ClienteScore) => {
    navigator.clipboard.writeText(gerarMsg(c))
    setCopiado(c.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  // Abre o WhatsApp com a mensagem pronta e pede confirmação de envio à recepção
  const abrirWhatsapp = (c: ClienteScore) => setConfirmando(c.id)
  const cancelarConfirmacao = () => setConfirmando(null)

  const clientesPacote  = filtrarPacote(clientes, grupoPacote)
  const clientesCliente = filtrarCliente(clientes, grupoCliente)
  const infoPacote      = GRUPOS_PACOTE.find(g => g.id === grupoPacote)!
  const infoCliente     = GRUPOS_CLIENTE.find(g => g.id === grupoCliente)!

  const totalPacotes  = GRUPOS_PACOTE.reduce((s, g) => s + contagemPacote(resumo, g.id), 0)
  const totalClientes = GRUPOS_CLIENTE.reduce((s, g) => s + contagemCliente(resumo, g.id), 0)

  // Pendentes de contato hoje (excluindo ATIVO — não precisa contato)
  const pendentesHoje = (resumo.pacote['A_VENCER'] ?? 0)
    + (resumo.pacote['VENCIDO_ATE30'] ?? 0)
    + (resumo.pacote['VENCIDO_MAIS30'] ?? 0)
    + (resumo.pacote['FINALIZADO_30'] ?? 0)
    + (resumo.frequencia['EM_RISCO'] ?? 0)
    + (resumo.pacote['FREQUENTE_SEM_PACOTE'] ?? 0)

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#392617]">
            {me ? `Olá, ${me.nome.split(' ')[0]} 🌸` : 'Inteligência de Clientes'}
          </h1>
          <p className="text-sm text-[#392617]/60 mt-0.5">
            Estes são os clientes para cuidar hoje
            {ultimoSync && (
              <span className="ml-2 text-[#392617]/40">
                · atualizado {new Date(ultimoSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {me?.perfil === 'RECEPCAO' ? (
            <span className="text-sm border border-[#DDC7A4] rounded-lg px-3 py-2 bg-[#DDC7A4]/20 text-[#392617] font-medium">
              {UNIDADES.find(u => u.slug === unidade)?.nome ?? unidade}
            </span>
          ) : (
            <select
              value={unidade} onChange={e => setUnidade(e.target.value)}
              className="text-sm border border-[#DDC7A4] rounded-lg px-3 py-2 bg-white text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
            >
              {UNIDADES.map(u => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
            </select>
          )}
          <button
            onClick={handleSync} disabled={syncing}
            title="Forçar atualização agora (sync automático a cada 3h)"
            className="text-sm border border-[#DDC7A4] text-[#392617] px-3 py-2 rounded-lg hover:bg-[#DDC7A4]/20 disabled:opacity-50 transition-colors"
          >
            {syncing ? '↻' : '↻ Atualizar'}
          </button>
          {me && (
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[#DDC7A4]">
              <span className="text-xs text-[#392617]/60 hidden sm:inline" title={me.perfil}>
                {me.nome}
              </span>
              <a
                href="/trocar-senha"
                className="text-sm border border-[#DDC7A4] text-[#392617] px-3 py-2 rounded-lg hover:bg-[#DDC7A4]/20 transition-colors"
              >
                Trocar senha
              </a>
              <button
                onClick={handleLogout}
                className="text-sm border border-[#DDC7A4] text-[#392617] px-3 py-2 rounded-lg hover:bg-[#7E0000]/10 hover:text-[#7E0000] transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Contador de teto diário (anti-ban) ──────────────────────── */}
      {teto && (
        <div className={`rounded-xl border px-5 py-3 flex items-center justify-between gap-3 flex-wrap ${teto.enviadasHoje >= teto.cap ? 'bg-[#7E0000]/8 border-[#7E0000]/25' : 'bg-white border-[#DDC7A4]'}`}>
          <div className="flex items-center gap-3">
            <span className="text-lg">{teto.enviadasHoje >= teto.cap ? '🛑' : '📨'}</span>
            <div>
              <p className="text-sm font-medium text-[#392617]">
                Envios de hoje: <strong style={{ color: teto.enviadasHoje >= teto.cap ? '#7E0000' : '#425F1D' }}>{teto.enviadasHoje}</strong> de {teto.cap}
              </p>
              <p className="text-xs text-[#392617]/50">
                {teto.enviadasHoje >= teto.cap ? 'Teto do dia atingido — pare por hoje para proteger o número.' : `Restam ${teto.cap - teto.enviadasHoje} · horários ideais: 10h–12h e 16h–18h`}
              </p>
            </div>
          </div>
          <a href="/inteligencia/plano-dia" className="text-xs border border-[#DDC7A4] text-[#392617] px-3 py-1.5 rounded-lg hover:bg-[#DDC7A4]/20 whitespace-nowrap">📅 Ver plano do dia</a>
        </div>
      )}

      {/* ── Dashboard do dia ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#DDC7A4] p-4">
          <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Pendentes hoje</p>
          <p className="text-3xl font-bold text-[#7E0000] mt-1">{Math.max(0, pendentesHoje - (stats.contatadosHoje ?? 0))}</p>
          <p className="text-xs text-[#392617]/40 mt-0.5">de {pendentesHoje} total</p>
        </div>
        <div className="bg-white rounded-xl border border-[#DDC7A4] p-4">
          <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Contatados hoje</p>
          <p className="text-3xl font-bold text-[#425F1D] mt-1">{stats.contatadosHoje ?? 0}</p>
          <p className="text-xs text-[#392617]/40 mt-0.5">mensagens enviadas</p>
        </div>
        <div className="bg-white rounded-xl border border-[#DDC7A4] p-4">
          <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Semana</p>
          <p className="text-3xl font-bold text-[#D78B18] mt-1">{stats.contatadosSemana ?? 0}</p>
          <p className="text-xs text-[#392617]/40 mt-0.5">contatos totais</p>
        </div>
        <div className="bg-white rounded-xl border border-[#DDC7A4] p-4">
          <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Com pacote ativo</p>
          <p className="text-3xl font-bold text-[#425F1D] mt-1">{resumo.pacote['ATIVO'] ?? 0}</p>
          <p className="text-xs text-[#392617]/40 mt-0.5">convide a agendar</p>
        </div>
      </div>

      {/* ── Seção 1: Pacotes ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#DDC7A4] overflow-hidden">
        <div
          className="px-5 py-3.5 bg-[#7E0000]/6 border-b border-[#DDC7A4]/50 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setColapsadoPacote(p => !p)}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h2 className="font-semibold text-[#392617]">Clientes com Pacote</h2>
            <span className="text-xs text-[#392617]/50 bg-[#DDC7A4]/30 px-2.5 py-0.5 rounded-full">
              {totalPacotes} clientes
            </span>
          </div>
          <span className="text-[#392617]/40 text-lg">{colapsadoPacote ? '▸' : '▾'}</span>
        </div>

        {!colapsadoPacote && (
          <>
            <TabsRowPacote
              ativo={grupoPacote}
              setAtivo={setGrupoPacote}
              resumo={resumo}
            />

            <div className="px-5 py-2.5 flex items-center justify-between border-b border-[#DDC7A4]/30 bg-[#DDC7A4]/10">
              <div>
                <span className="text-xs text-[#392617]/60">{infoPacote.descricao}</span>
                {infoPacote.dica && (
                  <span className="ml-2 text-xs text-[#8B6914]">{infoPacote.dica}</span>
                )}
              </div>
              <span className="text-xs text-[#392617]/40 shrink-0">{clientesPacote.length} pendentes</span>
            </div>

            <TabelaPacotes
              clientes={clientesPacote} loading={loading}
              grupoLabel={infoPacote.label} copiado={copiado} confirmando={confirmando}
              onCopiar={copiarMensagem} onAbrir={abrirWhatsapp} onCancelar={cancelarConfirmacao}
              onContatou={c => marcarContatado(c, grupoPacote)}
              gerarMsg={gerarMsg}
            />
          </>
        )}
      </div>

      {/* ── Seção 2: Demais clientes ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#DDC7A4] overflow-hidden">
        <div
          className="px-5 py-3.5 bg-[#392617]/5 border-b border-[#DDC7A4]/50 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setColapsadoCliente(p => !p)}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">👥</span>
            <h2 className="font-semibold text-[#392617]">Demais Clientes</h2>
            <span className="text-xs text-[#392617]/50 bg-[#DDC7A4]/30 px-2.5 py-0.5 rounded-full">
              {totalClientes} clientes
            </span>
          </div>
          <span className="text-[#392617]/40 text-lg">{colapsadoCliente ? '▸' : '▾'}</span>
        </div>

        {!colapsadoCliente && (
          <>
            <TabsRow
              grupos={GRUPOS_CLIENTE}
              ativo={grupoCliente}
              setAtivo={setGrupoCliente}
              resumo={resumo}
              contar={contagemCliente}
            />

            <div className="px-5 py-2.5 flex items-center justify-between border-b border-[#DDC7A4]/30 bg-[#DDC7A4]/10">
              <div>
                <span className="text-xs text-[#392617]/60">{infoCliente.descricao}</span>
                {infoCliente.dica && (
                  <span className="ml-2 text-xs text-[#8B6914]">{infoCliente.dica}</span>
                )}
              </div>
              <span className="text-xs text-[#392617]/40 shrink-0">{clientesCliente.length} pendentes</span>
            </div>

            <TabelaClientes
              clientes={clientesCliente} loading={loading}
              grupoLabel={infoCliente.label} copiado={copiado} confirmando={confirmando}
              onCopiar={copiarMensagem} onAbrir={abrirWhatsapp} onCancelar={cancelarConfirmacao}
              onContatou={c => marcarContatado(c, grupoCliente)}
              gerarMsg={gerarMsg}
            />
          </>
        )}
      </div>

    </div>
  )
}
