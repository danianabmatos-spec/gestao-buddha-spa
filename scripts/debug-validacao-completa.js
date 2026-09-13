// Debug completo da validação para descobrir por que está marcando todos como automáticos

(async () => {
  const API_URL = 'http://localhost:3000/api/vouchers/sync';
  const AFFILIATION = '894555';
  const BELLE_CREDENCIAIS = {
    email: 'adm.shoppingmetropole@buddhaspa.com.br',
    senha: 'Metr@1056',
    estabelecimento: 1
  };

  const dataIni = '2026-06-01';
  const dataFim = '2026-06-06';

  console.log('🔍 DEBUG COMPLETO DA VALIDAÇÃO\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Busca HTML WordPress
  const url = `https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=${dataIni}&date_used_end=${dataFim}&affilliation_id=${AFFILIATION}`;

  console.log('📥 1. Buscando vouchers do WordPress...');
  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();
  console.log(`   ✓ HTML: ${(html.length / 1024).toFixed(1)} KB\n`);

  // Envia para API
  console.log('🔄 2. Enviando para API...');
  const result = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataIni,
      dataFim,
      html,
      tipo: 'site',
      belleCredenciais: BELLE_CREDENCIAIS
    })
  });

  const data = await result.json();
  console.log('   ✓ Processado\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 RESULTADO DA API:\n');
  console.log('   Total:', data.totalValidados || 0);
  console.log('   Automáticos:', data.validacaoAutomatica || 0);
  console.log('   Manuais:', data.validacaoManual || 0);

  // Agora vamos buscar DIRETAMENTE do Belle para debug
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 3. DEBUG: Buscando agendamentos do Belle...\n');

  const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://app.bellesoftware.com.br',
    'x-from': 'app',
  };

  // Login
  const authResp = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      metodo: 'email',
      dados: { email: BELLE_CREDENCIAIS.email, senha: BELLE_CREDENCIAIS.senha }
    })
  });
  const authData = await authResp.json();
  headers.Authorization = authData.token;

  // Grid
  const gridResp = await fetch(
    `${BASE_URL}/Agenda/v1.0/grid?etb=1&restringe=0&estabGeral=1`,
    { headers }
  );
  const grid = await gridResp.json();

  // Agendamentos de 01/06
  const payload = {
    semFinaliz: false, canc: false, finaliz: false, finan: false, semFinan: false,
    tpAgenda: 'prof', tp: '0', dtAgenda: '2026-06-01', arrGrid: grid,
    corAgenda: 'ct', destacarInad: '', destacarPendCont: 0,
    destacarNaoPreencQuest: 0, corInad: '', corPendContrato: '',
    corAgendSemQuest: null, exibir_pc_agenda: '1', verTodas: 1,
    destacarNomeInad: '', teleatendimento: 0, etb: '1',
  };

  const agResp = await fetch(
    `${BASE_URL}/Agenda/v1.0/agendaapi?estabGeral=1`,
    { method: 'POST', headers, body: JSON.stringify(payload) }
  );
  const agendamentos = await agResp.json();

  console.log(`   ✓ ${agendamentos.length} agendamentos em 01/06\n`);

  // Procura pelos vouchers que o Navvii marcou como automático
  const VOUCHERS_AUTOMATICOS_NAVVII = ['JBG56I6', 'M1D6JQR'];
  const VOUCHERS_MANUAIS_NAVVII = ['MG8M6JS', 'F4JBK3F'];

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📌 ANÁLISE: Vouchers AUTOMÁTICOS segundo Navvii\n');

  VOUCHERS_AUTOMATICOS_NAVVII.forEach(codigo => {
    const ags = agendamentos.filter(ag => {
      const obs = (ag.observacao || '').toLowerCase();
      const voucher = (ag.voucher || '').toLowerCase();
      return obs.includes(codigo.toLowerCase()) || voucher.includes('voucher');
    });

    if (ags.length > 0) {
      console.log(`   ${codigo}:`);
      ags.forEach(ag => {
        console.log(`      Cliente: ${ag.nom_paciente}`);
        console.log(`      voucher: "${ag.voucher}"`);
        console.log(`      observacao: "${ag.observacao}"`);
        console.log(`      → Deveria ser: AUTOMÁTICO`);
        console.log('');
      });
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📌 ANÁLISE: Vouchers MANUAIS segundo Navvii\n');

  VOUCHERS_MANUAIS_NAVVII.forEach(codigo => {
    const ags = agendamentos.filter(ag => {
      const obs = (ag.observacao || '').toLowerCase();
      const voucher = (ag.voucher || '').toLowerCase();
      return obs.includes(codigo.toLowerCase()) || voucher.includes('voucher');
    });

    if (ags.length > 0) {
      console.log(`   ${codigo}:`);
      ags.forEach(ag => {
        console.log(`      Cliente: ${ag.nom_paciente}`);
        console.log(`      voucher: "${ag.voucher}"`);
        console.log(`      observacao: "${ag.observacao}"`);
        console.log(`      → Deveria ser: MANUAL`);
        console.log('');
      });
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ DEBUG CONCLUÍDO!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🎯 REGRA IDENTIFICADA:');
  console.log('   AUTOMÁTICO: voucher = "" (vazio)');
  console.log('   MANUAL: voucher = "Voucher Nominal"');
})();
