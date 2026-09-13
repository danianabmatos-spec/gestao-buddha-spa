// Script para extrair a lógica de validação do Navvii
// Execute no Console do Chrome (F12 → Console) quando estiver na página:
// https://app.navvii.com.br/validacao-voucher-wordpress

(function() {
  console.log('🔍 EXTRAINDO LÓGICA DE VALIDAÇÃO DO NAVVII\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Tenta encontrar a tabela de vouchers
  const tabela = document.querySelector('table');

  if (!tabela) {
    console.error('❌ Tabela não encontrada na página');
    console.log('Certifique-se de estar na página de validação de vouchers');
    return;
  }

  console.log('✓ Tabela encontrada\n');

  // Extrai dados da tabela
  const linhas = Array.from(tabela.querySelectorAll('tbody tr'));

  console.log(`Total de vouchers na tabela: ${linhas.length}\n`);

  const vouchers = linhas.map(linha => {
    const colunas = Array.from(linha.querySelectorAll('td'));
    return {
      codigo: colunas[0]?.textContent.trim() || '',
      produto: colunas[1]?.textContent.trim() || '',
      dataTerapia: colunas[2]?.textContent.trim() || '',
      statusVoucher: colunas[3]?.textContent.trim() || '',
      status: colunas[4]?.textContent.trim() || '',
      formaValidacao: colunas[5]?.textContent.trim() || '',
      valorReembolso: colunas[6]?.textContent.trim() || '',
      cliente: colunas[7]?.textContent.trim() || '',
      html: linha.innerHTML
    };
  });

  // Agrupa por forma de validação
  const automaticos = vouchers.filter(v =>
    v.formaValidacao.toLowerCase().includes('automatico') ||
    v.formaValidacao.toLowerCase().includes('automático')
  );

  const manuais = vouchers.filter(v =>
    v.formaValidacao.toLowerCase().includes('manual')
  );

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ESTATÍSTICAS:\n');
  console.log(`   Validação Automática: ${automaticos.length}`);
  console.log(`   Validação Manual: ${manuais.length}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📌 VOUCHERS COM VALIDAÇÃO AUTOMÁTICA:\n');
  automaticos.forEach(v => {
    console.log(`   ${v.codigo} | ${v.dataTerapia} | ${v.produto}`);
    console.log(`      Cliente (Belle): ${v.cliente}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📌 VOUCHERS COM VALIDAÇÃO MANUAL:\n');
  manuais.forEach(v => {
    console.log(`   ${v.codigo} | ${v.dataTerapia} | ${v.produto}`);
    console.log(`      Cliente (Belle): ${v.cliente}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Exporta para análise
  console.log('💾 DADOS PARA ANÁLISE:\n');
  console.log('Copie o JSON abaixo e me envie:\n');
  console.log(JSON.stringify({
    total: vouchers.length,
    automaticos: automaticos.length,
    manuais: manuais.length,
    vouchersAutomaticos: automaticos.map(v => ({
      codigo: v.codigo,
      data: v.dataTerapia,
      produto: v.produto,
      clienteBelle: v.cliente
    })),
    vouchersManuais: manuais.map(v => ({
      codigo: v.codigo,
      data: v.dataTerapia,
      produto: v.produto,
      clienteBelle: v.cliente
    }))
  }, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EXTRAÇÃO CONCLUÍDA!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
