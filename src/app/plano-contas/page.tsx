'use client'

import { useCallback, useEffect, useState } from 'react'
import { ListTree, Plus, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react'

interface Conta { id: number; nome: string; tipo: string; tipoDespesa: string }
const TIPOS = ['A Pagar', 'A Receber']
const TIPOS_DESPESA = ['', 'Fixa', 'Variavel']

export default function PlanoContasPage() {
  const [contas, setContas] = useState<Conta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [podeEditar, setPodeEditar] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ nome: string; tipo: string; tipoDespesa: string }>({ nome: '', tipo: '', tipoDespesa: '' })
  const [confirmaExcluir, setConfirmaExcluir] = useState<number | null>(null)
  const [novo, setNovo] = useState(false)
  const [formNovo, setFormNovo] = useState({ nome: '', tipo: 'A Pagar', tipoDespesa: '' })

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch('/api/plano-contas')
      const j = await r.json()
      if (!r.ok || j.error) { setErro(j.error || 'Erro'); return }
      setContas(j.contas)
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [])

  useEffect(() => {
    carregar()
    // Edição só para os proprietários (perfil DONA = Daniana + Felipe).
    fetch('/api/auth/permissoes').then(r => r.ok ? r.json() : null).then(j => {
      setPodeEditar(j?.perfil === 'DONA')
    }).catch(() => {})
  }, [carregar])

  const criar = async () => {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/plano-contas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formNovo) })
      const j = await r.json(); if (!r.ok || j.error) { setErro(j.error || 'Erro ao criar'); return }
      setNovo(false); setFormNovo({ nome: '', tipo: 'A Pagar', tipoDespesa: '' }); await carregar()
    } finally { setSalvando(false) }
  }

  const salvarEdicao = async () => {
    if (editId == null) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch('/api/plano-contas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...editForm }) })
      const j = await r.json(); if (!r.ok || j.error) { setErro(j.error || 'Erro ao salvar'); return }
      setEditId(null); await carregar()
    } finally { setSalvando(false) }
  }

  const excluir = async (id: number) => {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/plano-contas?id=${id}`, { method: 'DELETE' })
      const j = await r.json(); if (!r.ok || j.error) { setErro(j.error || 'Erro ao excluir'); return }
      setConfirmaExcluir(null)
      if (j.soft) setErro(`Conta em uso em ${j.usos} lançamento(s) — foi desativada (sai da lista, histórico preservado).`)
      await carregar()
    } finally { setSalvando(false) }
  }

  const iniciarEdicao = (c: Conta) => { setEditId(c.id); setEditForm({ nome: c.nome, tipo: c.tipo, tipoDespesa: c.tipoDespesa }); setConfirmaExcluir(null) }

  const aReceber = contas.filter(c => c.tipo === 'A Receber')
  const aPagar = contas.filter(c => c.tipo !== 'A Receber')

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <ListTree className="text-[#7E0000]" size={24} />
        <h1 className="text-2xl font-bold text-[#7E0000]">Plano de Contas</h1>
      </div>
      <p className="text-sm text-[#392617]/60 mb-5">
        {contas.length} contas — usadas para classificar entradas e saídas e organizar a DRE.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={carregar} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-md border border-[#7E0000]/30 text-[#7E0000] hover:bg-[#7E0000]/5 px-3 py-1.5 text-sm">
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
        {podeEditar && (
          <button onClick={() => setNovo(v => !v)} className="inline-flex items-center gap-1.5 rounded-md bg-[#7E0000] hover:bg-[#5c0000] text-white px-3 py-1.5 text-sm font-medium ml-auto">
            <Plus size={15} /> Nova conta
          </button>
        )}
      </div>

      {erro && <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 text-sm mb-4">{erro}</div>}

      {novo && podeEditar && (
        <div className="rounded-xl border border-[#DDC7A4]/60 bg-white p-4 mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-[#392617]/70 flex-1 min-w-[200px]">Nome da conta
            <input value={formNovo.nome} onChange={e => setFormNovo({ ...formNovo, nome: e.target.value })} className="mt-1 w-full rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm" placeholder="Ex.: Outras Receitas Financeiras" />
          </label>
          <label className="text-xs text-[#392617]/70">Tipo
            <select value={formNovo.tipo} onChange={e => setFormNovo({ ...formNovo, tipo: e.target.value })} className="mt-1 block rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm bg-white">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#392617]/70">Tipo de despesa
            <select value={formNovo.tipoDespesa} onChange={e => setFormNovo({ ...formNovo, tipoDespesa: e.target.value })} className="mt-1 block rounded-md border border-[#DDC7A4] px-2 py-1.5 text-sm bg-white">
              <option value="">—</option><option value="Fixa">Fixa</option><option value="Variavel">Variável</option>
            </select>
          </label>
          <button onClick={criar} disabled={salvando || !formNovo.nome.trim()} className="rounded-md bg-[#7E0000] hover:bg-[#5c0000] disabled:opacity-50 text-white px-4 py-1.5 text-sm font-medium">Salvar</button>
          <button onClick={() => setNovo(false)} className="rounded-md text-[#392617]/60 hover:bg-[#392617]/5 px-3 py-1.5 text-sm">Cancelar</button>
        </div>
      )}

      <Bloco titulo="A Receber" cor="#425F1D" contas={aReceber} {...{ podeEditar, editId, editForm, setEditForm, iniciarEdicao, salvarEdicao, setEditId, confirmaExcluir, setConfirmaExcluir, excluir, salvando }} />
      <div className="mt-8">
        <Bloco titulo="A Pagar" cor="#7E0000" contas={aPagar} {...{ podeEditar, editId, editForm, setEditForm, iniciarEdicao, salvarEdicao, setEditId, confirmaExcluir, setConfirmaExcluir, excluir, salvando }} />
      </div>
    </div>
  )
}

function Bloco(props: {
  titulo: string; cor: string; contas: Conta[]; podeEditar: boolean
  editId: number | null; editForm: { nome: string; tipo: string; tipoDespesa: string }
  setEditForm: (f: { nome: string; tipo: string; tipoDespesa: string }) => void
  iniciarEdicao: (c: Conta) => void; salvarEdicao: () => void; setEditId: (n: number | null) => void
  confirmaExcluir: number | null; setConfirmaExcluir: (n: number | null) => void
  excluir: (id: number) => void; salvando: boolean
}) {
  const { titulo, cor, contas, podeEditar, editId, editForm, setEditForm, iniciarEdicao, salvarEdicao, setEditId, confirmaExcluir, setConfirmaExcluir, excluir, salvando } = props
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: cor }}>
        {titulo} <span className="text-[#392617]/40">({contas.length})</span>
      </h2>
      <div className="rounded-xl border border-[#DDC7A4]/60 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="bg-[#E4E5E2] text-left text-[#7E0000] text-xs uppercase tracking-wide">
              <th className="px-4 py-2.5">Conta</th>
              <th className="px-4 py-2.5 text-center w-32">Tipo de despesa</th>
              {podeEditar && <th className="px-4 py-2.5 text-right w-28">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => editId === c.id ? (
              <tr key={c.id} className="border-t border-[#DDC7A4]/40 bg-[#D78B18]/[0.06]">
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <input value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} className="flex-1 rounded border border-[#DDC7A4] px-2 py-1 text-sm" />
                    <select value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })} className="rounded border border-[#DDC7A4] px-1.5 py-1 text-xs bg-white">
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <select value={editForm.tipoDespesa} onChange={e => setEditForm({ ...editForm, tipoDespesa: e.target.value })} className="rounded border border-[#DDC7A4] px-1.5 py-1 text-xs bg-white">
                    <option value="">—</option><option value="Fixa">Fixa</option><option value="Variavel">Variável</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={salvarEdicao} disabled={salvando} title="Salvar" className="text-[#425F1D] hover:bg-[#425F1D]/10 rounded p-1"><Check size={16} /></button>
                  <button onClick={() => setEditId(null)} title="Cancelar" className="text-[#392617]/50 hover:bg-[#392617]/5 rounded p-1"><X size={16} /></button>
                </td>
              </tr>
            ) : (
              <tr key={c.id} className="border-t border-[#DDC7A4]/40">
                <td className="px-4 py-2 text-[#392617]">{c.nome}</td>
                <td className="px-4 py-2 text-center">
                  {c.tipoDespesa ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.tipoDespesa === 'Fixa' ? 'bg-[#7E0000]/10 text-[#7E0000]' : 'bg-[#D78B18]/15 text-[#D78B18]'}`}>{c.tipoDespesa}</span>
                  ) : <span className="text-[#392617]/30">—</span>}
                </td>
                {podeEditar && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {confirmaExcluir === c.id ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="text-[#7E0000]">Excluir?</span>
                        <button onClick={() => excluir(c.id)} disabled={salvando} className="text-[#7E0000] font-medium hover:underline">Sim</button>
                        <button onClick={() => setConfirmaExcluir(null)} className="text-[#392617]/50 hover:underline">Não</button>
                      </span>
                    ) : (
                      <>
                        <button onClick={() => iniciarEdicao(c)} title="Alterar" className="text-[#392617]/60 hover:bg-[#392617]/5 rounded p-1"><Pencil size={15} /></button>
                        <button onClick={() => setConfirmaExcluir(c.id)} title="Excluir" className="text-[#7E0000]/70 hover:bg-[#7E0000]/10 rounded p-1"><Trash2 size={15} /></button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
