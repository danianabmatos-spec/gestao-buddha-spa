// Debug: Buscar estrutura completa de agendamentos do Belle
// Para identificar campo de voucher

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';

const CREDENCIAIS = {
  email: 'adm.shoppingmetropole@buddhaspa.com.br',
  senha: 'Metr@1056',
  estabelecimento: 1
};

async function buscarAgendamentoCompleto() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://app.bellesoftware.com.br',
    'Referer': 'https://app.bellesoftware.com.br/',
    'x-from': 'app',
  };

  // 1. Login
  console.log('🔐 Fazendo login...');
  const respAuth = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      metodo: 'email',
      dados: { email: CREDENCIAIS.email, senha: CREDENCIAIS.senha }
    }),
  });

  if (!respAuth.ok) {
    throw new Error(`Login falhou: ${respAuth.status}`);
  }

  const authData = await respAuth.json();
  const token = authData.token;
  headers.Authorization = token;

  console.log('✅ Login bem-sucedido\n');

  // 2. Buscar grid
  console.log('📊 Buscando grid de profissionais...');
  const respGrid = await fetch(
    `${BASE_URL}/Agenda/v1.0/grid?etb=${CREDENCIAIS.estabelecimento}&restringe=0&estabGeral=${CREDENCIAIS.estabelecimento}`,
    { headers }
  );
  const grid = await respGrid.json();
  console.log(`   ✓ ${grid.length} profissionais\n`);

  // 3. Buscar agendamentos de 01/06/2026 (dia com vouchers)
  const data = '2026-06-01';
  console.log(`📅 Buscando agendamentos de ${data}...`);

  const payload = {
    semFinaliz: false,
    canc: false,
    finaliz: false,
    finan: false,
    semFinan: false,
    tpAgenda: 'prof',
    tp: '0',
    dtAgenda: data,
    arrGrid: grid,
    corAgenda: 'ct',
    destacarInad: '',
    destacarPendCont: 0,
    destacarNaoPreencQuest: 0,
    corInad: '',
    corPendContrato: '',
    corAgendSemQuest: null,
    exibir_pc_agenda: '1',
    verTodas: 1,
    destacarNomeInad: '',
    teleatendimento: 0,
    etb: String(CREDENCIAIS.estabelecimento),
  };

  const respAgendamentos = await fetch(
    `${BASE_URL}/Agenda/v1.0/agendaapi?estabGeral=${CREDENCIAIS.estabelecimento}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }
  );

  const agendamentos = await respAgendamentos.json();
  console.log(`   ✓ ${agendamentos.length} agendamentos encontrados\n`);

  // 4. Exibir estrutura completa dos primeiros 3 agendamentos
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ESTRUTURA DOS AGENDAMENTOS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  agendamentos.slice(0, 3).forEach((ag, i) => {
    console.log(`\n═══ AGENDAMENTO ${i + 1} ═══`);
    console.log(JSON.stringify(ag, null, 2));
    console.log('\n--- CAMPOS DISPONÍVEIS ---');
    Object.keys(ag).forEach(key => {
      console.log(`  • ${key}: ${typeof ag[key]}`);
    });
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 PROCURANDO CAMPOS RELACIONADOS A VOUCHER:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const camposRelevantes = [];
  agendamentos.forEach((ag, i) => {
    Object.keys(ag).forEach(key => {
      const value = String(ag[key] || '').toLowerCase();
      if (
        key.toLowerCase().includes('voucher') ||
        key.toLowerCase().includes('cupom') ||
        key.toLowerCase().includes('cup') ||
        key.toLowerCase().includes('obs') ||
        key.toLowerCase().includes('observ') ||
        key.toLowerCase().includes('codigo') ||
        key.toLowerCase().includes('validador')
      ) {
        camposRelevantes.push({
          agendamento: i + 1,
          campo: key,
          valor: ag[key]
        });
      }
    });
  });

  if (camposRelevantes.length > 0) {
    console.log('✓ Campos encontrados:');
    camposRelevantes.forEach(c => {
      console.log(`  [Ag ${c.agendamento}] ${c.campo}: ${c.valor}`);
    });
  } else {
    console.log('⚠️  Nenhum campo relacionado a voucher encontrado');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

(async () => {
  try {
    await buscarAgendamentoCompleto();
    console.log('\n✅ ANÁLISE CONCLUÍDA!\n');
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
})();
