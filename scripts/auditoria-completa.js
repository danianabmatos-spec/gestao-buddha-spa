/**
 * AUDITORIA COMPLETA DO SISTEMA
 * Testa todas as APIs e indicadores das 7 unidades
 */

const unidades = [
  'shopping-metropole',
  'analia-franco',
  'shopping-analia-franco',
  'perdizes',
  'tatuape-gomescardim',
  'mooca-plaza',
  'higienopolis'
]

const periodo = {
  dataIni: '2026-06-01',
  dataFim: '2026-06-15'
}

const resultados = {
  sucessos: [],
  erros: [],
  avisos: []
}

function log(tipo, mensagem, detalhes = null) {
  const msg = { tipo, mensagem, detalhes, timestamp: new Date().toISOString() }

  if (tipo === 'ERRO') {
    resultados.erros.push(msg)
    console.log(`❌ ${mensagem}`)
  } else if (tipo === 'AVISO') {
    resultados.avisos.push(msg)
    console.log(`⚠️  ${mensagem}`)
  } else {
    resultados.sucessos.push(msg)
    console.log(`✅ ${mensagem}`)
  }

  if (detalhes) {
    console.log(`   ${JSON.stringify(detalhes)}`)
  }
}

async function testarAPI(url, nome, validacao) {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      log('ERRO', `${nome} - HTTP ${response.status}`, { url })
      return null
    }

    const data = await response.json()

    if (validacao) {
      const resultado = validacao(data)
      if (resultado.ok) {
        log('SUCESSO', `${nome} - OK`, resultado.detalhes)
      } else {
        log('ERRO', `${nome} - ${resultado.erro}`, resultado.detalhes)
      }
      return data
    }

    log('SUCESSO', `${nome} - OK`)
    return data

  } catch (error) {
    log('ERRO', `${nome} - ${error.message}`, { url })
    return null
  }
}

// ============================================
// TESTE 1: FATURAMENTO (7 UNIDADES)
// ============================================
async function testarFaturamento() {
  console.log('\n📊 TESTANDO FATURAMENTO (7 UNIDADES)\n')

  for (const unidade of unidades) {
    const url = `http://localhost:3002/api/belle/faturamento?unidade=${unidade}&dataIni=${periodo.dataIni}&dataFim=${periodo.dataFim}`

    await testarAPI(url, `Faturamento ${unidade}`, (data) => {
      // Validações (estrutura real da API)
      if (typeof data.caixa !== 'number') {
        return { ok: false, erro: 'Caixa inválido' }
      }

      if (typeof data.totalPass !== 'number') {
        return { ok: false, erro: 'TotalPass inválido' }
      }

      if (typeof data.gympass !== 'number') {
        return { ok: false, erro: 'Gympass inválido' }
      }

      if (typeof data.horasAtendimento !== 'number') {
        return { ok: false, erro: 'Horas inválido' }
      }

      // Verifica se tem valores zerados (pode ser aviso)
      if (data.caixa === 0 && data.totalPass === 0 && data.gympass === 0) {
        log('AVISO', `${unidade} - Todos os valores zerados`, { periodo })
      }

      return {
        ok: true,
        detalhes: {
          caixa: data.caixa,
          totalPass: data.totalPass,
          gympass: data.gympass,
          horas: data.horasAtendimento,
          totalBruto: data.totalBruto
        }
      }
    })
  }
}

// ============================================
// TESTE 2: VENDAS RECEPÇÃO (7 UNIDADES)
// ============================================
async function testarVendasRecepcao() {
  console.log('\n🛒 TESTANDO VENDAS RECEPÇÃO (7 UNIDADES)\n')

  for (const unidade of unidades) {
    const url = `http://localhost:3002/api/belle/vendas-recepcao?unidade=${unidade}&dataIni=${periodo.dataIni}&dataFim=${periodo.dataFim}`

    await testarAPI(url, `Vendas Recepção ${unidade}`, (data) => {
      if (!data.vouchers || !data.planos || !data.produtos) {
        return { ok: false, erro: 'Estrutura inválida' }
      }

      const total = data.vouchers.valorLiquido + data.planos.valorLiquido + data.produtos.valorLiquido

      return {
        ok: true,
        detalhes: {
          vouchers: data.vouchers.quantidade,
          planos: data.planos.quantidade,
          produtos: data.produtos.quantidade,
          totalLiquido: total
        }
      }
    })
  }
}

// ============================================
// TESTE 3: VOUCHERS USADOS (7 UNIDADES)
// ============================================
async function testarVouchersUsados() {
  console.log('\n🎫 TESTANDO VOUCHERS USADOS (7 UNIDADES)\n')

  for (const unidade of unidades) {
    const url = `http://localhost:3002/api/belle/vouchers-usados?unidade=${unidade}&dataIni=${periodo.dataIni}&dataFim=${periodo.dataFim}`

    await testarAPI(url, `Vouchers Usados ${unidade}`, (data) => {
      if (!Array.isArray(data.vouchers)) {
        return { ok: false, erro: 'Estrutura inválida' }
      }

      // Verifica paginação (se retornou todos os registros)
      const total = data.total || data.vouchers.length

      if (data.paginacao && data.paginacao.temMaisPaginas) {
        return {
          ok: false,
          erro: 'Paginação incompleta - não retornou todos os registros',
          detalhes: { total, retornados: data.vouchers.length }
        }
      }

      return {
        ok: true,
        detalhes: {
          total: data.vouchers.length,
          periodo: `${periodo.dataIni} a ${periodo.dataFim}`
        }
      }
    })
  }
}

// ============================================
// TESTE 4: VOUCHERS CRUZADOS (SHOPPING METRÓPOLE)
// ============================================
async function testarVouchersCruzados() {
  console.log('\n🔄 TESTANDO VOUCHERS CRUZADOS (SHOPPING METRÓPOLE)\n')

  const url = `http://localhost:3002/api/belle/vouchers-cruzados?unidade=shopping-metropole&dataIni=${periodo.dataIni}&dataFim=${periodo.dataFim}`

  await testarAPI(url, 'Vouchers Cruzados shopping-metropole', (data) => {
    if (!data.estatisticas || !Array.isArray(data.vouchers)) {
      return { ok: false, erro: 'Estrutura inválida' }
    }

    const { total, validacaoManual, validacaoAutomatica, valorTotal } = data.estatisticas

    // Validações
    if (total !== validacaoManual + validacaoAutomatica) {
      return {
        ok: false,
        erro: 'Soma de validações não confere',
        detalhes: { total, manual: validacaoManual, automatica: validacaoAutomatica }
      }
    }

    // Verifica se valor total confere com soma dos vouchers
    const somaVouchers = data.vouchers.reduce((sum, v) => sum + (v.valorReembolso || 0), 0)

    if (Math.abs(somaVouchers - valorTotal) > 1) {
      return {
        ok: false,
        erro: 'Valor total não confere com soma dos vouchers',
        detalhes: { valorTotal, somaVouchers, diferenca: somaVouchers - valorTotal }
      }
    }

    return {
      ok: true,
      detalhes: {
        total,
        validacaoManual,
        validacaoAutomatica,
        valorTotal
      }
    }
  })
}

// ============================================
// TESTE 5: NPS (7 UNIDADES)
// ============================================
async function testarNPS() {
  console.log('\n😊 TESTANDO NPS (7 UNIDADES)\n')

  for (const unidade of unidades) {
    const url = `http://localhost:3002/api/belle/nps?unidade=${unidade}&dataIni=${periodo.dataIni}&dataFim=${periodo.dataFim}`

    await testarAPI(url, `NPS ${unidade}`, (data) => {
      // Estrutura real: {profissionais:{nps}, atendimento:{nps}, unidade:{nps}}
      if (!data.unidade || typeof data.unidade.nps !== 'number') {
        return { ok: false, erro: 'Score NPS inválido' }
      }

      // NPS deve estar entre -100 e 100
      if (data.unidade.nps < -100 || data.unidade.nps > 100) {
        return {
          ok: false,
          erro: 'Score NPS fora do range',
          detalhes: { score: data.unidade.nps }
        }
      }

      return {
        ok: true,
        detalhes: {
          unidade: data.unidade.nps,
          profissionais: data.profissionais?.nps || 0,
          atendimento: data.atendimento?.nps || 0,
          total: data.unidade.total || 0
        }
      }
    })
  }
}

// ============================================
// TESTE 6: GOOGLE REVIEWS (7 UNIDADES)
// ============================================
async function testarGoogleReviews() {
  console.log('\n⭐ TESTANDO GOOGLE REVIEWS (7 UNIDADES)\n')

  for (const unidade of unidades) {
    const url = `http://localhost:3002/api/google/reviews?unidade=${unidade}`

    await testarAPI(url, `Google Reviews ${unidade}`, (data) => {
      // Estrutura real: {rating, totalReviews}
      if (typeof data.rating !== 'number' || typeof data.totalReviews !== 'number') {
        return { ok: false, erro: 'Estrutura inválida' }
      }

      // Rating deve estar entre 0 e 5
      if (data.rating < 0 || data.rating > 5) {
        return {
          ok: false,
          erro: 'Rating fora do range',
          detalhes: { rating: data.rating }
        }
      }

      return {
        ok: true,
        detalhes: {
          rating: data.rating,
          totalReviews: data.totalReviews
        }
      }
    })
  }
}

// ============================================
// TESTE 7: RADAR GERAL
// ============================================
async function testarRadarGeral() {
  console.log('\n🎯 TESTANDO RADAR GERAL\n')

  const url = `http://localhost:3002/api/radar-geral?dataIni=${periodo.dataIni}&dataFim=${periodo.dataFim}`

  await testarAPI(url, 'Radar Geral', (data) => {
    // Estrutura real: {unidades: [], totalizadores: {}}
    if (!Array.isArray(data.unidades) || !data.totalizadores) {
      return { ok: false, erro: 'Estrutura inválida' }
    }

    // Deve ter 7 unidades
    if (data.unidades.length !== 7) {
      return {
        ok: false,
        erro: `Número incorreto de unidades: ${data.unidades.length}`,
        detalhes: { unidades: data.unidades.map(u => u.nome) }
      }
    }

    // Verificar se totais conferem com soma das unidades
    const somaFaturamento = data.unidades.reduce((sum, u) => sum + (u.faturamento?.total || 0), 0)

    if (Math.abs(somaFaturamento - data.totalizadores.faturamentoTotal) > 1) {
      return {
        ok: false,
        erro: 'Total de faturamento não confere',
        detalhes: {
          totalCalculado: data.totalizadores.faturamentoTotal,
          somaUnidades: somaFaturamento
        }
      }
    }

    return {
      ok: true,
      detalhes: {
        unidades: data.unidades.length,
        faturamentoTotal: data.totalizadores.faturamentoTotal,
        horasTotais: data.totalizadores.horasTotais,
        npsMedia: data.totalizadores.npsMedia
      }
    }
  })
}

// ============================================
// TESTE 8: TERAPEUTAS (SHOPPING METRÓPOLE)
// ============================================
async function testarTerapeutas() {
  console.log('\n👥 TESTANDO TERAPEUTAS (SHOPPING METRÓPOLE)\n')

  const url = `http://localhost:3002/api/belle/terapeutas?unidade=shopping-metropole&dataIni=2026-01-01&dataFim=2026-06-30`

  await testarAPI(url, 'Terapeutas shopping-metropole', (data) => {
    // Estrutura real: array direto
    if (!Array.isArray(data)) {
      return { ok: false, erro: 'Estrutura inválida' }
    }

    // Verificar se cada terapeuta tem os campos necessários
    for (const t of data) {
      if (!t.profissional || typeof t.horasAtendimento !== 'number') {
        return {
          ok: false,
          erro: 'Terapeuta com dados inválidos',
          detalhes: { terapeuta: t }
        }
      }
    }

    return {
      ok: true,
      detalhes: {
        totalTerapeutas: data.length,
        periodo: 'Semestre 1/2026'
      }
    }
  })
}

// ============================================
// EXECUTAR TODOS OS TESTES
// ============================================
async function executarAuditoria() {
  console.log('═'.repeat(60))
  console.log('AUDITORIA COMPLETA - SISTEMA GESTÃO BUDDHA SPA')
  console.log('═'.repeat(60))

  const inicio = Date.now()

  await testarFaturamento()
  await testarVendasRecepcao()
  await testarVouchersUsados()
  await testarVouchersCruzados()
  await testarNPS()
  await testarGoogleReviews()
  await testarRadarGeral()
  await testarTerapeutas()

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1)

  console.log('\n' + '═'.repeat(60))
  console.log('RESUMO DA AUDITORIA')
  console.log('═'.repeat(60))
  console.log(`✅ Sucessos: ${resultados.sucessos.length}`)
  console.log(`⚠️  Avisos: ${resultados.avisos.length}`)
  console.log(`❌ Erros: ${resultados.erros.length}`)
  console.log(`⏱️  Duração: ${duracao}s`)
  console.log('═'.repeat(60))

  if (resultados.erros.length > 0) {
    console.log('\n❌ ERROS ENCONTRADOS:\n')
    resultados.erros.forEach((e, i) => {
      console.log(`${i + 1}. ${e.mensagem}`)
      if (e.detalhes) {
        console.log(`   ${JSON.stringify(e.detalhes, null, 2)}`)
      }
    })
  }

  if (resultados.avisos.length > 0) {
    console.log('\n⚠️  AVISOS:\n')
    resultados.avisos.forEach((a, i) => {
      console.log(`${i + 1}. ${a.mensagem}`)
    })
  }

  console.log('\n')
}

executarAuditoria().catch(console.error)
