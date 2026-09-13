const https = require('https');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  // 1. GET login page
  const page = await request({
    protocol: 'https:', hostname: 'buddhaspa.com.br', path: '/wp-login.php',
    method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  console.log('Login page status:', page.status);
  const setCookies = page.headers['set-cookie'] || [];
  console.log('Cookies recebidos:', setCookies.map(c => c.split(';')[0]));

  const cookies = {};
  setCookies.forEach(c => {
    const [k, v] = c.split(';')[0].split('=');
    cookies[k.trim()] = v || '';
  });
  cookies['wordpress_test_cookie'] = 'WP+Cookie+check';

  const cookieStr = Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');

  // 2. POST login
  const body = new URLSearchParams({
    log: 'buddhashoppingmooca',
    pwd: 'Mooca@0033',
    'wp-submit': 'Log In',
    redirect_to: '/wp-admin/',
    testcookie: '1',
  }).toString();

  const resp = await request({
    protocol: 'https:', hostname: 'buddhaspa.com.br', path: '/wp-login.php',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://buddhaspa.com.br/wp-login.php',
    },
  }, body);

  console.log('\nLogin POST status:', resp.status);
  console.log('Location:', resp.headers.location || '(nenhum)');
  const loginCookies = resp.headers['set-cookie'] || [];
  console.log('Cookies login:', loginCookies.map(c => c.split(';')[0]));

  // Mostra inicio do body para ver se tem erro
  const bodySnippet = resp.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500);
  console.log('\nResposta (texto):', bodySnippet);
})();
