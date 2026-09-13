'use client'

import { useState } from 'react'
import { CheckCircle2, Upload, AlertCircle } from 'lucide-react'

export default function VouchersUploadPage() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setResultado(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const resp = await fetch('/api/vouchers/upload-html', {
        method: 'POST',
        body: formData,
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao processar')
      }

      setResultado(data)
      form.reset()
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-[#392617] mb-2">Upload de Vouchers</h1>
          <p className="text-sm text-muted-foreground">
            Faça upload dos arquivos HTML salvos da página de vouchers do WordPress
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#392617] mb-4">📋 Instruções</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-[#7E0000]">1.</span>
              <span>Acesse a página de vouchers no WordPress admin</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#7E0000]">2.</span>
              <span>Aplique os filtros conforme o tipo:</span>
            </li>
            <ul className="ml-6 space-y-1 mt-2">
              <li>• <strong>Site:</strong> Data de UTILIZAÇÃO (ex: 01/02/2026 a 28/02/2026)</li>
              <li>• <strong>Omnichannel:</strong> Data de VENDA (ex: 01/02/2026 a 28/02/2026)</li>
              <li>• <strong>Cortesia:</strong> Data de UTILIZAÇÃO (mesma do Site)</li>
            </ul>
            <li className="flex gap-2">
              <span className="font-semibold text-[#7E0000]">3.</span>
              <span>Clique com botão direito na página → "Salvar como" → Salve como HTML completo</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#7E0000]">4.</span>
              <span>Faça upload do arquivo abaixo</span>
            </li>
          </ol>
        </div>

        <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#392617] mb-2">
                Arquivo HTML
              </label>
              <input
                type="file"
                name="html"
                accept=".html,.htm"
                required
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#7E0000] file:text-white hover:file:bg-[#5E0000] cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#392617] mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  name="dataIni"
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#392617] mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  name="dataFim"
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#392617] mb-2">
                Tipo de Voucher
              </label>
              <select
                name="tipo"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="">Selecione...</option>
                <option value="site">Site (filtro por data de utilização)</option>
                <option value="omnichannel">Omnichannel (filtro por data de venda)</option>
                <option value="cortesia">Cortesia (filtro por data de utilização)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7E0000] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#5E0000] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>Processando...</>
              ) : (
                <>
                  <Upload size={18} />
                  Fazer Upload e Processar
                </>
              )}
            </button>
          </div>
        </form>

        {erro && (
          <div className="mt-6 bg-[#7E0000]/8 border border-[#7E0000]/20 text-[#7E0000] rounded-lg px-4 py-3 flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Erro</p>
              <p className="text-sm mt-1">{erro}</p>
            </div>
          </div>
        )}

        {resultado && (
          <div className="mt-6 bg-[#425F1D]/8 border border-[#425F1D]/20 text-[#425F1D] rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">✅ Upload concluído com sucesso!</p>
                <div className="text-sm mt-2 space-y-1">
                  <p><strong>Tipo:</strong> {resultado.tipo}</p>
                  <p><strong>Período:</strong> {resultado.periodo}</p>
                  <p><strong>Total:</strong> R$ {resultado.totalReembolso?.toFixed(2) || resultado.totalValor?.toFixed(2)}</p>
                  <p><strong>Vouchers:</strong> {resultado.totalVouchers}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
