# Кряшен Historical Review

Веб-приложение для работы с журналом Кряшенского народного историко-краеведческого журнала.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
yarn
```

### Compile and Hot-Reload for Development

```sh
yarn dev
```

### Compile and Minify for Production

```sh
yarn build
```

### Deploy to GitHub Pages

```sh
yarn deploy
```

Приложение будет доступно по адресу: https://kasimba666.github.io/kryashen-historical-review/

## Ограничения GitHub Pages

На gh-pages доступны **только операции чтения**: просмотр выпусков, статей, пользователей, проверка таблиц.

**Создание, редактирование, публикация и удаление выпусков** работают **только в локальном режиме** (`yarn dev`).
Причина: эти операции требуют сессионной cookie OJS, а браузер блокирует кросс-доменную отправку cookie
с `kasimba666.github.io` на `tarihjournals.ru` (SameSite-политика).

### Для работы с выпусками

```sh
yarn dev
# откройте http://localhost:5173/
```

### Cloudflare Worker Proxy (опционально)

Если нужна полноценная работа на gh-pages — разверните Cloudflare Worker:

```sh
# 1. Создать аккаунт на https://cloudflare.com (бесплатно)
# 2. Развернуть прокси
wrangler deploy worker-proxy.js --name kryashen-proxy

# 3. Указать полученный URL в .env.production
VITE_OJS_PROXY_URL=https://kryashen-proxy.your-username.workers.dev

# 4. Пересобрать и задеплоить
yarn deploy
```

## Demo Account

- Login: ojs
- Password: 35bfx140