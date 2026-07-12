const ORIGIN = 'http://localhost:5174'
let cookies = {}
function saveCookies(r){const list=r.headers.getSetCookie?r.headers.getSetCookie():(r.headers.get('set-cookie')?[r.headers.get('set-cookie')]:[]);for(const c of list){const p=c.split(';')[0];const i=p.indexOf('=');if(i>-1)cookies[p.slice(0,i)]=p.slice(i+1)}}
const cookieHeader=()=>Object.keys(cookies).map(k=>k+'='+cookies[k]).join('; ')
function extractCsrf(t){const m=t.match(/name="csrf-token"\s+content="([^"]+)"/)||t.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/)||t.match(/csrfToken[=:]\s*"?([a-zA-Z0-9]{16,})/i)||t.match(/csrf-token[=:]\s*"?([a-zA-Z0-9]{16,})/i);return m?m[1]:null}
const API='/kryashen/api/v1/issues'  // proxied
function g(s){return ORIGIN+s}
async function getIssues(){const r=await fetch(g(API),{headers:{Authorization:'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyJhNDUyY2RlYTE0ODQzZDhjZjFmZDFiZjQyZGU0NDRkODE0NzU0MDNiIl0.579VV_-cAQAt6eTNnvA7RGcz39EqmYrsyrit0TwwQkQ',Accept:'application/json'},credentials:'include'});saveCookies(r);const j=await r.json();return j.items||[]}
let r=await fetch(g('/kryashen/ru/login'),{credentials:'include'});let html=await r.text();saveCookies(r)
let csrf=(html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/)||[])[1]
r=await fetch(g('/kryashen/ru/login/signIn'),{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:cookieHeader()},body:new URLSearchParams({username:'ojs',password:'35bfx140',csrfToken:csrf,remember:'1',source:''})});saveCookies(r)
console.log('login status',r.status)
// getComponentToken via proxy
let ct=await fetch(g('/kryashen/ru/login'),{credentials:'include'});let ch=await ct.text();saveCookies(ct);let tok=extractCsrf(ch)
if(!tok){console.log('no csrf from /ru/login, html len',ch.length)}
// create via proxy component handler
const slug='proxytest-'+Date.now().toString(36)
const form=new URLSearchParams()
form.set('volume','12');form.set('number','12');form.set('year','2026')
form.set('showVolume','1');form.set('showNumber','1');form.set('showYear','1');form.set('showTitle','1')
form.set('urlPath',slug);form.set('submitFormButton','1')
form.set('title[ru]','ПроксиТестСоздания');form.set('description[ru]','')
form.set('csrfToken',tok)
const url=g('/kryashen/$$$call$$$/grid/issues/future-issue-grid/update-issue?csrfToken=')+encodeURIComponent(tok)
const cr=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json, text/javascript, */*; q=0.01',Cookie:cookieHeader()},body:form.toString()})
const respText=await cr.text();saveCookies(cr)
console.log('CREATE status',cr.status,'respLen',respText.length)
console.log('CREATE resp head:', respText.slice(0,200))
const before=await getIssues()
console.log('issues before/after check done, current count',before.length)
console.log('new issue present:', before.some(x=>(x.title&&(x.title.ru||x.title.en||''))==='ПроксиТестСоздания'))
// cleanup
for(const d of before.filter(it=>(it.title&&(it.title.ru||it.title.en||''))==='ПроксиТестСоздания')){
  const u=g('/kryashen/$$$call$$$/grid/issues/future-issue-grid/delete-issue?csrfToken=')+encodeURIComponent(tok)+'&issueId='+d.id
  await fetch(u,{method:'POST',headers:{Accept:'application/json, text/javascript, */*; q=0.01',Cookie:cookieHeader()}});console.log('cleaned',d.id)
}