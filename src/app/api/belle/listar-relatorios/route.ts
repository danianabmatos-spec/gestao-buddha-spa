import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/belle/client-auth'

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const unidade = searchParams.get('unidade') ?? 'analia-franco'

    // Credenciais da unidade
    const UNIDADES: Record<string, { email: string; senha: string; estab: string }> = {
      'analia-franco': {
        email: process.env.BELLE_ANALIA_FRANCO_EMAIL!,
        senha: process.env.BELLE_ANALIA_FRANCO_PASSWORD!,
        estab: '1',
      },
      'shopping-analia-franco': {
        email: process.env.BELLE_SHOPPING_ANALIA_FRANCO_EMAIL!,
        senha: process.env.BELLE_SHOPPING_ANALIA_FRANCO_PASSWORD!,
        estab: '1',
      },
      'shopping-metropole': {
        email: process.env.BELLE_METROPOLE_EMAIL!,
        senha: process.env.BELLE_METROPOLE_PASSWORD!,
        estab: '1',
      },
      'perdizes': {
        email: process.env.BELLE_PERDIZES_EMAIL!,
        senha: process.env.BELLE_PERDIZES_PASSWORD!,
        estab: '1',
      },
      'tatuape': {
        email: process.env.BELLE_TATUAPE_GOMESCARDIM_EMAIL!,
        senha: process.env.BELLE_TATUAPE_GOMESCARDIM_PASSWORD!,
        estab: '1',
      },
    }

    const config = UNIDADES[unidade]
    if (!config) {
      return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    }

    const token = await getToken(config.email, config.senha)

    // Endpoint para listar relatórios disponíveis
    const url = `${BASE_URL}/BI/v1.0/report/list?estabGeral=${config.estab}`

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token,
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const errorText = await resp.text()
      return NextResponse.json(
        { error: `HTTP ${resp.status}`, details: errorText.slice(0, 500) },
        { status: resp.status }
      )
    }

    const data = await resp.json()

    // Filtrar relatórios que contenham "Buddha", "Resumo" ou "Receitas"
    const relatoriosFiltrados = Array.isArray(data)
      ? data.filter((r: any) => {
          const nome = (r.name || r.nome || r.description || '').toLowerCase()
          return nome.includes('buddha') || nome.includes('resumo') || nome.includes('receita')
        })
      : []

    return NextResponse.json({
      unidade,
      total_relatorios: Array.isArray(data) ? data.length : 0,
      relatorios_buddha: relatoriosFiltrados,
      todos_relatorios: data, // Retornar todos para análise
    })
  } catch (error) {
    console.error('Erro ao listar relatórios:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
