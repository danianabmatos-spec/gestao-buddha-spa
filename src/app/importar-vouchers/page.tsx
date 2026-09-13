'use client'

import { useState } from 'react'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ImportarVouchers() {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

  const importar = async () => {
    if (!html.trim()) {
      setErro('Cole os dados extraídos do WordPress')
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      // Tenta parsear como JSON primeiro
      let vouchers
      try {
        vouchers = JSON.parse(html)
      } catch {
        // Se não for JSON, tenta como HTML
        const resp = await fetch('/api/vouchers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataIni: '2026-06-01',
            dataFim: '2026-06-06',
            html,
          }),
        })
        const json = await resp.json()
        if (resp.ok) {
          setResultado(json)
          return
        } else {
          throw new Error(json.error || 'Erro ao processar HTML')
        }
      }

      // Se conseguiu parsear JSON, importa
      const resp = await fetch('/api/vouchers/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataIni: '2026-06-01',
          dataFim: '2026-06-06',
          vouchers,
        }),
      })

      const json = await resp.json()

      if (resp.ok) {
        setResultado(json)
      } else {
        setErro(json.error || 'Erro ao importar')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#7E0000]/10 rounded-lg">
              <Upload className="text-[#7E0000]" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#392617]">Importar Vouchers do WordPress</h1>
              <p className="text-sm text-muted-foreground">Cole o HTML da página de vouchers</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#392617] mb-2">
                📋 Passo a passo:
              </label>
              <ol className="text-sm text-muted-foreground space-y-2 bg-[#F5F0EB] p-4 rounded-lg">
                <li>1. Acesse: <strong>buddhaspa.com.br/wp-admin/admin.php?page=vouchers</strong></li>
                <li>2. Filtre por período: <strong>01/06/2026 a 06/06/2026</strong></li>
                <li>3. Abra o Console (F12 → Console)</li>
                <li>4. Execute o script: <code>extract-vouchers.js</code> (copiar do arquivo raiz)</li>
                <li>5. O JSON será copiado automaticamente</li>
                <li>6. Cole no campo abaixo e clique em <strong>Importar</strong></li>
              </ol>
              <div className="mt-3 p-3 bg-[#425F1D]/8 border border-[#425F1D]/20 rounded text-xs">
                <p className="font-semibold text-[#425F1D] mb-1">💡 Script de extração:</p>
                <p className="text-[#425F1D]">Veja o arquivo <code>extract-vouchers.js</code> na raiz do projeto</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#392617] mb-2">
                HTML da Página:
              </label>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="Cole o HTML completo da página aqui..."
                className="w-full h-64 p-4 border border-border rounded-lg font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#7E0000]"
              />
            </div>

            <button
              onClick={importar}
              disabled={loading || !html.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#7E0000] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#5c0000] disabled:opacity-50 transition-colors"
            >
              <Upload size={18} />
              {loading ? 'Importando...' : 'Importar Vouchers'}
            </button>

            {erro && (
              <div className="bg-[#7E0000]/8 border border-[#7E0000]/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-[#7E0000] shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-[#7E0000]">Erro na importação</p>
                  <p className="text-sm text-[#7E0000] mt-1">{erro}</p>
                </div>
              </div>
            )}

            {resultado && (
              <div className="bg-[#425F1D]/8 border border-[#425F1D]/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="text-[#425F1D]" size={20} />
                  <p className="font-semibold text-[#425F1D]">✓ Importação concluída!</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Reembolso:</span>
                    <p className="font-bold text-[#425F1D]">R$ {resultado.totalReembolso?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vouchers:</span>
                    <p className="font-bold text-[#425F1D]">{resultado.vouchers?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Validados:</span>
                    <p className="font-bold text-[#425F1D]">{resultado.totalValidados || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pendentes:</span>
                    <p className="font-bold text-[#425F1D]">{resultado.pendentesValidacao || 0}</p>
                  </div>
                </div>
                <a
                  href="/vouchers"
                  className="mt-4 block text-center bg-[#7E0000] text-white font-semibold py-2 px-4 rounded-lg hover:bg-[#5c0000] transition-colors"
                >
                  Ver Vouchers →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
