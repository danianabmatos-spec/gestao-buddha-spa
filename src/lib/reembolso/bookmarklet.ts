// Gera o bookmarklet de RELAY: a Daniana clica nele já logada numa unidade do
// WordPress; ele busca os 3 relatórios do mês (Vouchers, Omnichannel, Cortesias),
// detecta a unidade pelo relatório/conta e faz POST para /api/reembolso/pull.
//
// Roda na sessão real dela (passa pelo Cloudflare). A unidade é auto-detectada,
// então o MESMO bookmarklet serve para as 7 unidades — basta trocar o login.

// O corpo é mantido em String.raw para preservar as barras invertidas das regex.
const CORPO = String.raw`(async()=>{try{
var ANO=__ANO__,MES=__MES__,ERP='__ERP__';
var mm=('0'+MES).slice(-2), last=new Date(ANO,MES,0).getDate();
var ini=ANO+'-'+mm+'-01', fim=ANO+'-'+mm+'-'+('0'+last).slice(-2);
var B='https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0';
var us=B+'&date_sell_start=&date_sell_end=&date_used_start='+ini+'&date_used_end='+fim;
var uo=B+'&date_sell_start='+ini+'&date_sell_end='+fim+'&date_used_start=&date_used_end=&is_omnichannel=on';
function moeda(t){return parseFloat((t||'').replace(/[R$\s.]/g,'').replace(',','.'))||0;}
function tot(h){var m=h.match(/<span>R\$\s*([\d.,]+)<\/span><\/h5>\s*<div[^>]*>Reembolso/)||h.match(/R\$\s*([\d.,]+)\s*<\/div>\s*[\s\S]{0,100}Reembolso/);return m?moeda(m[1]):0;}
function rows(h){var tb=h.match(/<tbody[^>]*id=["']the-list["'][^>]*>([\s\S]*?)<\/tbody>/);if(!tb)return[];var o=[],r,rx=/<tr[^>]*>([\s\S]*?)<\/tr>/g;while(r=rx.exec(tb[1])){var c={},td,rc=/<td[^>]*data-colname=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/g;while(td=rc.exec(r[1])){c[td[1].toLowerCase().trim()]=td[2].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();}if(Object.keys(c).length>=4)o.push(c);}return o;}
function get(c,sub){var k=Object.keys(c).find(function(x){return x.indexOf(sub)>=0;});return k?c[k]:'';}
var hs=await fetch(us,{credentials:'include'}).then(function(r){return r.text();});
var ho=await fetch(uo,{credentials:'include'}).then(function(r){return r.text();});
var sr=rows(hs);
var cort=sr.filter(function(c){return moeda(get(c,'reembolso'))===0;}).map(function(c){var nome=(get(c,'nome')||'').replace('Mostrar mais detalhes','').trim();var m=nome.match(/R\$\s*([\d.,]+)/);return {codigo:get(c,'digo'),nome:nome,valor:m?moeda(m[1]):0,dataUtilizacao:get(c,'utiliza')||null};});
var payload={ano:ANO,mes:MES,contaWp:((document.querySelector('#wp-admin-bar-my-account .display-name')||{}).textContent||''),unidadeNome:((sr[0]&&get(sr[0],'unidade'))||''),vouchers:tot(hs),omnichannel:tot(ho),cortesias:cort};
var res=await fetch(ERP+'/api/reembolso/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json();});
alert(res.ok?('OK - '+res.unidade+' ('+MES+'/'+ANO+')\nVouchers R$ '+payload.vouchers.toLocaleString('pt-BR')+'\nOmnichannel R$ '+payload.omnichannel.toLocaleString('pt-BR')+'\nCortesias: '+cort.length+' (R$ '+res.cortesiaUsada.toLocaleString('pt-BR')+')\n\nEnviado ao ERP. Atualize a pagina do reembolso.'):('Nao reconheci/erro: '+(res.error||'?')));
}catch(e){alert('Erro no bookmarklet: '+e.message);}})();`

export function montarBookmarklet(ano: number, mes: number, erpOrigin: string): string {
  const corpo = CORPO
    .replace('__ANO__', String(ano))
    .replace('__MES__', String(mes))
    .replace('__ERP__', erpOrigin)
  // remove quebras de linha para caber numa URL de bookmark
  return 'javascript:' + corpo.replace(/\n\s*/g, '')
}
