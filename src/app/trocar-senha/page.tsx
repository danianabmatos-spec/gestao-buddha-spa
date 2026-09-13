'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TrocarSenhaPage() {
  const router = useRouter()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (novaSenha !== confirmar) {
      setErro('A confirmação não confere com a nova senha')
      return
    }
    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter ao menos 8 caracteres')
      return
    }
    setCarregando(true)
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(d.error || 'Não foi possível trocar a senha')
        setCarregando(false)
        return
      }
      setOk(true)
      setTimeout(() => router.replace('/inteligencia'), 1500)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E4E5E2] p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#DDC7A4] shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-[#7E0000]">Trocar senha</h1>
          <p className="text-sm text-[#392617]/60 mt-1">Buddha Spa · Inteligência</p>
        </div>

        {ok ? (
          <p className="text-sm text-[#425F1D] bg-[#425F1D]/8 border border-[#425F1D]/20 rounded-lg px-3 py-3 text-center">
            ✓ Senha alterada com sucesso! Redirecionando…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#392617]/70 mb-1">Senha atual</label>
              <input
                type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)}
                autoComplete="current-password" required
                className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#392617]/70 mb-1">Nova senha</label>
              <input
                type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password" required minLength={8}
                className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
              />
              <p className="text-xs text-[#392617]/40 mt-1">Mínimo 8 caracteres</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#392617]/70 mb-1">Confirmar nova senha</label>
              <input
                type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password" required
                className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
              />
            </div>

            {erro && (
              <p className="text-sm text-[#7E0000] bg-[#7E0000]/8 border border-[#7E0000]/20 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button" onClick={() => router.replace('/inteligencia')}
                className="flex-1 border border-[#DDC7A4] text-[#392617] rounded-lg py-2.5 text-sm font-medium hover:bg-[#DDC7A4]/20 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={carregando}
                className="flex-1 bg-[#7E0000] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#680000] disabled:opacity-60 transition-colors"
              >
                {carregando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
