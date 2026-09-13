'use client'

import { useState, useEffect, useCallback } from 'react'
import { renderMensagem } from '@/lib/inteligencia/mensagens'

interface Item {
  cluster: string
  label: string
  descricao: string
  variaveis: string[]
  padrao: string
  texto: string
  customizado: boolean
  updatedAt: string | null
}

function previa(texto: string): string {
  return renderMensagem(texto, { nome: 'Maria Silva', dias: 7, sessoes: 5, validade: '2027-01-09' })
}

export default function MensagensPage() {
  const [itens, setItens] = useState<Item[]>([])
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [podeEditar, setPodeEditar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/inteligencia/mensagens')
      if (!r.ok) return
      const d = await r.json()
      setItens(d.itens)
      setPodeEditar(d.podeEditar)
      setRascunho(Object.fromEntries(d.itens.map((i: Item) => [i.cluster, i.texto])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(cluster: string, restaurar = false) {
    setSalvando(cluster)
    try {
      const body = restaurar
        ? { cluster, restaurar: true }
        : { cluster, texto: rascunho[cluster] }
      const r = await fetch('/api/inteligencia/mensagens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setItens(prev => prev.map(i => i.cluster === cluster
          ? { ...i, texto: d.texto, customizado: d.customizado, updatedAt: d.updatedAt ?? null }
          : i))
        setRascunho(prev => ({ ...prev, [cluster]: d.texto }))
        setSalvo(cluster)
        setTimeout(() => setSalvo(s => (s === cluster ? null : s)), 2000)
      }
    } finally {
      setSalvando(null)
    }
  }

  function inserirVar(cluster: string, v: string) {
    setRascunho(prev => ({ ...prev, [cluster]: (prev[cluster] ?? '') + v }))
  }

  if (loading) return <div className="p-6 text-[#392617]/40 text-sm">Carregando…</div>

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#392617]">Mensagens por Cluster</h1>
        <p className="text-sm text-[#392617]/60 mt-0.5">
          {podeEditar
            ? 'Edite os textos que a equipe envia. As mudanças valem para todas as unidades e ficam disponíveis na hora.'
            : 'Estes são os textos que a equipe envia por cluster. Somente a administradora pode editá-los.'}
        </p>
      </div>

      <div className="space-y-4">
        {itens.map((item) => {
          const valor = rascunho[item.cluster] ?? ''
          const alterado = valor !== item.texto
          return (
            <div key={item.cluster} className="bg-white rounded-xl border border-[#DDC7A4] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#DDC7A4]/50 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-[#392617]">{item.label}</h2>
                    {item.customizado && (
                      <span className="text-xs bg-[#425F1D]/10 text-[#425F1D] px-2 py-0.5 rounded-full font-medium">
                        personalizado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#392617]/50 mt-0.5">{item.descricao}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.variaveis.map(v => (
                    <button
                      key={v}
                      disabled={!podeEditar}
                      onClick={() => inserirVar(item.cluster, v)}
                      title={podeEditar ? `Inserir ${v}` : v}
                      className="text-xs font-mono bg-[#DDC7A4]/25 text-[#7E0000] px-2 py-1 rounded-md border border-[#DDC7A4] disabled:opacity-60 enabled:hover:bg-[#DDC7A4]/45 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <textarea
                  value={valor}
                  onChange={e => setRascunho(prev => ({ ...prev, [item.cluster]: e.target.value }))}
                  readOnly={!podeEditar}
                  rows={4}
                  className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#7E0000] read-only:bg-[#DDC7A4]/10 read-only:cursor-default resize-y"
                />

                <div className="bg-[#DDC7A4]/12 border border-[#DDC7A4]/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[#392617]/40 font-medium mb-1">Prévia (exemplo: Maria, 7 dias)</p>
                  <p className="text-sm text-[#392617]/80 whitespace-pre-wrap">{previa(valor)}</p>
                </div>

                {podeEditar && (
                  <div className="flex items-center gap-2 justify-end">
                    {salvo === item.cluster && (
                      <span className="text-xs text-[#425F1D] mr-auto">✓ Salvo</span>
                    )}
                    <button
                      onClick={() => salvar(item.cluster, true)}
                      disabled={salvando === item.cluster || !item.customizado}
                      className="text-xs border border-[#DDC7A4] text-[#392617] px-3 py-2 rounded-lg hover:bg-[#DDC7A4]/20 disabled:opacity-40 transition-colors"
                    >
                      Restaurar padrão
                    </button>
                    <button
                      onClick={() => salvar(item.cluster)}
                      disabled={salvando === item.cluster || !alterado || !valor.trim()}
                      className="text-sm bg-[#7E0000] text-white px-4 py-2 rounded-lg hover:bg-[#680000] disabled:opacity-40 transition-colors"
                    >
                      {salvando === item.cluster ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
