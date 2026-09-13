'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

interface Empresa {
  id: number
  razaoSocial: string
  cnpj: string
  nomeFantasia: string
  inscricaoEstadual: string
  inscricaoMunicipal: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  telefone: string
  emailFiscal: string
  unidadeSlug: string
  ativa: boolean
}
interface Un { slug: string; nome: string }

const VAZIA = {
  razaoSocial: '', cnpj: '', nomeFantasia: '', inscricaoEstadual: '', inscricaoMunicipal: '',
  logradouro: '', numero: '', complemento: '', bairro: '', cidade: 'São Paulo', uf: 'SP', cep: '', telefone: '', emailFiscal: '', unidadeSlug: '',
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [unidades, setUnidades] = useState<Un[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ ...VAZIA })
  const [novoAberto, setNovoAberto] = useState(false)
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch('/api/empresas', { cache: 'no-store' })
      if (!r.ok) { setErro(r.status === 403 ? 'Acesso restrito (somente Dona).' : `Erro ${r.status}`); setEmpresas([]); return }
      const j = await r.json()
      setEmpresas(j.empresas); setUnidades(j.unidades)
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function criar() {
    setErro(null); setCriando(true)
    try {
      const r = await fetch('/api/empresas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo) })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro ao criar'); return }
      setNovo({ ...VAZIA }); setNovoAberto(false)
      await carregar()
    } finally { setCriando(false) }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] w-full">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-[#7E0000] flex items-center justify-center text-[#DDC7A4]"><Building2 size={22} /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#392617]">Empresas</h1>
          <p className="text-xs text-[#392617]/60">Cadastro fiscal (razão social, CNPJ, endereço) por unidade</p>
        </div>
      </div>

      {erro && <div className="my-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{erro}</div>}

      {/* Nova empresa */}
      <div className="mt-5 rounded-xl border border-[#D78B18]/40 bg-[#FBF6EF]">
        <button onClick={() => setNovoAberto((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-[#7E0000] font-semibold text-sm">
          {novoAberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />} <Plus size={16} /> Nova empresa
        </button>
        {novoAberto && (
          <div className="px-4 pb-4">
            <CamposEmpresa dados={novo} unidades={unidades} onChange={(k, v) => setNovo((p) => ({ ...p, [k]: v }))} />
            <button onClick={criar} disabled={criando} className="mt-3 px-4 py-2 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-sm font-medium hover:bg-[#5c0000] disabled:opacity-50 inline-flex items-center gap-2">
              {criando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Criar empresa
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#392617]/50"><Loader2 className="animate-spin mr-2" /> Carregando…</div>
      ) : (
        <div className="mt-5 space-y-2">
          {empresas.length === 0 && <p className="text-sm text-[#392617]/50 px-1">Nenhuma empresa cadastrada ainda.</p>}
          {empresas.map((e) => (
            <EmpresaRow key={e.id} empresa={e} unidades={unidades} onChange={carregar} setErro={setErro} />
          ))}
        </div>
      )}
    </div>
  )
}

function CamposEmpresa({ dados, unidades, onChange }: { dados: any; unidades: Un[]; onChange: (k: string, v: string) => void }) {
  const inp = 'px-3 py-2 rounded-lg border border-[#DDC7A4] bg-white text-sm w-full'
  const lbl = 'text-[11px] text-[#392617]/60 mb-0.5 block'
  return (
    <div className="grid md:grid-cols-2 gap-2">
      <div className="md:col-span-2"><span className={lbl}>Razão social *</span><input className={inp} value={dados.razaoSocial} onChange={(e) => onChange('razaoSocial', e.target.value)} /></div>
      <div><span className={lbl}>CNPJ *</span><input className={inp} value={dados.cnpj} onChange={(e) => onChange('cnpj', e.target.value)} /></div>
      <div><span className={lbl}>Nome fantasia</span><input className={inp} value={dados.nomeFantasia} onChange={(e) => onChange('nomeFantasia', e.target.value)} /></div>
      <div><span className={lbl}>Inscrição Estadual (I.E.)</span><input className={inp} value={dados.inscricaoEstadual} onChange={(e) => onChange('inscricaoEstadual', e.target.value)} /></div>
      <div><span className={lbl}>Inscrição Municipal (CCM/IM)</span><input className={inp} value={dados.inscricaoMunicipal} onChange={(e) => onChange('inscricaoMunicipal', e.target.value)} /></div>
      <div><span className={lbl}>Logradouro</span><input className={inp} value={dados.logradouro} onChange={(e) => onChange('logradouro', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><span className={lbl}>Número</span><input className={inp} value={dados.numero} onChange={(e) => onChange('numero', e.target.value)} /></div>
        <div><span className={lbl}>CEP</span><input className={inp} value={dados.cep} onChange={(e) => onChange('cep', e.target.value)} /></div>
      </div>
      <div><span className={lbl}>Complemento</span><input className={inp} value={dados.complemento} onChange={(e) => onChange('complemento', e.target.value)} /></div>
      <div><span className={lbl}>Bairro</span><input className={inp} value={dados.bairro} onChange={(e) => onChange('bairro', e.target.value)} /></div>
      <div><span className={lbl}>Telefone</span><input className={inp} value={dados.telefone} onChange={(e) => onChange('telefone', e.target.value)} /></div>
      <div><span className={lbl}>E-mail fiscal</span><input className={inp} type="email" value={dados.emailFiscal} onChange={(e) => onChange('emailFiscal', e.target.value)} /></div>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <div><span className={lbl}>Cidade</span><input className={inp} value={dados.cidade} onChange={(e) => onChange('cidade', e.target.value)} /></div>
        <div><span className={lbl}>UF</span><input className={inp} maxLength={2} value={dados.uf} onChange={(e) => onChange('uf', e.target.value.toUpperCase())} /></div>
      </div>
      <div className="md:col-span-2">
        <span className={lbl}>Unidade vinculada</span>
        <select className={inp} value={dados.unidadeSlug} onChange={(e) => onChange('unidadeSlug', e.target.value)}>
          <option value="">— sem vínculo —</option>
          {unidades.map((u) => <option key={u.slug} value={u.slug}>{u.nome}</option>)}
        </select>
      </div>
    </div>
  )
}

function EmpresaRow({ empresa, unidades, onChange, setErro }: { empresa: Empresa; unidades: Un[]; onChange: () => void; setErro: (s: string | null) => void }) {
  const [dados, setDados] = useState(empresa)
  const [aberto, setAberto] = useState(false)
  const [busy, setBusy] = useState(false)

  async function salvar() {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${empresa.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro'); return }
      await onChange()
    } finally { setBusy(false) }
  }
  async function excluir() {
    if (!confirm(`Remover ${dados.nomeFantasia || dados.razaoSocial}?`)) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${empresa.id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!j.ok) { setErro(j.error || 'Erro'); return }
      await onChange()
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-[#DDC7A4] bg-white">
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {aberto ? <ChevronDown size={16} className="text-[#7E0000]" /> : <ChevronRight size={16} className="text-[#7E0000]" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#392617] truncate">{dados.nomeFantasia || dados.razaoSocial}</div>
          <div className="text-xs text-[#392617]/60 truncate">{dados.razaoSocial} · CNPJ {dados.cnpj}</div>
        </div>
      </button>
      {aberto && (
        <div className="px-4 pb-4 border-t border-[#DDC7A4]/40 pt-3">
          <CamposEmpresa dados={dados} unidades={unidades} onChange={(k, v) => setDados((p) => ({ ...p, [k]: v }))} />
          <div className="mt-3 flex items-center gap-2">
            <button onClick={salvar} disabled={busy} className="px-4 py-2 rounded-lg bg-[#7E0000] text-[#DDC7A4] text-sm hover:bg-[#5c0000] disabled:opacity-50 inline-flex items-center gap-2"><Save size={14} /> Salvar</button>
            <button onClick={excluir} disabled={busy} className="px-3 py-2 rounded-lg border border-[#7E0000] text-[#7E0000] text-sm hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"><Trash2 size={14} /> Remover</button>
          </div>
        </div>
      )}
    </div>
  )
}
