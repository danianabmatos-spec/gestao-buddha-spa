'use client'

import { useState } from 'react'

export default function TestVouchers() {
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testar = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/vouchers/auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataIni: '2026-06-01', dataFim: '2026-06-06' }),
      })
      const json = await resp.json()
      setResultado(json)
      console.log('Resultado:', json)
    } catch (e) {
      setResultado({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Teste API Vouchers</h1>
      <button
        onClick={testar}
        disabled={loading}
        style={{ padding: '1rem', fontSize: '16px', cursor: 'pointer' }}
      >
        {loading ? 'Testando...' : 'Testar API'}
      </button>

      {resultado && (
        <pre style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f5f5f5',
          overflow: 'auto',
          maxHeight: '600px'
        }}>
          {JSON.stringify(resultado, null, 2)}
        </pre>
      )}
    </div>
  )
}
