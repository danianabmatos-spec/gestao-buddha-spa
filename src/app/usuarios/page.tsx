'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, UserPlus, Trash2, Save, KeyRound, Loader2, Check } from 'lucide-react'

interface Un { id: number; slug: string; nome: string }
interface U { id: string; nome: string; email: string; perfil: string; ativo: boolean; unidades: Un[] }
type Escopo = 'total' | 'coord' | 'unidade'
interface P { chave: string; nome: string; sistema: boolean; superadmin: boolean; escopo: Escopo }
interface RhAlvo { id: string; nome: string; email: string; perfil: string }
interface ProvPlano { email: string; nome: string; cargo: string; perfilNome: string; escopo: string; unidadeSlugs: string[]; senhaTemp?: string }
interface ProvIgnorado { email: string; nome: string; cargo: string; motivo: string }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<U[]>([])
  const [unidades, setUnidades] = useState<Un[]>([])
  const [perfis, setPerfis] = useState<P[]>([])
  const [meuId, setMeuId] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', perfil: '', unidadeIds: [] as number[] })
  const [criando, setCriando] = useState(false)
  const [rhPrevia, setRhPrevia] = useState<{ rhIndisponivel: boolean; alvos: RhAlvo[] } | null>(null)
  const [rhUltima, setRhUltima] = useState<{ quando: string; quem: string; desativados: number } | null>(null)
  const [rhBusy, setRhBusy] = useState(false)
  const [prov, setProv] = useState<{ rhIndisponivel: boolean; criar: ProvPlano[]; ignorados: ProvIgnorado[] } | null>(null)
  const [provBusy, setProvBusy] = useState(false)
  const [provCriados, setProvCriados] = useState<ProvPlano[] | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch('/api/usuarios', { cache: 'no-store' })
      if (!r.ok) { setErro(r.status === 403 ? 'Acesso restrito (somente Dona).' : `Erro ${r.status}`); setUsuarios([]); return }
      const j = await r.json()
      setUsuarios(j.usuarios); setUnidades(j.unidades); setPerfis(j.perfis || []); setMeuId(j.meuId)
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
    try {
      const rr = await fetch('/api/rh/sincronizar-acessos', { cache: 'no-store' })
      if (rr.ok) { const rj = await rr.json(); setRhPrevia(rj.previa); setRhUltima(rj.ultima) }
    } catch { /* RH opcional */ }
    try {
      const pr = await fetch('/api/rh/provisionar', { cache: 'no-store' })
      if (pr.ok) { const pj = await pr.json(); setProv(pj.previa) }
    } catch { /* RH opcional */ }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function criarAcessosRH() {
    const criar = prov?.criar ?? []
    if (!criar.length) { alert('Nenhum acesso novo para criar.'); return }
    const lista = criar.map((c) => `• ${c.nome} — ${c.perfilNome}${c.unidadeSlugs.length ? ' (' + c.unidadeSlugs.join(', ') + ')' : ''}`).join('\n')
    if (!confirm(`Vai CRIAR ${criar.length} acesso(s) novo(s):\n\n${lista}\n\nAs senhas temporárias aparecerão na tela para você repassar (troca obrigatória no 1º acesso). Confirmar?`)) return
    setProvBusy(true); setErro(null)
    try {
      const r = await fetch('/api/rh/provisionar', { method: 'POST' })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Falha ao criar acessos'); return }
      setProvCriados(j.resultado.criar || [])
      await carregar()
    } finally { setProvBusy(false) }
  }

  async function sincronizarRH() {
    const alvos = rhPrevia?.alvos ?? []
    if (alvos.length === 0) { alert('Nenhum acesso a desligar — todos batem com o RH.'); return }
    const lista = alvos.map((a) => `• ${a.nome} (${a.email})`).join('\n')
    if (!confirm(`Vai DESATIVAR ${alvos.length} acesso(s) de colaboradores desligados no RH:\n\n${lista}\n\nConfirmar?`)) return
    setRhBusy(true); setErro(null)
    try {
      const r = await fetch('/api/rh/sincronizar-acessos', { method: 'POST' })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Falha ao sincronizar com o RH'); return }
      await carregar()
      alert(`${j.resultado.desativados} acesso(s) desativado(s).`)
    } finally { setRhBusy(false) }
  }

  const escopoNovo = perfis.find((p) => p.chave === novo.perfil)?.escopo
  const precisaUnidade = escopoNovo === 'coord' || escopoNovo === 'unidade'
  function toggleNovoUnidade(id: number) {
    setNovo((p) => {
      const has = p.unidadeIds.includes(id)
      if (escopoNovo === 'unidade') return { ...p, unidadeIds: has ? [] : [id] } // 1 só
      return { ...p, unidadeIds: has ? p.unidadeIds.filter((x) => x !== id) : [...p.unidadeIds, id] }
    })
  }

  async function criar() {
    if (!novo.perfil) { setErro('Selecione um perfil para o usuário.'); return }
    setErro(null); setCriando(true)
    try {
      const r = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo) })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro ao criar'); return }
      setNovo({ nome: '', email: '', senha: '', perfil: '', unidadeIds: [] })
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

      {/* Integração com o RH — desligamento automático de acessos */}
      <div className="mt-5 rounded-xl border border-[#DDC7A4] bg-white p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-[#7E0000]">Integração com o RH</div>
            <div className="text-xs text-[#392617]/70 mt-0.5">
              {rhPrevia?.rhIndisponivel
                ? 'RH indisponível no momento — nenhuma ação será tomada.'
                : (rhPrevia?.alvos.length ?? 0) > 0
                  ? `${rhPrevia!.alvos.length} acesso(s) de colaboradores desligados no RH prontos para desativar.`
                  : 'Todos os acessos batem com o RH — nada a desligar.'}
              {rhUltima && ` · Última sincronização: ${new Date(rhUltima.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${rhUltima.quem} (${rhUltima.desativados} desativados)`}
            </div>
          </div>
          <button onClick={sincronizarRH} disabled={rhBusy || !!rhPrevia?.rhIndisponivel}
            className={`text-sm px-4 py-2 rounded-lg shrink-0 disabled:opacity-40 ${(rhPrevia?.alvos.length ?? 0) > 0 ? 'bg-[#7E0000] text-[#DDC7A4] hover:bg-[#5c0000]' : 'border border-[#DDC7A4] text-[#7E0000] hover:bg-[#F5F0EB]'}`}>
            {rhBusy ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </div>

        {/* Criação automática de acessos (Etapa 2) */}
        <div className="mt-3 pt-3 border-t border-[#DDC7A4]/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-[#392617]/70">
            {prov?.rhIndisponivel
              ? 'RH indisponível.'
              : (prov?.criar.length ?? 0) > 0
                ? `${prov!.criar.length} colaborador(es) novo(s) do RH sem acesso — pronto(s) para criar.`
                : 'Nenhum acesso novo a criar (todos os colaboradores já têm login).'}
            {prov && prov.ignorados.length > 0 && ` · ${prov.ignorados.length} ignorado(s) (cargo sem perfil / perfil personalizado / sem unidade).`}
          </div>
          <button onClick={criarAcessosRH} disabled={provBusy || !(prov?.criar.length)}
            className={`text-sm px-4 py-2 rounded-lg shrink-0 disabled:opacity-40 ${(prov?.criar.length ?? 0) > 0 ? 'bg-[#425F1D] text-white hover:opacity-90' : 'border border-[#DDC7A4] text-[#7E0000] hover:bg-[#F5F0EB]'}`}>
            {provBusy ? 'Criando…' : 'Criar acessos novos'}
          </button>
        </div>
      </div>

      {/* Senhas temporárias dos acessos recém-criados (aparecem uma única vez) */}
      {provCriados && provCriados.length > 0 && (
        <div className="mt-3 rounded-xl border border-[#425F1D] bg-[#425F1D]/5 p-4">
          <div className="text-sm font-semibold text-[#425F1D] mb-2">
            ✓ {provCriados.length} acesso(s) criado(s) — anote/copie as senhas AGORA (não aparecem de novo):
          </div>
          <div className="divide-y divide-[#DDC7A4]/40">
            {provCriados.map((c) => (
              <div key={c.email} className="py-1.5 text-sm flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
                <span className="font-medium text-[#392617]">{c.nome}</span>
                <span className="text-xs text-[#392617]/70">{c.email}</span>
                <span className="text-xs text-[#7E0000]">{c.perfilNome}{c.unidadeSlugs.length ? ` · ${c.unidadeSlugs.join(', ')}` : ''}</span>
                <span className="ml-auto font-mono text-sm bg-white border border-[#DDC7A4] rounded px-2 py-0.5 select-all">{c.senhaTemp}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-[#392617]/60 mt-2">Cada pessoa troca a senha no primeiro acesso.</div>
        </div>
      )}

      {/* Novo usuário */}
      <div className="mt-5 rounded-xl border border-[#D78B18]/40 bg-[#FBF6EF] p-4">
        <div className="flex items-center gap-2 mb-3 text-[#7E0000] font-semibold text-sm"><UserPlus size={16} /> Novo usuário</div>
        <div className="grid md:grid-cols-4 gap-2">
          <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm" />
          <input placeholder="E-mail" value={novo.email} onChange={(e) => setNovo((p) => ({ ...p, email: e.target.value }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm" />
          <input placeholder="Senha" type="text" value={novo.senha} onChange={(e) => setNovo((p) => ({ ...p, senha: e.target.value }))} className="px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm" />
          <select value={novo.perfil} onChange={(e) => setNovo((p) => ({ ...p, perfil: e.target.value, unidadeIds: [] }))}
            className={`px-3 py-2 rounded-lg border bg-white text-sm ${novo.perfil ? 'border-[#DDC7A4]' : 'border-[#D78B18] text-[#392617]/60'}`}>
            <option value="">Selecione um perfil…</option>
            {perfis.map((p) => <option key={p.chave} value={p.chave}>{p.nome}{p.superadmin ? ' (acesso total)' : p.sistema ? '' : ' (personalizado)'}</option>)}
          </select>
        </div>
        {precisaUnidade && (
          <div className="mt-3">
            <div className="text-xs text-[#392617]/60 mb-1">{escopoNovo === 'unidade' ? 'Unidade (escolha 1):' : 'Unidades:'}</div>
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
        <button onClick={criar} disabled={criando || !novo.perfil} className="mt-3 px-4 py-2 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-sm font-medium hover:bg-[#5c0000] disabled:opacity-50 inline-flex items-center gap-2">
          {criando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Criar usuário
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#392617]/50"><Loader2 className="animate-spin mr-2" /> Carregando…</div>
      ) : (
        <div className="mt-5 space-y-2">
          {usuarios.map((u) => (
            <UserRow key={u.id} u={u} unidades={unidades} perfis={perfis} ehVoce={u.id === meuId} onChange={carregar} setErro={setErro} />
          ))}
        </div>
      )}
    </div>
  )
}

function UserRow({ u, unidades, perfis, ehVoce, onChange, setErro }: { u: U; unidades: Un[]; perfis: P[]; ehVoce: boolean; onChange: () => void; setErro: (s: string | null) => void }) {
  const [nome, setNome] = useState(u.nome)
  const [email, setEmail] = useState(u.email)
  const [perfil, setPerfil] = useState(u.perfil)
  const [ids, setIds] = useState<number[]>(u.unidades.map((x) => x.id))
  const [ativo, setAtivo] = useState(u.ativo)
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const escopo = perfis.find((p) => p.chave === perfil)?.escopo
  const precisa = escopo === 'coord' || escopo === 'unidade'

  function toggle(id: number) {
    if (escopo === 'unidade') setIds(ids.includes(id) ? [] : [id])
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
          {perfis.map((p) => <option key={p.chave} value={p.chave}>{p.nome}</option>)}
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
