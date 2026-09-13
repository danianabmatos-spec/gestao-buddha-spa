'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ItemPlano {
  key: string
  grupo: 'pacote' | 'freq' | 'totalpass'
  label: string
  pendentes: number
  aFazer: number
  destino: 'fila' | 'totalpass'
}
interface Plano {
  unidade: string
  cap: number
  enviadasHoje: number
  restante: number
  aFazer: number
  diasAtivos: number
  fimDeSemana: boolean
  itens: ItemPlano[]
}
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

export default function PlanoDiaPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [unidade, setUnidade] = useState('shopping-metropole')
  const [plano, setPlano] = useState<Plano | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d?.usuario) return
      setMe(d.usuario)
      if (d.usuario.perfil === 'RECEPCAO' && d.usuario.unidadeSlug) setUnidade(d.usuario.unidadeSlug)
    }).catch(() => {})
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/inteligencia/plano-dia?unidade=${unidade}`)
      if (r.ok) setPlano(await r.json())
    } finally { setLoading(false) }
  }, [unidade])

  useEffect(() => { carregar() }, [carregar])

  const fase = plano ? (plano.diasAtivos < 5 ? 'Aquecimento (semana 1)' : plano.diasAtivos < 10 ? 'Aquecimento (semana 2)' : 'Regime normal') : ''
  const pct = plano && plano.cap > 0 ? Math.min(100, Math.round((plano.enviadasHoje / plano.cap) * 100)) : 0
  const noLimite = plano ? plano.enviadasHoje >= plano.cap : false

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#392617]">Plano do Dia</h1>
          <p className="text-sm text-[#392617]/60 mt-0.5 capitalize">{dataHoje}</p>
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

      {plano?.fimDeSemana && (
        <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 rounded-xl px-5 py-3 text-sm text-[#7E0000]">
          🛌 Hoje é fim de semana — o ideal é <strong>não enviar mensagens</strong>. Retome na segunda-feira.
        </div>
      )}

      {/* Contador de teto */}
      <div className="bg-white rounded-xl border border-[#DDC7A4] p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-[#392617]/50 font-medium uppercase tracking-wide">Envios de hoje</p>
            <p className="text-sm text-[#392617]/60">{fase} · teto seguro de <strong>{plano?.cap ?? '—'}</strong> por dia</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: noLimite ? '#7E0000' : '#425F1D' }}>
              {plano?.enviadasHoje ?? 0}<span className="text-lg text-[#392617]/40"> / {plano?.cap ?? '—'}</span>
            </p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-[#DDC7A4]/30 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: noLimite ? '#7E0000' : '#425F1D' }} />
        </div>
        {noLimite && (
          <p className="text-xs text-[#7E0000] mt-2">⚠️ Você atingiu o teto do dia. Pare por hoje para proteger o número do WhatsApp — continue amanhã.</p>
        )}
      </div>

      {/* O que fazer hoje */}
      <div className="bg-white rounded-xl border border-[#DDC7A4] overflow-hidden">
        <div className="px-5 py-3.5 bg-[#425F1D]/8 border-b border-[#DDC7A4]/50 flex items-center gap-2">
          <span className="text-base">✅</span>
          <h2 className="font-semibold text-[#392617]">O que enviar hoje</h2>
          {plano && <span className="text-xs text-[#392617]/50 bg-[#DDC7A4]/30 px-2.5 py-0.5 rounded-full">{plano.aFazer} mensagens</span>}
        </div>

        {loading ? (
          <div className="py-10 text-center text-[#392617]/40 text-sm">Carregando…</div>
        ) : !plano || plano.itens.length === 0 ? (
          <div className="py-10 text-center text-[#392617]/50 text-sm">
            {plano && plano.restante <= 0 ? '🎉 Teto do dia atingido — nada mais a enviar hoje.' : '🎉 Nenhuma mensagem pendente no momento.'}
          </div>
        ) : (
          <div className="divide-y divide-[#DDC7A4]/30">
            {plano.itens.map((item) => (
              <div key={item.key} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#DDC7A4]/10">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-lg bg-[#7E0000] text-white text-sm font-bold">{item.aFazer}</span>
                  <div>
                    <p className="text-sm font-medium text-[#392617]">{item.label}</p>
                    <p className="text-xs text-[#392617]/50">{item.pendentes} pendentes no total</p>
                  </div>
                </div>
                <Link
                  href={
                    item.destino === 'totalpass'
                      ? `/inteligencia/totalpass?aba=${item.key === 'TP0' ? '0' : '1'}`
                      : `/inteligencia?grupo=${item.grupo === 'pacote' ? `PACOTE_${item.key}` : item.key}`
                  }
                  className="text-sm font-medium bg-[#7E0000] text-white px-4 py-2 rounded-lg hover:bg-[#680000] transition-colors whitespace-nowrap"
                >
                  {item.destino === 'totalpass' ? 'Ir ao TotalPass →' : 'Ir à fila →'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-[#392617]/40 px-1">
        💡 Envie nos horários de maior engajamento (10h–12h e 16h–18h), em 2 blocos. A ordem acima já prioriza os casos urgentes.
      </p>
    </div>
  )
}
