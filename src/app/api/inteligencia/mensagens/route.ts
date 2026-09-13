import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/auth/guard'
import { CLUSTERS_MENSAGEM, CLUSTERS_VALIDOS } from '@/lib/inteligencia/mensagens'

export const dynamic = 'force-dynamic'

// GET — lista todos os clusters com o texto efetivo (edição salva ou padrão).
// Disponível para qualquer usuário logado (a recepção precisa para enviar).
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const salvos = await prisma.templateMensagem.findMany()
  const mapa = new Map(salvos.map((t) => [t.cluster, t]))

  const itens = CLUSTERS_MENSAGEM.map((c) => {
    const salvo = mapa.get(c.cluster)
    return {
      cluster: c.cluster,
      label: c.label,
      descricao: c.descricao,
      variaveis: c.variaveis,
      padrao: c.padrao,
      texto: salvo?.texto ?? c.padrao,
      customizado: !!salvo,
      updatedAt: salvo?.updatedAt ?? null,
    }
  })

  return NextResponse.json({ itens, podeEditar: (session.perfil === 'DONA' || session.perfil === 'FINANCEIRO') })
}

// PUT — salva (ou restaura) o texto de um cluster. Apenas DONA.
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.perfil !== 'DONA') {
    return NextResponse.json({ error: 'Apenas a administradora pode editar as mensagens' }, { status: 403 })
  }

  const { cluster, texto, restaurar } = await req.json().catch(() => ({}))
  if (!cluster || !CLUSTERS_VALIDOS.has(cluster)) {
    return NextResponse.json({ error: 'Cluster inválido' }, { status: 400 })
  }

  // Restaurar padrão = remover a edição salva
  if (restaurar || !texto || !String(texto).trim()) {
    await prisma.templateMensagem.deleteMany({ where: { cluster } })
    const padrao = CLUSTERS_MENSAGEM.find((c) => c.cluster === cluster)!.padrao
    return NextResponse.json({ ok: true, cluster, texto: padrao, customizado: false })
  }

  const salvo = await prisma.templateMensagem.upsert({
    where: { cluster },
    create: { cluster, texto: String(texto) },
    update: { texto: String(texto) },
  })

  return NextResponse.json({ ok: true, cluster, texto: salvo.texto, customizado: true, updatedAt: salvo.updatedAt })
}
