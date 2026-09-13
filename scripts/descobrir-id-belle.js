// Script para descobrir ID do estabelecimento no Belle
// Execute: node scripts/descobrir-id-belle.js

const BASE_URL = 'https://app.bellesoftware.com.br';

const CREDENCIAIS = {
  email: 'adm.shoppingmetropole@buddhaspa.com.br',
  senha: 'Metr@1056'
};

async function getToken(email, senha) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const payload = {
    email,
    senha,
    tokenFirebase: '',
    versaoApp: '99.99.99',
    tipo: 'web',
  };

  console.log('🔐 Fazendo login no Belle...');

  const resp = await fetch(`${BASE_URL}/Login/v1.0/admin/logar?estabGeral=`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`Login falhou: ${resp.status}`);
  }

  const data = await resp.json();

  console.log('✅ Login bem-sucedido!\n');
  console.log('📊 Dados da conta:');
  console.log(JSON.stringify(data, null, 2));

  // Procura por ID de estabelecimento
  if (data.estabelecimentos) {
    console.log('\n🏢 ESTABELECIMENTOS:');
    data.estabelecimentos.forEach((estab, idx) => {
      console.log(`\n${idx + 1}. ${estab.nome || 'Sem nome'}`);
      console.log(`   ID: ${estab.id || estab.cod_estabelecimento || 'não encontrado'}`);
      console.log(`   Código: ${estab.codigo || 'não encontrado'}`);
    });
  }

  if (data.cod_estabelecimento) {
    console.log('\n✨ ID DO ESTABELECIMENTO PRINCIPAL:', data.cod_estabelecimento);
  }

  if (data.estabGeral) {
    console.log('✨ ESTAB GERAL:', data.estabGeral);
  }

  return data;
}

(async () => {
  try {
    await getToken(CREDENCIAIS.email, CREDENCIAIS.senha);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
})();
