// Execute este script no Console do WordPress (F12 → Console)
// Na página: buddhaspa.com.br/wp-admin/admin.php?page=vouchers

(function() {
  const vouchers = [];
  const rows = document.querySelectorAll('table tbody tr');

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 6) {
      const codigo = cells[0]?.innerText?.trim() || '';
      const produto = cells[1]?.innerText?.replace('Mostrar mais detalhes', '').trim() || '';
      const dataVenda = cells[2]?.innerText?.trim() || '';
      const dataUso = cells[3]?.innerText?.trim() || '';
      const valor = cells[4]?.innerText?.trim() || '';
      const status = cells[5]?.innerText?.trim() || '';

      if (codigo) {
        vouchers.push({
          codigo,
          produto,
          dataTerapia: dataUso,
          dataVenda,
          valor,
          valorReembolso: parseFloat(valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0,
          status: status.includes('Validado') ? 'Validado' : 'Pendente',
          formaValidacao: status.includes('Automatico') ? 'Automatico' :
                          status.includes('Manualmente') ? 'Manualmente' : 'Pendente',
          unidade: 'Shopping Metrópole'
        });
      }
    }
  });

  // Copia para clipboard
  const json = JSON.stringify(vouchers, null, 2);
  navigator.clipboard.writeText(json);

  console.log('✅ ' + vouchers.length + ' vouchers copiados!');
  console.log('Cole no formulário de importação');
  console.log(vouchers);

  return vouchers;
})();
