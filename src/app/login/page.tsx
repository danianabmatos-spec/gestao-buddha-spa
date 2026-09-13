'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/inteligencia'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(d.error || 'Não foi possível entrar')
        setCarregando(false)
        return
      }
      router.replace(next)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E4E5E2] p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#DDC7A4] shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#7E0000]">Buddha Spa</h1>
          <p className="text-sm text-[#392617]/60 mt-1">Inteligência de Clientes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#392617]/70 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#392617]/70 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-[#DDC7A4] rounded-lg px-3 py-2 text-sm text-[#392617] focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
            />
          </div>

          {erro && (
            <p className="text-sm text-[#7E0000] bg-[#7E0000]/8 border border-[#7E0000]/20 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-[#7E0000] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#680000] disabled:opacity-60 transition-colors"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
