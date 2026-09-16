'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Nivel = 'NENHUM' | 'VISUALIZAR' | 'EDITAR'
interface Func { chave: string; label: string; grupo: string }
interface Perfil { chave: string; nome: string; descricao: string; sistema: boolean; superadmin: boolean }
interface Matriz {
  grupos: string[]; funcionalidades: Func[]; perfis: Perfil[]
  niveis: Record<string, Record<string, Nivel>>
  pendentes: string[]
}
interface LogItem {
  id: number; quando: string; quem: string; acao: string; entidade: string
  dados: Record<string, unknown>
}

const NIVEL_OPCOES: { v: Nivel; l: string; cor: string }[] = [
  { v: 'NENHUM', l: 'Nenhum', cor: 'bg-[#7E0000] text-white' },
  { v: 'VISUALIZAR', l: 'Visualizar', cor: 'bg-[#D78B18] text-white' },
  { v: 'EDITAR', l: 'Editar', cor: 'bg-[#425F1D] text-white' },
]

export default function AcessosPage() {
  const [matriz, setMatriz] = useState<Matriz | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [perfilSel, setPerfilSel] = useState<string>('')
  const [niveisEdit, setNiveisEdit] = useState<Record<string, Nivel>>({})
  const [dirty, setDirty] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoCopiar, setNovoCopiar] = useState('')
  const [marcando, setMarcando] = useState(false)
  const [auditoria, setAuditoria] = useState<LogItem[] | null>(null)
  const [auditAberto, setAuditAberto] = useState(false)

  const carregar = useCallback(async (selecionar?: string) => {
    setErro(null)
    const r = await fetch('/api/permissoes')
    if (!r.ok) { setErro(r.status === 403 ? 'Acesso restrito à Dona.' : 'Erro ao carregar permissões.'); return }
    const j: Matriz = await r.json()
    setMatriz(j)
    const alvo = selecionar || perfilSel || j.perfis.find(p => !p.superadmin)?.chave || j.perfis[0]?.chave || ''
    setPerfilSel(alvo)
    setNiveisEdit({ ...(j.niveis[alvo] || {}) })
    setDirty(false)
  }, [perfilSel])

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selecionarPerfil = (chave: string) => {
    if (dirty && !confirm('Há alterações não salvas. Descartar?')) return
    setPerfilSel(chave)
    setNiveisEdit({ ...(matriz?.niveis[chave] || {}) })
    setDirty(false)
  }

  const perfil = matriz?.perfis.find(p => p.chave === perfilSel)
  const editavel = !!perfil && !perfil.superadmin

  const setNivel = (func: string, nivel: Nivel) => {
    if (!editavel) return
    setNiveisEdit(n => ({ ...n, [func]: nivel }))
    setDirty(true)
  }

  const salvar = async () => {
    if (!editavel) return
    setSalvando(true)
    const r = await fetch('/api/permissoes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perfilChave: perfilSel, niveis: niveisEdit }),
    })
    setSalvando(false)
    if (r.ok) { setDirty(false); await carregar(perfilSel) }
    else { const e = await r.json().catch(() => ({})); alert(e.error || 'Falha ao salvar') }
  }

  const criarPerfil = async () => {
    if (!novoNome.trim()) return
    const r = await fetch('/api/permissoes/perfil', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoNome, copiarDe: novoCopiar || undefined }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) { setNovoAberto(false); setNovoNome(''); setNovoCopiar(''); await carregar(j.chave) }
    else alert(j.error || 'Falha ao criar perfil')
  }

  const removerPerfil = async () => {
    if (!perfil || perfil.sistema) return
    if (!confirm(`Remover o perfil "${perfil.nome}"?`)) return
    const r = await fetch('/api/permissoes/perfil', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave: perfil.chave }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) await carregar()
    else alert(j.error || 'Falha ao remover')
  }

  const labelFunc = (c: string) => matriz?.funcionalidades.find(f => f.chave === c)?.label || c
  const nomePerfil = (c: string) => matriz?.perfis.find(p => p.chave === c)?.nome || c

  const marcarPendentesRevisadas = async () => {
    if (!matriz?.pendentes?.length) return
    setMarcando(true)
    const r = await fetch('/api/permissoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chaves: matriz.pendentes }),
    })
    setMarcando(false)
    if (r.ok) await carregar(perfilSel)
    else { const e = await r.json().catch(() => ({})); alert(e.error || 'Falha ao marcar') }
  }

  const toggleAuditoria = async () => {
    const abrir = !auditAberto
    setAuditAberto(abrir)
    if (abrir && auditoria === null) {
      const r = await fetch('/api/permissoes/auditoria')
      if (r.ok) { const j = await r.json(); setAuditoria(j.itens || []) }
      else setAuditoria([])
    }
  }

  const resumoLog = (l: LogItem): string => {
    const d = l.dados || {}
    if (l.acao === 'PERMISSAO_EDITAR') {
      const nome = nomePerfil(String(d.perfilChave || ''))
      const niveis = (d.niveis && typeof d.niveis === 'object') ? d.niveis as Record<string, string> : {}
      const n = Object.keys(niveis).length
      return `Ajustou o perfil "${nome}" (${n} funcionalidade${n === 1 ? '' : 's'})`
    }
    if (l.acao === 'PERMISSAO_REVISAR') {
      const chaves = Array.isArray(d.chaves) ? (d.chaves as string[]) : []
      return `Revisou: ${chaves.map(labelFunc).join(', ')}`
    }
    if (l.acao === 'PERFIL_CRIAR') return `Criou o perfil "${String(d.nome || d.chave || '')}"`
    if (l.acao === 'PERFIL_EDITAR') return `Renomeou um perfil para "${String(d.nome || '')}"`
    if (l.acao === 'PERFIL_REMOVER') return `Removeu o perfil "${nomePerfil(String(d.chave || ''))}"`
    return l.acao
  }

  const fmtData = (s: string) => {
    try { return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    catch { return s }
  }

  return (
    <div className="min-h-screen bg-[#E4E5E2] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#7E0000] mb-1">Acessos & Permissões</h1>
            <p className="text-[#392617]/70">Defina o que cada perfil pode ver e editar em cada funcionalidade.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleAuditoria} className="text-sm px-4 py-2 rounded-lg border border-[#DDC7A4] text-[#7E0000] hover:bg-white">
              {auditAberto ? 'Ocultar histórico' : 'Histórico de mudanças'}
            </button>
            <Link href="/usuarios" className="text-sm px-4 py-2 rounded-lg border border-[#DDC7A4] text-[#7E0000] hover:bg-white">
              Gerenciar usuários →
            </Link>
          </div>
        </div>

        {/* Banner: funcionalidades novas ainda não configuradas */}
        {matriz && matriz.pendentes.length > 0 && (
          <div className="mb-5 rounded-lg border border-[#D78B18] bg-[#D78B18]/10 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-[#7E0000]">
                  {matriz.pendentes.length} nova{matriz.pendentes.length === 1 ? '' : 's'} funcionalidade{matriz.pendentes.length === 1 ? '' : 's'} sem acesso definido
                </div>
                <div className="text-sm text-[#392617]/80 mt-1">
                  Por segurança, {matriz.pendentes.length === 1 ? 'ela começa' : 'elas começam'} bloqueada{matriz.pendentes.length === 1 ? '' : 's'} para todos (exceto você). Defina os níveis em cada perfil e depois confirme:
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {matriz.pendentes.map(c => (
                    <span key={c} className="text-xs px-2 py-1 rounded bg-white border border-[#D78B18]/40 text-[#7E0000]">{labelFunc(c)}</span>
                  ))}
                </div>
              </div>
              <button onClick={marcarPendentesRevisadas} disabled={marcando}
                className="text-sm px-4 py-2 rounded-lg bg-[#7E0000] text-white disabled:opacity-40 shrink-0">
                {marcando ? 'Confirmando…' : 'Marcar como revisadas'}
              </button>
            </div>
          </div>
        )}

        {/* Painel: histórico de mudanças (auditoria) */}
        {auditAberto && (
          <div className="mb-5 bg-white rounded-lg shadow p-4">
            <div className="text-xs font-semibold text-[#392617]/60 uppercase mb-3">Histórico de mudanças (últimas 100)</div>
            {auditoria === null ? (
              <div className="text-sm text-[#392617]/60">Carregando…</div>
            ) : auditoria.length === 0 ? (
              <div className="text-sm text-[#392617]/60">Nenhuma mudança registrada ainda.</div>
            ) : (
              <div className="divide-y divide-[#DDC7A4]/30">
                {auditoria.map(l => (
                  <div key={l.id} className="py-2 flex items-baseline justify-between gap-3">
                    <span className="text-sm text-[#392617]">{resumoLog(l)}</span>
                    <span className="text-xs text-[#392617]/50 shrink-0">{l.quem} · {fmtData(l.quando)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {erro ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-[#7E0000]">{erro}</div>
        ) : !matriz ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-[#392617]/70">Carregando…</div>
        ) : (
          <div className="grid md:grid-cols-[240px_1fr] gap-6">
            {/* Perfis */}
            <div className="bg-white rounded-lg shadow p-3 h-fit">
              <div className="text-xs font-semibold text-[#392617]/60 uppercase px-2 mb-2">Perfis</div>
              {matriz.perfis.map(p => (
                <button key={p.chave} onClick={() => selecionarPerfil(p.chave)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm ${perfilSel === p.chave ? 'bg-[#7E0000] text-white' : 'hover:bg-[#DDC7A4]/20 text-[#392617]'}`}>
                  {p.nome}
                  {p.superadmin && <span className="block text-[10px] opacity-70">acesso total</span>}
                  {!p.sistema && <span className="block text-[10px] opacity-70">personalizado</span>}
                </button>
              ))}
              <button onClick={() => setNovoAberto(v => !v)} className="w-full mt-2 text-sm px-3 py-2 rounded-lg border border-dashed border-[#DDC7A4] text-[#7E0000] hover:bg-[#DDC7A4]/10">
                + Novo perfil
              </button>
              {novoAberto && (
                <div className="mt-2 p-2 border border-[#DDC7A4] rounded-lg">
                  <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome do perfil"
                    className="w-full text-sm px-2 py-1 border border-[#DDC7A4] rounded mb-2" />
                  <select value={novoCopiar} onChange={e => setNovoCopiar(e.target.value)} className="w-full text-xs px-2 py-1 border border-[#DDC7A4] rounded mb-2">
                    <option value="">Começar do zero</option>
                    {matriz.perfis.filter(p => !p.superadmin).map(p => <option key={p.chave} value={p.chave}>Copiar de: {p.nome}</option>)}
                  </select>
                  <button onClick={criarPerfil} className="w-full text-sm px-3 py-1.5 rounded bg-[#7E0000] text-white">Criar</button>
                </div>
              )}
            </div>

            {/* Matriz do perfil selecionado */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-[#DDC7A4]/40 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-semibold text-[#7E0000]">{perfil?.nome}</div>
                  {perfil?.descricao && <div className="text-xs text-[#392617]/60">{perfil.descricao}</div>}
                  {perfil?.superadmin && <div className="text-xs text-[#425F1D] mt-0.5">Super-admin — acesso total (não editável).</div>}
                </div>
                <div className="flex items-center gap-2">
                  {perfil && !perfil.sistema && (
                    <button onClick={removerPerfil} className="text-sm px-3 py-2 rounded-lg border border-[#DDC7A4] text-[#7E0000] hover:bg-[#DDC7A4]/10">Remover</button>
                  )}
                  {editavel && (
                    <button onClick={salvar} disabled={!dirty || salvando}
                      className="text-sm px-5 py-2 rounded-lg bg-[#7E0000] text-white disabled:opacity-40">
                      {salvando ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Salvo'}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                {matriz.grupos.map(grupo => {
                  const funcs = matriz.funcionalidades.filter(f => f.grupo === grupo)
                  if (!funcs.length) return null
                  return (
                    <div key={grupo} className="mb-5">
                      <div className="text-xs font-semibold text-[#392617]/60 uppercase mb-2">{grupo}</div>
                      <div className="space-y-1">
                        {funcs.map(f => {
                          const atual = editavel ? (niveisEdit[f.chave] ?? 'NENHUM') : 'EDITAR'
                          return (
                            <div key={f.chave} className="flex items-center justify-between gap-3 py-1.5 border-b border-[#DDC7A4]/20">
                              <span className="text-sm text-[#392617]">{f.label}</span>
                              <div className="flex rounded-lg overflow-hidden border border-[#DDC7A4] shrink-0">
                                {NIVEL_OPCOES.map(op => (
                                  <button key={op.v} disabled={!editavel} onClick={() => setNivel(f.chave, op.v)}
                                    className={`text-xs px-3 py-1.5 ${atual === op.v ? op.cor : 'bg-white text-[#392617]/50'} ${editavel ? 'hover:opacity-90' : 'cursor-default'}`}>
                                    {op.l}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
