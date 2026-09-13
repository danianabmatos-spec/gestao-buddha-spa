import { NextRequest } from 'next/server'

// Auth serviço-a-serviço para as rotas /api/erp/* — header `x-erp-key` deve bater
// com ERP_INTEGRATION_KEY (a mesma chave já compartilhada com a Central).
// Fail-closed: sem a chave configurada no ambiente, nega tudo.
export function autorizadoErp(req: NextRequest): boolean {
  const key = process.env.ERP_INTEGRATION_KEY
  if (!key) return false
  return req.headers.get('x-erp-key') === key
}
