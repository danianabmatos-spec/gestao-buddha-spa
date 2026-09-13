'use client'

import { useState, useEffect, useCallback } from 'react'
import { gerarMensagemTotalPass } from '@/lib/inteligencia/mensagens'

interface ClienteTP {
  id: number
  nomeCliente: string
  telefone: string | null
  usosAno: number
  ultimoUso: string | null
  sessoesMes: number
  mesRef: string
  planoCancelado: boolean
  ultimoContato: string | null
  faltam: number
  completo: boolean
  bloqueado: boolean
  motivoBloqueio: string | null
}

interface Resumo { s0: number; s1: number; s2: number; cancelados: number }
interface Me { nome: string; perfil: 'DONA' | 'RECEPCAO'; unidadeSlug: string | null }

const UNIDADES = [
  { slug: 'shopping-metropole', nome: 'Shopping Metrópole' },
  { slug: 'tatuape-gomescardim', nome: 'Tatuapé' },
  { slug: 'mooca-plaza', nome: 'Mooca Plaza' },
  { slug: 'analia-franco', nome: 'Anália Franco' },
  { slug: 'perdizes', nome: 'Perdizes' },
  { slug: 'shopping-analia-franco', nome: 'Shopping Anália' },
  { slug: 'higienopolis', nome: 'Higienópolis' },
]

type Aba = '0' | '1' | '2' | 'cancelado'
const ABAS: { id: Aba; label: string; cor: string; dica: string }[] = [
  { id: '0', label: 'Sem agendamento (0/2)', cor: '#7E0000', dica: '🔥 Convidar para agendar as 2 sessões do mês' },
  { id: '1', label: 'Falta 1 (1/2)',         cor: '#D78B18', dica: '💡 Convidar para agendar a 2ª sessão' },
  { id: '2', label: 'Completo (2/2)',        cor: '#425F1D', dica: '✓ Já agendou as 2 do mês — não contatar' },
  { id: 'cancelado', label: 'Sem plano',     cor: '#392617', dica: '🚫 Marcados como sem TotalPass — não recebem mensagem' },
]

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function UltimaMsg({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-xs text-[#392617]/30">nunca</span>
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  const rel = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias}d`
  const recente = dias <= 7
  return <span className={`text-xs px-2 py-0.5 rounded-full ${recente ? 'bg-[#D78B18]/15 text-[#8B6914] font-medium' : 'text-[#392617]/60'}`}>{recente && '⏱ '}{rel}</span>
}

export default function TotalPassPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [unidade, setUnidade] = useState('shopping-metropole')
  const [clientes, setClientes] = useState<ClienteTP[]>([])
  const [resumo, setResumo] = useState<Resumo>({ s0: 0, s1: 0, s2: 0, cancelados: 0 })
  const [aba, setAba] = useState<Aba>('0')
  const [loading, setLoading] = useState(false)
  const [confirmando, setConfirmando] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d?.usuario) return
      setMe(d.usuario)
      if (d.usuario.perfil === 'RECEPCAO' && d.usuario.unidadeSlug) setUnidade(d.usuario.unidadeSlug)
    }).catch(() => {})
    // aba vinda do Plano do Dia (?aba=0|1)
    const p = new URLSearchParams(window.location.search).get('aba')
    if (p === '0' || p === '1') setAba(p)
  }, [])

  useEffect(() => {
    fetch('/api/inteligencia/mensagens').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.itens) setTemplates(Object.fromEntries(d.itens.map((i: { cluster: string; texto: string }) => [i.cluster, i.texto])))
    }).catch(() => {})
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/inteligencia/totalpass?unidade=${unidade}`)
      if (r.ok) { const d = await r.json(); setClientes(d.clientes || []); setResumo(d.resumo || { s0: 0, s1: 0, s2: 0, cancelados: 0 }) }
    } finally { setLoading(false) }
  }, [unidade])

  useEffect(() => { carregar() }, [carregar])

  const gerarMsg = useCallback((c: ClienteTP) => gerarMensagemTotalPass(c.sessoesMes, c.nomeCliente, templates), [templates])

  async function marcarContatado(c: ClienteTP) {
    setConfirmando(null)
    setClientes(prev => prev.filter(x => x.id !== c.id))
    await fetch('/api/inteligencia/totalpass', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, acao: 'contatado', mensagem: gerarMsg(c) }),
    }).catch(() => {})
  }

  async function toggleCancelado(c: ClienteTP, cancelado: boolean) {
    setClientes(prev => prev.map(x => x.id === c.id ? { ...x, planoCancelado: cancelado, bloqueado: cancelado || x.completo } : x))
    await fetch('/api/inteligencia/totalpass', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, acao: 'cancelar', cancelado }),
    }).catch(() => { carregar() })
  }

  const lista = clientes.filter(c => {
    if (aba === 'cancelado') return c.planoCancelado
    if (c.planoCancelado) return false
    if (aba === '2') return c.sessoesMes >= 2
    return c.sessoesMes === Number(aba)
  })
  const infoAba = ABAS.find(a => a.id === aba)!
  const cont = (id: Aba) => id === '0' ? resumo.s0 : id === '1' ? resumo.s1 : id === '2' ? resumo.s2 : resumo.cancelados

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#392617]">TotalPass</h1>
          <p className="text-sm text-[#392617]/60 mt-0.5">Clientes TotalPass — 2 sessões por mês. Convide quem ainda não agendou.</p>
        </div>
        {me?.perfil === 'RECEPCAO' ? (
          <span className="text-sm border border-[#DDC7A4] rounded-lg px-3 py-2 bg-[#DDC7A4]/20 text-[#392617] font-medium">
            {UNIDADES.find(u => u.slug === unidade)?.nome ?? unidade}
          </span>
        ) : (
          <select value={unidade} onChange={e => setUnidade(e.target.value)}
            className="text-sm border border-[#DDC7A4] rounded-lg px-3 py-2 bg-white text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]">
            {UNIDADES.map(u => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#DDC7A4] overflow-hidden">
        <div className="flex flex-wrap gap-2 p-4 border-b border-[#DDC7A4]/50">
          {ABAS.map(({ id, label, cor }) => {
            const isAtivo = aba === id
            return (
              <button key={id} onClick={() => setAba(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${isAtivo ? 'text-white border-transparent shadow-md' : 'bg-white border-[#DDC7A4] text-[#392617] hover:border-current'}`}
                style={isAtivo ? { backgroundColor: cor, borderColor: cor } : {}}>
                <span className="text-base font-bold" style={{ color: isAtivo ? 'white' : cor }}>{cont(id)}</span>
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        <div className="px-5 py-2.5 border-b border-[#DDC7A4]/30 bg-[#DDC7A4]/10">
          <span className="text-xs text-[#8B6914]">{infoAba.dica}</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-[#392617]/40 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="py-10 text-center text-[#392617]/40 text-sm">Nenhum cliente nesta faixa.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#DDC7A4]/20 text-[#392617]/60 text-xs font-medium">
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-center">Usos 2026</th>
                  <th className="px-4 py-2 text-center">Sessões do mês</th>
                  <th className="px-4 py-2 text-center">Última msg</th>
                  <th className="px-4 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDC7A4]/30">
                {lista.map((c) => (
                  <tr key={c.id} className="hover:bg-[#DDC7A4]/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#392617] truncate max-w-[200px]">{c.nomeCliente}</p>
                      {c.telefone && <p className="text-xs text-[#392617]/50">📱 {c.telefone}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-[#392617]/70">{c.usosAno}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${c.sessoesMes >= 2 ? 'text-[#425F1D]' : c.sessoesMes === 1 ? 'text-[#D78B18]' : 'text-[#7E0000]'}`}>{c.sessoesMes}</span>
                      <span className="text-[#392617]/40 text-xs">/2</span>
                    </td>
                    <td className="px-4 py-3 text-center"><UltimaMsg iso={c.ultimoContato} /></td>
                    <td className="px-4 py-3 text-right">
                      {confirmando === c.id ? (
                        <div className="flex gap-1.5 justify-end items-center">
                          <span className="text-xs text-[#392617]/60 mr-1">Enviou?</span>
                          <button onClick={() => marcarContatado(c)} className="text-xs bg-[#425F1D] text-white px-3 py-1.5 rounded-lg hover:bg-[#37501a]">✓ Sim</button>
                          <button onClick={() => setConfirmando(null)} className="text-xs border border-[#DDC7A4] text-[#392617] px-3 py-1.5 rounded-lg hover:bg-[#DDC7A4]/20">✗ Não</button>
                        </div>
                      ) : c.planoCancelado ? (
                        <div className="flex gap-1.5 justify-end items-center">
                          <span className="text-xs text-[#392617]/50">sem plano</span>
                          <button onClick={() => toggleCancelado(c, false)} className="text-xs border border-[#DDC7A4] text-[#392617] px-2 py-1.5 rounded-lg hover:bg-[#DDC7A4]/20">↩ Reativar</button>
                        </div>
                      ) : c.completo ? (
                        <span className="text-xs text-[#425F1D]">✓ Completo</span>
                      ) : (
                        <div className="flex gap-1.5 justify-end items-center">
                          {c.telefone && (
                            <a href={`https://wa.me/55${c.telefone}?text=${encodeURIComponent(gerarMsg(c))}`}
                              target="_blank" rel="noopener noreferrer" onClick={() => setConfirmando(c.id)}
                              className="text-xs bg-[#25D366] text-white px-3 py-1.5 rounded-lg hover:bg-[#1ebe5b] whitespace-nowrap">WhatsApp</a>
                          )}
                          <button onClick={() => toggleCancelado(c, true)}
                            title="Cliente avisou que não tem mais o plano TotalPass — para de receber mensagens"
                            className="text-xs border border-[#DDC7A4] text-[#392617] px-2 py-1.5 rounded-lg hover:bg-[#7E0000]/10 hover:text-[#7E0000] whitespace-nowrap">Sem plano</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
