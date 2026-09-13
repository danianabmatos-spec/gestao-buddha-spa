'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, UserPlus, Trash2, Save, KeyRound, Loader2, Check } from 'lucide-react'

interface Un { id: number; slug: string; nome: string }
interface U { id: string; nome: string; email: string; perfil: string; ativo: boolean; unidades: Un[] }

const PERFIS = [
  { v: 'DONA', l: 'Dona (acesso total)' },
  { v: 'COORDENACAO', l: 'Coordenação' },
  { v: 'RECEPCAO', l: 'Recepção' },
  { v: 'FINANCEIRO', l: 'Financeiro' },
  { v: 'RH', l: 'RH' },
]
const perfilLabel = (v: string) => PERFIS.find((p) => p.v === v)?.l ?? v

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<U[]>([])
  const [unidades, setUnidades] = useState<Un[]>([])
  const [meuId, setMeuId] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', perfil: 'RECEPCAO', unidadeIds: [] as number[] })
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch('/api/usuarios', { cache: 'no-store' })
      if (!r.ok) { setErro(r.status === 403 ? 'Acesso restrito (somente Dona).' : `Erro ${r.status}`); setUsuarios([]); return }
      const j = await r.json()
      setUsuarios(j.usuarios); setUnidades(j.unidades); setMeuId(j.meuId)
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const precisaUnidade = novo.perfil === 'RECEPCAO' || novo.perfil === 'COORDENACAO'
  function toggleNovoUnidade(id: number) {
    setNovo((p) => {
      const has = p.unidadeIds.includes(id)
      if (p.perfil === 'RECEPCAO') return { ...p, unidadeIds: has ? [] : [id] } // recepção = 1 só
      return { ...p, unidadeIds: has ? p.unidadeIds.filter((x) => x !== id) : [...p.unidadeIds, id] }
    })
  }

  async function criar() {
    setErro(null); setCriando(true)
    try {
      const r = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo) })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro ao criar'); return }
      setNovo({ nome: '', email: '', senha: '', perfil: 'RECEPCAO', unidadeIds: [] })
      await carregar()
    } finally { setCriando(false) }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1000px] w-full">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-[#7E0000] flex items-center justify-center text-[#DDC7A4]"><Users size={22} /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#392617]">Acessos & Permissões</h1>
          <p className="text-xs text-[#392617]/60">Usuários do sistema, perfis e unidades</p>
        </div>
      </div>

      {erro && <div className="my-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{erro}</div>}

      {/* Novo usuário */}
      <div className="mt-5 rounded-xl border border-[#D78B18]/40 bg-[#FBF6EF] p-4">
        <div className="flex items-center gap-2 mb-3 text-[#7E0000] font-semibold text-sm"><UserPlus size={16} /> Novo usuário</div>
        <div className="grid md:grid-cols-4 gap-2">
          <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm" />
          <input placeholder="E-mail" value={novo.email} onChange={(e) => setNovo((p) => ({ ...p, email: e.target.value }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm" />
          <input placeholder="Senha" type="text" value={novo.senha} onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm" />
          <select value={novo.perfil} onChange={(e) => setNovo((p) => ({ ...p, perfil: e.target.value, unidadeIds: [] }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm">
            {PERFIS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
        {precisaUnidade && (
          <div className="mt-3">
            <div className="text-xs text-[#392617]/60 mb-1">{novo.perfil === 'RECEPCAO' ? 'Unidade (escolha 1):' : 'Unidades:'}</div>
            <div className="flex flex-wrap gap-2">
              {unidades.map((u) => (
                <label key={u.id} className={`text-xs px-2 py-1 rounded-lg border cursor-pointer ${novo.unidadeIds.includes(u.id) ? 'bg-[#7E0000] text-[#DDC7A4] border-[#7E0000]' : 'bg-white border-[#DDC7A4] text-[#392617]'}`}>
                  <input type="checkbox" className="hidden" checked={novo.unidadeIds.includes(u.id)} onChange={() => toggleNovoUnidade(u.id)} />
                  {u.nome}
                </label>
              ))}
            </div>
          </div>
        )}
        <button onClick={criar} disabled={criando} className="mt-3 px-4 py-2 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-sm font-medium hover:bg-[#5c0000] disabled:opacity-50 inline-flex items-center gap-2">
          {criando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Criar usuário
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#392617]/50"><Loader2 className="animate-spin mr-2" /> Carregando…</div>
      ) : (
        <div className="mt-5 space-y-2">
          {usuarios.map((u) => (
            <UserRow key={u.id} u={u} unidades={unidades} ehVoce={u.id === meuId} onChange={carregar} setErro={setErro} />
          ))}
        </div>
      )}
    </div>
  )
}

function UserRow({ u, unidades, ehVoce, onChange, setErro }: { u: U; unidades: Un[]; ehVoce: boolean; onChange: () => void; setErro: (s: string | null) => void }) {
  const [nome, setNome] = useState(u.nome)
  const [email, setEmail] = useState(u.email)
  const [perfil, setPerfil] = useState(u.perfil)
  const [ids, setIds] = useState<number[]>(u.unidades.map((x) => x.id))
  const [ativo, setAtivo] = useState(u.ativo)
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const precisa = perfil === 'RECEPCAO' || perfil === 'COORDENACAO'

  function toggle(id: number) {
    if (perfil === 'RECEPCAO') setIds(ids.includes(id) ? [] : [id])
    else setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  async function patch(body: Record<string, unknown>, msgOk?: string) {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/usuarios/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro'); return }
      if (msgOk) setSenha('')
      await onChange()
    } finally { setBusy(false) }
  }
  async function excluir() {
    if (!confirm(`Remover ${u.nome}?`)) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro'); return }
      await onChange()
    } finally { setBusy(false) }
  }

  return (
    <div className={`rounded-xl border bg-white p-3 ${ativo ? 'border-[#DDC7A4]' : 'border-[#DDC7A4] opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] space-y-1">
          <div className="flex items-center gap-1">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-2 py-1 rounded border border-[#DDC7A4] text-sm font-medium text-[#392617] focus:border-[#D78B18] focus:outline-none" />
            {ehVoce && <span className="text-[10px] text-[#D78B18] whitespace-nowrap">(você)</span>}
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail" className="w-full px-2 py-1 rounded border border-[#DDC7A4] text-xs text-[#392617]/80 focus:border-[#D78B18] focus:outline-none" />
        </div>
        <select value={perfil} onChange={(e) => { setPerfil(e.target.value); setIds([]) }} className="px-2 py-1.5 rounded-lg border border-[#DDC7A4] bg-white text-xs">
          {PERFIS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-[#392617] cursor-pointer">
          <input type="checkbox" checked={ativo} onChange={(e) => { setAtivo(e.target.checked); patch({ ativo: e.target.checked }) }} disabled={ehVoce} className="accent-[#425F1D]" /> ativo
        </label>
        <button onClick={() => patch({ nome, email, perfil, unidadeIds: ids })} disabled={busy} className="ml-auto px-3 py-1.5 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-xs hover:bg-[#5c0000] disabled:opacity-50 inline-flex items-center gap-1"><Save size={13} /> Salvar</button>
        {!ehVoce && <button onClick={excluir} disabled={busy} className="px-2 py-1.5 rounded-lg border border-[#7E0000] text-[#7E0000] text-xs hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} /></button>}
      </div>
      {precisa && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unidades.map((un) => (
            <label key={un.id} className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer ${ids.includes(un.id) ? 'bg-[#425F1D] text-white border-[#425F1D]' : 'bg-white border-[#DDC7A4] text-[#392617]'}`}>
              <input type="checkbox" className="hidden" checked={ids.includes(un.id)} onChange={() => toggle(un.id)} /> {un.nome}
            </label>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <KeyRound size={13} className="text-[#392617]/40" />
        <input placeholder="nova senha (resetar)" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-48 px-2 py-1 rounded border border-[#DDC7A4] text-xs" />
        <button onClick={() => senha.length >= 4 ? patch({ senha }, 'ok') : setErro('Senha mín. 4 caracteres.')} disabled={busy || !senha} className="px-2 py-1 rounded border border-[#D78B18] text-[#7E0000] text-xs hover:bg-[#F5F0EB] disabled:opacity-40 inline-flex items-center gap-1"><Check size={12} /> Resetar senha</button>
      </div>
    </div>
  )
}
