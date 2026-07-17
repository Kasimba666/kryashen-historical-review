// Проверка работы SPA-роутинга на GitHub Pages
const BASE = 'https://kasimba666.github.io/kryashen-historical-review'

const urls = [
  '/',
  '/login',
  '/about',
  '/users',
  '/issues/1',
  '/tables-check'
]

async function check() {
  for (const url of urls) {
    const resp = await fetch(BASE + url)
    const text = await resp.text()
    const hasApp = text.includes('<div id="app"></div>')
    const hasScript = text.includes('kryashen-historical-review/assets/index')
    const isGhPages404 = text.includes('GitHub Pages') && text.includes('Page not found')
    console.log(url, '->', resp.status, '| app:', hasApp, '| script:', hasScript, '| gh-404:', isGhPages404)
  }
}

check().catch(e => console.error(e))