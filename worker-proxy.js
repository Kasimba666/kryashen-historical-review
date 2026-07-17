// Cloudflare Worker — прокси для OJS
// Деплой: 
//   1. Зарегистрироваться на https://cloudflare.com
//   2. Создать Worker, вставить этот код
//   3. Получить URL вида https://kryashen-proxy.username.workers.dev
//   4. Указать этот URL в .env.production как VITE_OJS_PROXY_URL
//
// Worker принимает запросы от SPA на gh-pages, добавляет/проксирует
// cookie и пересылает на реальный OJS-сервер tarihjournals.ru.
// Это единственный способ обойти SameSite-ограничения браузера
// при кросс-доменных запросах с сессионными cookie.

// Реальный OJS-сервер
var OJS_ORIGIN = 'https://tarihjournals.ru'
var OJS_BASE = '/index.php/kryashen'

addEventListener('fetch', function (event) {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  var url = new URL(request.url)
  var path = url.pathname + url.search

  // Строим целевой URL на OJS
  var targetUrl = OJS_ORIGIN + OJS_BASE + path

  // Копируем заголовки запроса
  var headers = new Headers(request.headers)

  // Устанавливаем корректный Host
  headers.set('Host', new URL(OJS_ORIGIN).host)

  // Проксируем cookie: Worker получает cookie от браузера (если есть)
  // и передаёт их на OJS. OJS устанавливает cookie в ответе, Worker
  // возвращает их браузеру.
  // Важно: браузер считает Worker тем же сайтом (same-origin), поэтому
  // SameSite не блокирует cookie.

  // Убираем заголовки, которые могут помешать
  headers.delete('Origin')
  headers.set('X-Forwarded-Host', url.hostname)

  // Создаём запрос к OJS
  var proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    redirect: 'manual'
  })

  // Отправляем запрос к OJS
  var response = await fetch(proxyRequest)

  // Копируем ответ и добавляем CORS-заголовки
  var responseHeaders = new Headers(response.headers)

  // CORS: разрешаем запросы с gh-pages
  responseHeaders.set('Access-Control-Allow-Origin', '*')
  responseHeaders.set('Access-Control-Allow-Credentials', 'true')
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept')

  // Переписываем Set-Cookie: убираем SameSite, чтобы браузер принимал cookie
  // с любого сайта (через прокси это безопасно, т.к. запросы идут через Worker)
  var setCookie = responseHeaders.get('Set-Cookie')
  if (setCookie) {
    setCookie = setCookie
      .replace(/;\s*SameSite=(Lax|Strict|None)/gi, '')
      .replace(/;\s*Secure/gi, '')
      .replace(/Domain=[^;]+/gi, '')
    responseHeaders.set('Set-Cookie', setCookie)
  }

  // Переписываем Location (редиректы)
  var location = responseHeaders.get('Location')
  if (location) {
    location = location.replace(OJS_ORIGIN + OJS_BASE, '')
    location = location.replace(OJS_ORIGIN, '')
    responseHeaders.set('Location', location)
  }

  // Возвращаем ответ
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  })
}