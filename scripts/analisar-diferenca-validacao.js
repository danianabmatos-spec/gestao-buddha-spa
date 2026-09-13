// Analisa a diferença entre validação automática vs manual
// Cruza dados do Navvii com agendamentos do Belle

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';

const CREDENCIAIS = {
  email: 'adm.shoppingmetropole@buddhaspa.com.br',
  senha: 'Metr@1056',
  estabelecimento: 1
};

// Dados extraídos do Navvii
const VOUCHERS_AUTOMATICOS = [
  "JBG56I6", "M1D6JQR", "D9FLX5K", "M1JZQ9H",
  "87ZIFB1", "53X5JX6", "3LZKK4Q", "5I3SXR9"
];

const VOUCHERS_MANUAIS = [
  "MG8M6JS", "F4JBK3F", "MHZG5J3", "8F7K1QF", "HHJIKB7", "68D83FG",
  "VX7RRM4", "X8PXP18", "QFFI8GR", "KPM4FZK", "9G98IVL", "RJ5BLF6",
  "K3DRV80", "G085LBQ", "6PH4F9M", "LBFK1G6", "M3B17P8", "FL0P640",
  "VILRZZR", "4DF9584", "HV9J1D8", "F4K7VRI", "LBQ1JQ5", "7MLL5ZD"
];

async function analisar() {
  console.log('🔍 ANALISANDO DIFERENÇA ENTRE VALIDAÇÃO MANUAL E AUTOMÁTICA\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://app.bellesoftware.com.br',
    'Referer': 'https://app.bellesoftware.com.br/',
    'x-from': 'app',
  };

  // 1. Login
  console.log('🔐 Fazendo login no Belle...');
  const respAuth = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      metodo: 'email',
      dados: { email: CREDENCIAIS.email, senha: CREDENCIAIS.senha }
    }),
  });

  const authData = await respAuth.json();
  const token = authData.token;
  headers.Authorization = token;
  console.log('   ✓ Login bem-sucedido\n');

  // 2. Buscar grid
  console.log('📊 Buscando grid de profissionais...');
  const respGrid = await fetch(
    `${BASE_URL}/Agenda/v1.0/grid?etb=${CREDENCIAIS.estabelecimento}&restringe=0&estabGeral=${CREDENCIAIS.estabelecimento}`,
    { headers }
  );
  const grid = await respGrid.json();
  console.log(`   ✓ ${grid.length} profissionais\n`);

  // 3. Buscar agendamentos de 01/06 a 07/06
  const datas = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'];
  console.log('📅 Buscando agendamentos do período...');

  const todosAgendamentos = [];
  for (const data of datas) {
    const payload = {
      semFinaliz: false, canc: false, finaliz: false, finan: false, semFinan: false,
      tpAgenda: 'prof', tp: '0', dtAgenda: data, arrGrid: grid, corAgenda: 'ct',
      destacarInad: '', destacarPendCont: 0, destacarNaoPreencQuest: 0,
      corInad: '', corPendContrato: '', corAgendSemQuest: null,
      exibir_pc_agenda: '1', verTodas: 1, destacarNomeInad: '',
      teleatendimento: 0, etb: String(CREDENCIAIS.estabelecimento),
    };

    const resp = await fetch(
      `${BASE_URL}/Agenda/v1.0/agendaapi?estabGeral=${CREDENCIAIS.estabelecimento}`,
      { method: 'POST', headers, body: JSON.stringify(payload) }
    );

    const agendamentos = await resp.json();
    todosAgendamentos.push(...agendamentos);
  }

  console.log(`   ✓ ${todosAgendamentos.length} agendamentos encontrados\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 4. Analisar AUTOMÁTICOS
  console.log('📌 VOUCHERS AUTOMÁTICOS:\n');
  VOUCHERS_AUTOMATICOS.forEach(codigo => {
    const agendamentosComCodigo = todosAgendamentos.filter(ag => {
      const obs = (ag.observacao || '').toLowerCase();
      const voucher = (ag.voucher || '').toLowerCase();
      return obs.includes(codigo.toLowerCase()) || voucher.includes('voucher');
    });

    if (agendamentosComCodigo.length > 0) {
      console.log(`   ${codigo}:`);
      agendamentosComCodigo.forEach(ag => {
        console.log(`      → observacao: "${ag.observacao}"`);
        console.log(`      → voucher: "${ag.voucher}"`);
        console.log(`      → cliente: ${ag.nom_paciente}`);
      });
    } else {
      console.log(`   ${codigo}: SEM código na observação ou voucher`);
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 5. Analisar MANUAIS (apenas primeiros 5 para não poluir)
  console.log('📌 VOUCHERS MANUAIS (amostra):\n');
  VOUCHERS_MANUAIS.slice(0, 5).forEach(codigo => {
    const agendamentosComCodigo = todosAgendamentos.filter(ag => {
      const obs = (ag.observacao || '').toLowerCase();
      const voucher = (ag.voucher || '').toLowerCase();
      return obs.includes(codigo.toLowerCase()) || voucher.includes('voucher');
    });

    if (agendamentosComCodigo.length > 0) {
      console.log(`   ${codigo}:`);
      agendamentosComCodigo.forEach(ag => {
        console.log(`      → observacao: "${ag.observacao}"`);
        console.log(`      → voucher: "${ag.voucher}"`);
        console.log(`      → cliente: ${ag.nom_paciente}`);
      });
    } else {
      console.log(`   ${codigo}: SEM código na observação ou voucher`);
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ANÁLISE CONCLUÍDA!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

analisar().catch(err => console.error('❌ Erro:', err));
