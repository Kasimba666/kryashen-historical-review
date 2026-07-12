const ORIGIN = 'http://localhost:5173'
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
const rest = (s) => fetch(g(s), { headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json' }, credentials: 'include' })
;(async () => {
  // login via proxy
  let r = await fetch(g('/kryashen/ru/login'), { credentials: 'include' }); let html = await r.text(); saveCookies(r)
  let csrf = extractCsrf(html)
  r = await fetch(g('/kryashen/ru/login/signIn'), { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() }, body: new URLSearchParams({ username: 'ojs', password: '35bfx140', csrfToken: csrf, remember: '1', source: '' }) }); saveCookies(r)
  // journal (context)
  const journal = (await (await rest('/kryashen/api/v1/contexts')).json()).items[0]
  console.log('context id:', journal.id, 'primaryLocale:', journal.primaryLocale)
  // users
  const users = (await (await rest('/kryashen/api/v1/users')).json()).items || []
  const ojs = users.find(u => (u.userName || '').toLowerCase() === 'ojs')
  console.log('ojs user id:', ojs ? ojs.id : 'NOT FOUND')
  if (!ojs) { console.log('cannot find ojs'); return }
  // grant Journal Manager (16)
  const gr = await fetch(g('/kryashen/api/v1/users/' + ojs.id + '/groups'), { method: 'POST', headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ contextId: journal.id, roleId: 16 }) })
  const gtxt = await gr.text()
  console.log('addUserToGroup(16) status', gr.status, gtxt.slice(0, 200))
  // now try creating an issue
  let ct = await fetch(g('/kryashen/ru/login'), { credentials: 'include' }); let ch = await ct.text(); saveCookies(ct); let tok = extractCsrf(ch)
  const before = (await (await rest('/kryashen/api/v1/issues')).json()).items || []
  const slug = 'rolefix-' + Date.now().toString(36)
  const form = new URLSearchParams()
  form.set('volume', '77'); form.set('number', '77'); form.set('year', '2026')
  form.set('showVolume', '1'); form.set('showNumber', '1'); form.set('showYear', '1'); form.set('showTitle', '1')
  form.set('urlPath', slug); form.set('submitFormButton', '1')
  form.set('title[ru_RU]', 'RoleFixTest'); form.set('description[ru_RU]', 't')
  form.set('title[ru]', 'RoleFixTest'); form.set('title[en]', 'RoleFixTest')
  form.set('description[ru]', 't'); form.set('description[en]', 't')
  form.set('csrfToken', tok)
  const url = g('/kryashen/$$$call$$$/grid/issues/future-issue-grid/update-issue?csrfToken=') + encodeURIComponent(tok)
  const cr = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json, text/javascript, */*; q=0.01', Cookie: cookieHeader() }, body: form.toString() })
  const respText = await cr.text()
  const after = (await (await rest('/kryashen/api/v1/issues')).json()).items || []
  const created = after.filter(x => (x.title && (x.title.ru || x.title.en || '')) === 'RoleFixTest')
  console.log('CREATE status', cr.status, 'respLen', respText.length)
  console.log('RESPONSE:', respText.slice(0, 300))
  console.log('issues before/after:', before.length, '->', after.length)
  console.log('created issue(s):', created.map(x => x.id))
  for (const d of created) {
    const u = g('/kryashen/$$$call$$$/grid/issues/future-issue-grid/delete-issue?csrfToken=') + encodeURIComponent(tok) + '&issueId=' + d.id
    await fetch(u, { method: 'POST', headers: { Accept: 'application/json, text/javascript, */*; q=0.01', Cookie: cookieHeader() } })
    console.log('cleaned', d.id)
  }
})().catch(e => console.error('ERR', e.message))