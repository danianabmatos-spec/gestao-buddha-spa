// Teste detalhado da validação mostrando cada passo

(async () => {
  console.log('🔍 TESTE DETALHADO DE VALIDAÇÃO\n');

  // Vamos testar com apenas 3 vouchers conhecidos
  const VOUCHERS_TESTE = [
    { codigo: 'JBG56I6', tipo: 'AUTOMATICO (Navvii)' },
    { codigo: 'MG8M6JS', tipo: 'MANUAL (Navvii)' },
    { codigo: 'F4JBK3F', tipo: 'MANUAL (Navvii)' }
  ];

  const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://app.bellesoftware.com.br',
    'x-from': 'app',
  };

  // Login Belle
  const authResp = await fetch(`${BASE_URL}/Login/v1.0/autenticar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      metodo: 'email',
      dados: {
        email: 'adm.shoppingmetropole@buddhaspa.com.br',
        senha: 'Metr@1056'
      }
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

  // Agendamentos 01/06
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

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const voucher of VOUCHERS_TESTE) {
    console.log(`\n📌 ${voucher.codigo} (${voucher.tipo}):`);

    // Procura agendamento com esse código na observação
    const ags = agendamentos.filter(ag => {
      const obs = (ag.observacao || '').toLowerCase();
      const codigo = voucher.codigo.toLowerCase();
      return obs.includes(codigo);
    });

    if (ags.length === 0) {
      console.log('   ❌ Código NÃO encontrado na observação');
      console.log('   → Sistema vai fazer match por serviço');
    } else {
      console.log(`   ✓ ${ags.length} agendamento(s) encontrado(s):`);
      ags.forEach(ag => {
        console.log(`      Cliente: ${ag.nom_paciente}`);
        console.log(`      voucher: "${ag.voucher}"`);
        console.log(`      observacao: "${ag.observacao}"`);

        const temVoucherNominal = (ag.voucher || '').toLowerCase().includes('voucher nominal');
        console.log(`      → Campo voucher tem "Voucher Nominal"? ${temVoucherNominal ? 'SIM' : 'NÃO'}`);
        console.log(`      → Classificação: ${temVoucherNominal ? 'MANUAL' : 'AUTOMÁTICO'}`);
        console.log('');
      });
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ANÁLISE CONCLUÍDA!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
