import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// CORS заголовки для development (credentials require exact origin)
function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'http://localhost:5174',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
  }
}

// OJS отдаёт сессионную cookie с Path=/index.php/kryashen (реальный путь на
// сервере). Прокси переписывает путь запроса /kryashen -> /index.php/kryashen,
// но cookiePathRewrite: { '/': '/' } НЕ перехватывает /index.php/kryashen,
// поэтому браузер сохраняет cookie с путём /index.php/kryashen и НЕ шлёт её
// обратно на запросы приложения /kryashen/... . В итоге component-handler
// (создание/публикация выпуска и т.п., работающий по сессии) уходит
// НЕавторизованным и молча не сохраняет данные.
// Здесь мы явно переписываем Path обратно в /kryashen и снимаем флаг Secure
// (dev-прокси — обычный http://localhost), чтобы cookie сохранялась и
// отсылалась браузером на все /kryashen/* запросы.
function fixSetCookie(proxyRes) {
  var sc = proxyRes.headers['set-cookie']
  if (!sc) return
  var fixed = sc.map(function (c) {
    return c
      .replace(/Path=\/index\.php\/kryashen/g, 'Path=/kryashen')
      .replace(/Path=\/index\.php/g, 'Path=/')
      .replace(/;\s*Secure/gi, '')
      .replace(/Domain=[^;]+/gi, 'Domain=localhost')
  })
  proxyRes.headers['set-cookie'] = fixed
}

// Общий обработчик ответа прокси: переписываем редиректы и чиним cookie.
function configureProxy(proxy) {
  proxy.on('proxyReq', function (proxyReq, req, res) {
    if (/\$\$\$call\$\$\$/.test(req.url) || /signIn/.test(req.url)) {
      console.log('[proxyReq]', req.method, req.url, '| Host:', proxyReq.getHeader('host'), '| Cookie:', proxyReq.getHeader('cookie'))
    }
  })
  proxy.on('proxyRes', function (proxyRes, req, res) {
    var location = proxyRes.headers['location']
    if (location) {
      var currentOrigin = req.headers.origin || 'http://localhost:5173'
      location = location.replace(
        /https?:\/\/tarihjournals\.ru\/index\.php\/kryashen\//g,
        currentOrigin + '/kryashen/'
      )
      location = location.replace(
        /https?:\/\/tarihjournals\.ru\/ru\//g,
        currentOrigin + '/kryashen/ru/'
      )
      location = location.replace(
        /https?:\/\/tarihjournals\.ru\//g,
        currentOrigin + '/kryashen/'
      )
      if (location.startsWith('/')) {
        location = currentOrigin + '/kryashen' + location
      }
      proxyRes.headers['location'] = location
    }
    fixSetCookie(proxyRes)
    var headers = getCorsHeaders(req.headers.origin)
    Object.keys(headers).forEach(function (key) {
      res.setHeader(key, headers[key])
    })
  })
}

// Плагин: после сборки копирует index.html в 404.html для поддержки SPA-роутинга на GitHub Pages
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback',
    closeBundle: function () {
      var distDir = join(process.cwd(), 'dist')
      var src = join(distDir, 'index.html')
      var dest = join(distDir, '404.html')
      if (existsSync(src)) {
        copyFileSync(src, dest)
        console.log('[spa-fallback] Copied index.html -> 404.html')
      } else {
        console.warn('[spa-fallback] dist/index.html not found, skipping')
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Определяем base URL в зависимости от режима
  // В production (gh-pages) - используем репозиторий как базу
  // В development - корень сайта
  var baseUrl = mode === 'production' ? '/kryashen-historical-review/' : '/'

  return {
    plugins: [
      vue(),
      vueDevTools(),
      spaFallbackPlugin()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    base: baseUrl,
    server: {
      proxy: {
        '/kryashen': {
          target: 'https://tarihjournals.ru',
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: 'localhost',
          cookiePathRewrite: {
            '/index.php/kryashen': '/kryashen',
            '/index.php': '/',
            '/': '/'
          },
          rewrite: function (path) {
            return path.replace(/^\/kryashen/, '/index.php/kryashen')
          },
          configure: configureProxy
        },
        '/ru': {
          target: 'https://tarihjournals.ru',
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: 'localhost',
          cookiePathRewrite: {
            '/index.php/kryashen': '/kryashen',
            '/index.php': '/',
            '/': '/'
          },
          rewrite: function (path) {
            return '/index.php' + path
          },
          configure: configureProxy
        }
      }
    }
  }
})