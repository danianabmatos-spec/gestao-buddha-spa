// Conta quantos agendamentos do Belle têm "Voucher Nominal"

(async () => {
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
      dados: { email: 'adm.shoppingmetropole@buddhaspa.com.br', senha: 'Metr@1056' }
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

  const datas = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06'];
  let todosAgendamentos = [];

  for (const data of datas) {
    const payload = {
      semFinaliz: false, canc: false, finaliz: false, finan: false, semFinan: false,
      tpAgenda: 'prof', tp: '0', dtAgenda: data, arrGrid: grid,
      corAgenda: 'ct', destacarInad: '', destacarPendCont: 0,
      destacarNaoPreencQuest: 0, corInad: '', corPendContrato: '',
      corAgendSemQuest: null, exibir_pc_agenda: '1', verTodas: 1,
      destacarNomeInad: '', teleatendimento: 0, etb: '1',
    };

    const resp = await fetch(
      `${BASE_URL}/Agenda/v1.0/agendaapi?estabGeral=1`,
      { method: 'POST', headers, body: JSON.stringify(payload) }
    );
    const ags = await resp.json();
    todosAgendamentos.push(...ags);
  }

  const comVoucherNominal = todosAgendamentos.filter(ag =>
    (ag.voucher || '').toLowerCase().includes('voucher nominal') &&
    (ag.status === 'Atendido' || ag.status === 'Confirmado')
  );

  const semVoucher = todosAgendamentos.filter(ag =>
    !(ag.voucher || '').toLowerCase().includes('voucher') &&
    (ag.status === 'Atendido' || ag.status === 'Confirmado')
  );

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AGENDAMENTOS BELLE (01 a 06/06):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Total de agendamentos: ${todosAgendamentos.length}`);
  console.log(`Com "Voucher Nominal": ${comVoucherNominal.length}`);
  console.log(`Sem voucher (vazio): ${semVoucher.length}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nEsperado pelo Navvii:');
  console.log('  Manuais (Voucher Nominal): 24');
  console.log('  Automáticos (vazio): 8');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
