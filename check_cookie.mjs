const ORIGIN='http://localhost:5174'
let r=await fetch(ORIGIN+'/kryashen/ru/login',{credentials:'include'})
console.log('login page status',r.status)
const sc=r.headers.getSetCookie?r.headers.getSetCookie():[r.headers.get('set-cookie')]
console.log('SET-COOKIE from /kryashen/ru/login:')
;(sc||[]).forEach(c=>console.log('  '+c))
// also try login POST to see session cookie path
import {readFileSync} from 'fs'
const html=await r.text()
const csrf=(html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/)||[])[1]
r=await fetch(ORIGIN+'/kryashen/ru/login/signIn',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'ojs',password:'35bfx140',csrfToken:csrf,remember:'1',source:''})})
const sc2=r.headers.getSetCookie?r.headers.getSetCookie():[r.headers.get('set-cookie')]
console.log('SET-COOKIE after signIn (session):')
;(sc2||[]).forEach(c=>console.log('  '+c))