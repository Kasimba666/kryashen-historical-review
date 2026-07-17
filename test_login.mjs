// Test login to OJS through the Cloudflare Worker proxy
// Worker adds /index.php/kryashen to every request, so we send just /ru/login
const PROXY = 'https://kryashen-proxy.kasimba666.workers.dev';

async function testLogin() {
  // Step 1: Get login page + CSRF token
  console.log('Fetching login page via proxy...');
  const loginResp = await fetch(PROXY + '/ru/login', { credentials: 'include' });
  console.log('Status:', loginResp.status);
  const html = await loginResp.text();
  console.log('Response length:', html.length);
  console.log('First 300 chars:', html.slice(0, 300));
  
  const csrfMatch = html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/);
  if (!csrfMatch) {
    console.log('CSRF token NOT found in response');
    const hasLoginForm = html.includes('login-form') || html.includes('signIn');
    const isDashboard = html.includes('dashboard') || html.includes('profile');
    console.log('Has login form:', hasLoginForm, 'Is dashboard:', isDashboard);
    return;
  }
  
  const csrfToken = csrfMatch[1];
  console.log('CSRF token found:', csrfToken.slice(0, 20) + '...');
  
  // Step 2: Login with ojs / 35bfx140
  console.log('Attempting login with ojs / 35bfx140...');
  const body = 'username=ojs&password=35bfx140&csrfToken=' + encodeURIComponent(csrfToken) + '&remember=1&source=';
  const loginResp2 = await fetch(PROXY + '/ru/login/signIn', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': PROXY + '/ru/login',
      'Origin': 'https://kasimba666.github.io'
    },
    body: body
  });
  
  const text = await loginResp2.text();
  console.log('Login status:', loginResp2.status);
  console.log('Has dashboard:', text.includes('dashboard'));
  console.log('Has login form:', text.includes('login-form'));
  console.log('Has editorial:', text.includes('editorial'));
  console.log('Has profile:', text.includes('profile'));
  
  const isSuccess = text.includes('dashboard') || text.includes('editorial') || text.includes('profile');
  console.log('Login:', isSuccess ? 'SUCCESS' : 'FAIL');
  
  if (!isSuccess) {
    const errMatch = text.match(/class="[^"]*formError[^"]*"[^>]*>([^<]+)/);
    if (errMatch) console.log('Error:', errMatch[1]);
    const fs = await import('fs');
    fs.writeFileSync('login_response.html', text);
    console.log('Response saved to login_response.html');
  }
}

testLogin().catch(function(e) {
  console.error('Error:', e.message);
});