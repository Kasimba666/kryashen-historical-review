const ORIGIN = 'http://localhost:5173'
const DIRECT = 'https://tarihjournals.ru/index.php/kryashen'
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyJhNDUyY2RlYTE0ODQzZDhjZjFmZDFiZjQyZGU0NDRkODE0NzU0MDNiIl0.579VV_-cAQAt6eTNnvA7RGcz39EqmYrsyrit0TwwQkQ'
let cookies = {}
function saveCookies(r) {
  const list = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : [])
  for (const c of list) { const p = c.split(';')[0]; const i = p.indexOf('='); if (i > -1) cookies[p.slice(0, i)] = p.slice(i + 1) }
}
const cookieHeader = () => Object.keys(cookies).map(k => k + '=' + cookies[k]).join('; ')
function extractCsrf(t) {
  const m = t.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) || t.match(/csrfToken[=:]\s*"?([a-zA-Z0-9]{16,})/i) || t.match(/csrf-token[=:]\s*"?([a-zA-Z0-9]{16,})/i)
  return m ? m[1] : null
}
const g = (s) => ORIGIN + s
;(async () => {
  // login via PROXY
  let r = await fetch(g('/kryashen/ru/login'), { credentials: 'include' }); let html = await r.text(); saveCookies(r)
  let csrf = extractCsrf(html)
  r = await fetch(g('/kryashen/ru/login/signIn'), { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() }, body: new URLSearchParams({ username: 'ojs', password: '35bfx140', csrfToken: csrf, remember: '1', source: '' }) }); saveCookies(r)
  const ojsSid = cookies['OJSSID']
  console.log('proxy-login OJSSID =', ojsSid)
  // replay that SAME cookie value against the DIRECT server
  const tokDirect = extractCsrf(await (await fetch(DIRECT + '/ru/login', { headers: { Cookie: 'OJSSID=' + ojsSid } })).text())
  console.log('csrf (direct, using proxy cookie):', tokDirect)
  const slug = 'isolate-' + Date.now().toString(36)
  const form = new URLSearchParams()
  form.set('volume', '55'); form.set('number', '55'); form.set('year', '2026')
  form.set('showVolume', '1'); form.set('showNumber', '1'); form.set('showYear', '1'); form.set('showTitle', '1')
  form.set('urlPath', slug); form.set('submitFormButton', '1')
  form.set('title[ru_RU]', 'IsolateTest'); form.set('description[ru_RU]', 't')
  form.set('title[ru]', 'IsolateTest'); form.set('title[en]', 'IsolateTest')
  form.set('description[ru]', 't'); form.set('description[en]', 't')
  form.set('csrfToken', tokDirect)
  const url = DIRECT + '/$$$call$$$/grid/issues/future-issue-grid/update-issue?csrfToken=' + encodeURIComponent(tokDirect)
  const cr = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json, text/javascript, */*; q=0.01', Cookie: 'OJSSID=' + ojsSid }, body: form.toString() })
  const resp = await cr.text()
  console.log('DIRECT server with proxy cookie -> status', cr.status, 'resp:', resp.slice(0, 200))
  const after = (await (await fetch(DIRECT + '/api/v1/issues', { headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json' } })).json()).items || []
  const created = after.filter(x => (x.title && (x.title.ru || x.title.en || '')) === 'IsolateTest')
  console.log('created on direct via proxy cookie:', created.map(x => x.id))
  for (const d of created) {
    const u = DIRECT + '/$$$call$$$/grid/issues/future-issue-grid/delete-issue?csrfToken=' + encodeURIComponent(tokDirect) + '&issueId=' + d.id
    await fetch(u, { method: 'POST', headers: { Accept: 'application/json, text/javascript, */*; q=0.01', Cookie: 'OJSSID=' + ojsSid } })
    console.log('cleaned', d.id)
  }
})().catch(e => console.error('ERR', e.message))