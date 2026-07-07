import { USERS_CACHE_DURATION } from '@/config/constants'

var OJS_BASE = import.meta.env.VITE_OJS_BASE_URL
var API_KEY = import.meta.env.VITE_OJS_API_KEY

// Заголовки с API-ключом
var authHeaders = {
  'Authorization': 'Bearer ' + API_KEY,
  'Accept': 'application/json'
}

// Кэш для пользователей
var usersCache = null
var usersCacheTime = 0

// Определяем базовый URL для API в зависимости от окружения
// В development используем относительные пути через прокси
// В production - прямой URL к OJS серверу
var API_BASE = OJS_BASE
if (OJS_BASE === '/kryashen' || OJS_BASE === '/kryashen/') {
  // Прокси режим (development) - используем относительный путь
  API_BASE = '/kryashen'
}
// Для полных URL (production) оставляем OJS_BASE как API_BASE

// ========================================
// Утилиты
// ========================================

/**
 * Выполнить fetch через прокси (relative URL - работает везде)
 */
function fetchThroughProxy(url, options) {
  options = options || {}
  if (!options.credentials) {
    options.credentials = 'include'
  }
  return fetch(url, options)
}

// ========================================
// Аутентификация
// ========================================

export function getCsrfToken() {
  return fetchThroughProxy(API_BASE + '/ru/login', {
    credentials: 'include'
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('OJS недоступен (статус: ' + response.status + '). Проверьте соединение с сервером.')
      }
      return response.text()
    })
    .then(function (html) {
      if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
        throw new Error('OJS вернул JSON вместо HTML. Проверьте URL в .env: ' + html.substring(0, 200))
      }
      var match = html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) ||
                  html.match(/"csrfToken":"([^"]+)"/) ||
                  html.match(/csrfToken.*?"([^"]+)"/)
      if (!match) {
        if (html.indexOf('dashboard') !== -1 || html.indexOf('editorial') !== -1) {
          throw new Error('Сессия уже активна. Выйдите из OJS перед повторным входом.')
        }
        if (html.indexOf('login-form') === -1 && html.indexOf('loginForm') === -1) {
          throw new Error('Страница не содержит форму логина. Проверьте URL OJS в .env файле.')
        }
        throw new Error('CSRF-токен не найден. Форма: ' + html.substring(0, 300))
      }
      return match[1]
    })
}

export function login(username, password) {
  return getCsrfToken()
    .then(function (csrfToken) {
      var body = 'username=' + encodeURIComponent(username) +
                 '&password=' + encodeURIComponent(password) +
                 '&csrfToken=' + encodeURIComponent(csrfToken) +
                 '&remember=1&source='
      
      return fetchThroughProxy(API_BASE + '/ru/login/signIn', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': API_BASE + '/ru/login',
          'Origin': window.location.origin
        },
        body: body
      })
    })
    .then(function (response) {
      var location = response.headers.get('location')
      if (location && (response.status === 302 || response.status === 301)) {
        return true
      }
      if (response.status === 200) {
        return response.text().then(function (text) {
          if (text.indexOf('dashboard') !== -1 || 
              text.indexOf('editorial') !== -1 ||
              text.indexOf('profile') !== -1) {
            return true
          }
          if (text.indexOf('login-form') !== -1 || text.indexOf('loginForm') !== -1) {
            throw new Error('Неверное имя пользователя (email) или пароль')
          }
          return true
        })
      }
      if (response.status >= 200 && response.status < 400) {
        return true
      }
      throw new Error('Ошибка сервера: ' + response.status)
    })
    .catch(function (error) {
      console.error('[OJS Login Error]', error)
      throw error
    })
}

export function logout() {
  return fetchThroughProxy(API_BASE + '/ru/login/signOut', {
    method: 'GET',
    credentials: 'include',
    redirect: 'manual'
  })
    .then(function () {
      return true
    })
}

// ========================================
// Пользователи
// ========================================

export function getUsers() {
  if (usersCache && Date.now() - usersCacheTime < USERS_CACHE_DURATION) {
    return Promise.resolve(usersCache)
  }
  return fetchThroughProxy(API_BASE + '/api/v1/users', {
    headers: authHeaders
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения списка пользователей (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      usersCache = data.items || []
      usersCacheTime = Date.now()
      return usersCache
    })
}

export function getUserById(id) {
  return fetchThroughProxy(API_BASE + '/api/v1/users/' + id, {
    headers: authHeaders
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения пользователя (статус: ' + response.status + ')')
      }
      return response.json()
    })
}

export function findUserByLogin(login) {
  return getUsers()
    .then(function (users) {
      login = login.toLowerCase().trim()
      for (var i = 0; i < users.length; i++) {
        var u = users[i]
        if (u.userName && u.userName.toLowerCase() === login) return u
        if (u.email && u.email.toLowerCase() === login) return u
      }
      throw new Error('Пользователь с таким именем или email не найден')
    })
    .catch(function (error) {
      throw new Error('Не удалось найти пользователя: ' + error.message)
    })
}

// ========================================
// Журнал и выпуски
// ========================================

export function getJournalInfo() {
  return fetchThroughProxy(API_BASE + '/api/v1/contexts', { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения информации о журнале (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items && data.items.length > 0 ? data.items[0] : null
    })
}

export function getIssues() {
  return fetchThroughProxy(API_BASE + '/api/v1/issues', { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения списка выпусков (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items || []
    })
}

export function getIssueDetail(id) {
  return fetchThroughProxy(API_BASE + '/api/v1/issues/' + id, { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения деталей выпуска (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data
    })
}

export function createIssue(data) {
  return fetchThroughProxy(API_BASE + '/api/v1/issues', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.errorMessage || 'Ошибка создания выпуска (статус: ' + response.status + ')')
        })
      }
      return response.json()
    })
}

export function updateIssue(id, data) {
  return fetchThroughProxy(API_BASE + '/api/v1/issues/' + id, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.errorMessage || 'Ошибка обновления выпуска (статус: ' + response.status + ')')
        })
      }
      return response.json()
    })
}

export function deleteIssue(id) {
  return fetchThroughProxy(API_BASE + '/api/v1/issues/' + id, {
    method: 'DELETE',
    headers: authHeaders
  })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.errorMessage || 'Ошибка удаления выпуска (статус: ' + response.status + ')')
        })
      }
      return response.json()
    })
}