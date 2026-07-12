const ORIGIN = 'http://localhost:5173'
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
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyJhNDUyY2RlYTE0ODQzZDhjZjFmZDFiZjQyZGU0NDRkODE0NzU0MDNiIl0.579VV_-cAQAt6eTNnvA7RGcz39EqmYrsyrit0TwwQkQ'
const g = (s) => ORIGIN + s
;(async () => {
  let r = await fetch(g('/kryashen/ru/login'), { credentials: 'include' })
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]
  console.log('SET-COOKIE from /kryashen/ru/login:')
  ;(sc || []).forEach(c => console.log('  ' + c))
  let html = await r.text(); saveCookies(r)
  let csrf = extractCsrf(html)
  r = await fetch(g('/kryashen/ru/login/signIn'), { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() }, body: new URLSearchParams({ username: 'ojs', password: '35bfx140', csrfToken: csrf, remember: '1', source: '' }) })
  const sc2 = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]
  console.log('SET-COOKIE after signIn (session):')
  ;(sc2 || []).forEach(c => console.log('  ' + c))
  console.log('signIn status', r.status)
  const bad = (sc2 || []).some(c => /Path=\/index\.php/.test(c))
  console.log('any cookie still has /index.php path?', bad)
  let ct = await fetch(g('/kryashen/ru/login'), { credentials: 'include' }); let ch = await ct.text(); let tok = extractCsrf(ch)
  const before = await (await fetch(g('/kryashen/api/v1/issues'), { headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json' }, credentials: 'include' })).json()
  const slug = 'verifypath-' + Date.now().toString(36)
  const form = new URLSearchParams()
  form.set('volume', '99'); form.set('number', '99'); form.set('year', '2026')
  form.set('showVolume', '1'); form.set('showNumber', '1'); form.set('showYear', '1'); form.set('showTitle', '1')
  form.set('urlPath', slug); form.set('submitFormButton', '1')
  form.set('title[ru_RU]', 'VerifyPathTest'); form.set('description[ru_RU]', 't')
  form.set('title[ru]', 'VerifyPathTest'); form.set('title[en]', 'VerifyPathTest')
  form.set('description[ru]', 't'); form.set('description[en]', 't')
  form.set('csrfToken', tok)
  const url = g('/kryashen/$$$call$$$/grid/issues/future-issue-grid/update-issue?csrfToken=') + encodeURIComponent(tok)
  const cr = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json, text/javascript, */*; q=0.01', Cookie: cookieHeader() }, body: form.toString() })
  const respText = await cr.text()
  const after = await (await fetch(g('/kryashen/api/v1/issues'), { headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json' }, credentials: 'include' })).json()
  const created = (after.items || []).filter(x => (x.title && (x.title.ru || x.title.en || '')) === 'VerifyPathTest')
  console.log('CREATE status', cr.status, 'respLen', respText.length)
  console.log('FULL RESPONSE:', respText)
  console.log('issues before/after:', (before.items || []).length, '->', (after.items || []).length)
  console.log('created issue(s):', created.map(x => x.id))
  for (const d of created) {
    const u = g('/kryashen/$$$call$$$/grid/issues/future-issue-grid/delete-issue?csrfToken=') + encodeURIComponent(tok) + '&issueId=' + d.id
    await fetch(u, { method: 'POST', headers: { Accept: 'application/json, text/javascript, */*; q=0.01', Cookie: cookieHeader() } })
    console.log('cleaned', d.id)
  }
  if (created.length === 0) {
    const idx = respText.indexOf('issueDataNotification')
    console.log('NOTIFICATION snippet:', idx > -1 ? respText.slice(idx, idx + 200).replace(/<[^>]+>/g, ' ') : '(none)')
  }
})().catch(e => console.error('ERR', e.message))