// ========================================
// COPIE E COLE NO CONSOLE DO CHROME
// ========================================
//
// PASSO A PASSO:
// 1. Abra: https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers
// 2. Faça login se necessário
// 3. Aplique os filtros:
//    - Data de Utilização: 01/06/2026 até 15/06/2026
//    - Afiliação: Shopping Metrópole (894555)
// 4. Abra o Console (F12 → Console)
// 5. Cole TUDO abaixo e pressione Enter
//
// ========================================

(async () => {
  console.log('🚀 Sincronizando WordPress → Sistema Local\n');

  const API_URL = 'http://localhost:3000/api/vouchers/sync';

  // Pega o HTML da página atual
  const html = document.documentElement.outerHTML;

  console.log(`📄 HTML capturado: ${(html.length / 1024).toFixed(1)} KB`);

  // Envia para API
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataIni: '2026-06-01',
        dataFim: '2026-06-15',
        html: html,
        tipo: 'site'
      })
    });

    const result = await response.json();

    if (result.error) {
      console.error('❌ Erro:', result.error);
    } else {
      console.log('\n✅ SINCRONIZADO COM SUCESSO!\n');
      console.log(`📊 Total vouchers: ${result.totalValidados || 0}`);
      console.log(`💰 Valor total: R$ ${(result.totalReembolso || 0).toFixed(2)}`);
      console.log(`\n📁 Dados salvos em: cache/vouchers-site.json`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar:', error.message);
    console.log('\n⚠️  Verifique se o servidor está rodando:');
    console.log('   npm run dev');
  }
})();
