// Script para descobrir ID do estabelecimento no Belle
// Execute: node scripts/buscar-id-belle.js

const BASE_URL = 'https://app.bellesoftware.com.br';

const CREDENCIAIS = {
  email: 'adm.shoppingmetropole@buddhaspa.com.br',
  senha: 'Metr@1056'
};

async function descobrirEstabelecimento(email, senha) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://app.bellesoftware.com.br',
    'Referer': 'https://app.bellesoftware.com.br/',
    'x-from': 'app',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36',
  };

  console.log('🔐 Fazendo login no Belle...');

  // Passo 1: Autenticar
  const respAuth = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      metodo: 'email',
      dados: { email, senha }
    }),
  });

  if (!respAuth.ok) {
    const error = await respAuth.text();
    throw new Error(`Login falhou: ${respAuth.status} - ${error}`);
  }

  const authData = await respAuth.json();
  const token = authData.token;

  console.log('✅ Login bem-sucedido!');
  console.log('🔑 Token obtido\n');

  // Passo 2: Recuperar dados do usuário
  console.log('📊 Buscando dados da conta...');

  const respDados = await fetch(`${BASE_URL}/Login/v1.0/admin/recuperar_dados?estabGeral=`, {
    headers: { ...headers, Authorization: token },
  });

  if (!respDados.ok) {
    console.log('⚠️  Não conseguiu buscar dados completos');
  } else {
    const dados = await respDados.json();
    console.log('\n📋 DADOS DA CONTA:');
    console.log(JSON.stringify(dados, null, 2));
  }

  // Informações básicas do token
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 INFORMAÇÕES DO LOGIN:');
  console.log(JSON.stringify(authData, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Procura pelo ID
  console.log('\n🎯 PROCURANDO ID DO ESTABELECIMENTO:\n');

  if (authData.estabelecimento) {
    console.log('   ✓ estabelecimento:', authData.estabelecimento);
  }
  if (authData.cod_estabelecimento) {
    console.log('   ✓ cod_estabelecimento:', authData.cod_estabelecimento);
  }
  if (authData.estabGeral) {
    console.log('   ✓ estabGeral:', authData.estabGeral);
  }
  if (authData.id_estabelecimento) {
    console.log('   ✓ id_estabelecimento:', authData.id_estabelecimento);
  }

  return authData;
}

(async () => {
  try {
    await descobrirEstabelecimento(CREDENCIAIS.email, CREDENCIAIS.senha);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CONCLUÍDO!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
})();
