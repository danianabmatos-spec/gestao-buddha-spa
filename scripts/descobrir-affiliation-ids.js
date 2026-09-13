// Descobre o Affiliation ID de cada unidade logando no WordPress
// node scripts/descobrir-affiliation-ids.js

const https = require('https');
const http = require('http');
const url = require('url');

const UNIDADES = [
  { nome: 'Analia Franco',          user: 'buddhaanalia',                                        pass: 'Analia@5353' },
  { nome: 'Shopping Analia Franco', user: 'administracao.shoppinganaliafranco@buddhaspa.com.br', pass: 'Saf@8787' },
  { nome: 'Perdizes',               user: 'buddhaperdizes',                                      pass: 'Perdizes@1144' },
  { nome: 'Tatuape Gomescardim',    user: 'adm.tatuapegomescardim@buddhaspa.com.br',             pass: 'Tatuape@2312' },
  { nome: 'Mooca Plaza',            user: 'buddhashoppingmooca',                                 pass: 'Mooca@0033' },
  { nome: 'Higienopolis',           user: 'administracao@buddhaspa.com.br',                      pass: 'Buddha0510' },
];

function request(options, body) {
  return new Promise((resolve, reject) => {
    const lib = options.protocol === 'http:' ? http : https;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return {};
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const cookies = {};
  arr.forEach(c => {
    const part = c.split(';')[0].trim();
    const [k, v] = part.split('=');
    if (k) cookies[k.trim()] = v ? v.trim() : '';
  });
  return cookies;
}

function cookieString(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function descobrirId(unidade) {
  try {
    // 1. Pega nonce de login
    const loginPage = await request({
      protocol: 'https:',
      hostname: 'buddhaspa.com.br',
      path: '/wp-login.php',
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    let cookies = parseCookies(loginPage.headers['set-cookie']);

    // Extrai nonce/redirect se existir
    const nonceMatch = loginPage.body.match(/name="redirect_to"\s+value="([^"]+)"/);

    // 2. Faz login
    const postBody = new URLSearchParams({
      log: unidade.user,
      pwd: unidade.pass,
      'wp-submit': 'Log In',
      redirect_to: '/wp-admin/',
      testcookie: '1',
    }).toString();

    const loginResp = await request({
      protocol: 'https:',
      hostname: 'buddhaspa.com.br',
      path: '/wp-login.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody),
        'Cookie': cookieString({ ...cookies, wordpress_test_cookie: 'WP+Cookie+check' }),
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://buddhaspa.com.br/wp-login.php',
      },
    }, postBody);

    const loginCookies = parseCookies(loginResp.headers['set-cookie']);
    cookies = { ...cookies, ...loginCookies };

    const isLogged = Object.keys(cookies).some(k => k.startsWith('wordpress_logged_in'));
    if (!isLogged) {
      return { nome: unidade.nome, id: null, erro: 'Login falhou' };
    }

    // 3. Acessa página de vouchers
    const vouchersResp = await request({
      protocol: 'https:',
      hostname: 'buddhaspa.com.br',
      path: '/wp-admin/admin.php?page=vouchers',
      method: 'GET',
      headers: {
        'Cookie': cookieString(cookies),
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const html = vouchersResp.body;

    // Tenta encontrar affiliation_id em campos hidden, selects, ou links
    const patterns = [
      /affill?iation_id['"=>\s]+['"]*(\d+)/gi,
      /name=['"']affill?iation_id['"] value=['"'](\d+)['"]/i,
      /affill?iation_id=(\d+)/g,
      /<option[^>]+value=['"](\d+)['"][^>]*>\s*(?:todos|all|\d)/gi,
    ];

    let id = null;
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match && match[1] && match[1] !== '0') {
        id = match[1];
        break;
      }
    }

    // Se não achou, busca todos os números que parecem IDs (6 dígitos) perto de "affiliation"
    if (!id) {
      const ctx = html.match(/affill?iation[^<]{0,200}/gi);
      if (ctx) {
        const nums = ctx.join(' ').match(/\b(\d{5,7})\b/g);
        if (nums) id = nums[0];
      }
    }

    return { nome: unidade.nome, id: id || '?', html_size: html.length };

  } catch (err) {
    return { nome: unidade.nome, id: null, erro: err.message };
  }
}

(async () => {
  console.log('Buscando Affiliation IDs...\n');
  for (const u of UNIDADES) {
    process.stdout.write(`${u.nome}... `);
    const result = await descobrirId(u);
    if (result.erro) {
      console.log(`ERRO: ${result.erro}`);
    } else {
      console.log(`ID = ${result.id} (html: ${result.html_size} bytes)`);
    }
  }
  console.log('\nMetropole (ja sabemos): 894555');
})();
