// Cloudflare Worker — прокси для OJS
// Деплой: зайти на https://dash.cloudflare.com →
// Workers & Pages → Create Worker → вставить этот код → Save and Deploy
//
// Как работает:
// SPA на kryashen.tarihjournals.ru делает fetch-запросы к этому Worker'у
// (указан как VITE_OJS_PROXY_URL). Worker проксирует их на реальный OJS
// (tarihjournals.ru) с передачей cookie и добавляет правильные CORS-заголовки.
//
// Без Worker'а браузер блокировал бы запросы CORS-политикой, т.к.
// kryashen.tarihjournals.ru и tarihjournals.ru — разные origin'ы.

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

  // ВАЖНО: Access-Control-Allow-Origin НЕ должен быть '*' при credentials: 'include'.
  // Вместо '*' возвращаем конкретный origin запроса (kryashen.tarihjournals.ru).
  var requestOrigin = request.headers.get('Origin')
  if (requestOrigin) {
    responseHeaders.set('Access-Control-Allow-Origin', requestOrigin)
  }
  responseHeaders.set('Access-Control-Allow-Credentials', 'true')
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept')

  // Переписываем Set-Cookie: убираем SameSite, Secure, Domain,
  // чтобы браузер принимал cookie (через прокси это безопасно)
  var setCookie = responseHeaders.get('Set-Cookie')
  if (setCookie) {
    setCookie = setCookie
      .replace(/;\s*SameSite=(Lax|Strict|None)/gi, '')
      .replace(/;\s*Secure/gi, '')
      .replace(/Domain=[^;]+/gi, '')
    responseHeaders.set('Set-Cookie', setCookie)
  }

  // Переписываем Location (редиректы) — заменяем URL OJS на путь
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