const BASE = 'https://tarihjournals.ru/index.php/kryashen'
const LOGIN = 'ojs'
const PASSWORD = '35bfx140'
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyJhNDUyY2RlYTE0ODQzZDhjZjFmZDFiZjQyZGU0NDRkODE0NzU0MDNiIl0.579VV_-cAQAt6eTNnvA7RGcz39EqmYrsyrit0TwwQkQ'
let cookies = {}
function saveCookies(r) {
  const list = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : [])
  for (const c of list) { const p = c.split(';')[0]; const i = p.indexOf('='); if (i>-1) cookies[p.slice(0,i)] = p.slice(i+1) }
}
const cookieHeader = () => Object.keys(cookies).map(k => k+'='+cookies[k]).join('; ')
function extractCsrf(text) {
  const m = text.match(/name="csrf-token"\s+content="([^"]+)"/) ||
            text.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) ||
            text.match(/csrfToken[=:]\s*"?([a-zA-Z0-9]{16,})/i) ||
            text.match(/csrf-token[=:]\s*"?([a-zA-Z0-9]{16,})/i)
  return m ? m[1] : null
}
async function getComponentToken() {
  let r = await fetch(BASE + '/ru/login', { headers: cookieHeader() ? { Cookie: cookieHeader() } : {}, redirect:'manual' })
  let tok
  if (r.status === 302) {
    const dash = await (await fetch(r.headers.get('location'), { headers:{ Cookie: cookieHeader() } })).text()
    tok = extractCsrf(dash)
  } else {
    tok = extractCsrf(await r.text())
  }
  if (!tok) {
    r = await fetch(BASE + '/ru', { headers:{ Cookie: cookieHeader() }, redirect:'manual' })
    const t2 = r.status===302 ? await (await fetch(r.headers.get('location'), { headers:{ Cookie: cookieHeader() } })).text() : await r.text()
    tok = extractCsrf(t2)
  }
  return tok
}
let r = await fetch(BASE + '/ru/login'); let html = await r.text(); saveCookies(r)
let csrf = (html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) || [])[1]
r = await fetch(BASE + '/ru/login/signIn', { method:'POST', redirect:'manual', headers:{ 'Content-Type':'application/x-www-form-urlencoded', Cookie: cookieHeader() }, body: new URLSearchParams({ username: LOGIN, password: PASSWORD, csrfToken: csrf, remember:'1', source:'' }) }); saveCookies(r)
const restHeaders = () => ({ Authorization: 'Bearer ' + API_KEY, Accept: 'application/json', Cookie: cookieHeader() })
async function count() { return ((await (await fetch(BASE + '/api/v1/issues', { headers: restHeaders() })).json()).items || []).length }
async function createIssue(n) {
  const tok = await getComponentToken()
  console.log('[create ' + n + '] csrf=' + tok)
  const before = await count()
  const slug = 'twice' + n + '-' + Date.now()
  const form = new URLSearchParams()
  form.set('volume', String(n)); form.set('number', String(n)); form.set('year', '2026')
  form.set('showVolume','1'); form.set('showNumber','1'); form.set('showYear','1'); form.set('showTitle','1')
  form.set('urlPath', slug); form.set('submitFormButton','1')
  form.set('title[ru_RU]', 'Twice'+n); form.set('description[ru_RU]','t')
  form.set('title[ru]', 'Twice'+n); form.set('title[en]', 'Twice'+n)
  form.set('description[ru]','t'); form.set('description[en]','t')
  form.set('csrfToken', tok)
  const url = BASE + '/$$$call$$$/grid/issues/future-issue-grid/update-issue?csrfToken=' + encodeURIComponent(tok)
  const cr = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', Accept:'application/json, text/javascript, */*; q=0.01', Cookie: cookieHeader() }, body: form.toString() })
  const ct = await cr.text()
  const after = await count()
  console.log('[create ' + n + '] status=' + cr.status + ' before=' + before + ' after=' + after + ' ' + (after>before?'OK':'FAIL') + ' respLen=' + ct.length)
  const idm = ct.match(/update-issue\?issueId=(\d+)/)
  if (idm) console.log('   new issueId in form: ' + idm[1])
  return after > before
}
const ok1 = await createIssue(1)
const ok2 = await createIssue(2)
const ok3 = await createIssue(3)
console.log('results:', ok1, ok2, ok3)
const issues = (await (await fetch(BASE + '/api/v1/issues', { headers: restHeaders() })).json()).items || []
const tok = await getComponentToken()
for (const d of issues.filter(it => /Twice/i.test((it.title&&(it.title.ru||it.title.en||''))||''))) {
  const url = BASE + '/$$$call$$$/grid/issues/future-issue-grid/delete-issue?csrfToken=' + encodeURIComponent(tok) + '&issueId=' + d.id
  await fetch(url, { method:'POST', headers:{ Accept:'application/json, text/javascript, */*; q=0.01', Cookie: cookieHeader() } })
  console.log('cleaned issue', d.id)
}