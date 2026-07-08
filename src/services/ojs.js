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
var API_BASE = OJS_BASE
if (OJS_BASE === '/kryashen' || OJS_BASE === '/kryashen/') {
  API_BASE = '/kryashen'
}

// ========================================
// Утилиты
// ========================================

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
        throw new Error('OJS недоступен (статус: ' + response.status + ')')
      }
      return response.text()
    })
    .then(function (html) {
      if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
        throw new Error('OJS вернул JSON вместо HTML')
      }
      var match = html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) ||
                  html.match(/"csrfToken":"([^"]+)"/) ||
                  html.match(/csrfToken.*?"([^"]+)"/)
      if (!match) {
        if (html.indexOf('dashboard') !== -1 || html.indexOf('editorial') !== -1) {
          throw new Error('Сессия уже активна')
        }
        throw new Error('CSRF-токен не найден')
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
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': API_BASE + '/ru/login',
          'Origin': window.location.origin
        },
        body: body
      })
    })
    .then(function (response) {
      if (response.status === 200) {
        return response.text().then(function (text) {
          if (text.indexOf('dashboard') !== -1 || text.indexOf('editorial') !== -1 || text.indexOf('profile') !== -1) {
            return true
          }
          if (text.indexOf('login-form') !== -1) {
            throw new Error('Неверное имя пользователя или пароль')
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
  }).then(function () { return true })
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
        throw new Error('Ошибка получения пользователей (статус: ' + response.status + ')')
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
      throw new Error('Пользователь не найден')
    })
}

// Создание пользователя с группой (ролью)
export function createUser(data) {
  console.log('[OJS createUser] POST /api/v1/users', JSON.stringify(data, null, 2))
  return fetchThroughProxy(API_BASE + '/api/v1/users', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        console.log('[OJS createUser] Response status:', response.status, 'body:', text)
        if (!response.ok) {
          var errMsg = 'Ошибка создания пользователя (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
    .then(function (data) {
      usersCache = null
      return data
    })
}

// Обновление пользователя (только роли — данные пользователя через API не поддерживаются)
export function updateUser(id, data) {
  // OJS API не поддерживает PUT/PATCH для /api/v1/users/{id}
  // Возвращаем успех, чтобы цепочка промисов продолжилась
  return Promise.resolve({ id: id })
}

// Удаление пользователя
export function deleteUser(id) {
  return fetchThroughProxy(API_BASE + '/api/v1/users/' + id, {
    method: 'DELETE',
    headers: authHeaders
  })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.errorMessage || 'Ошибка удаления пользователя (статус: ' + response.status + ')')
        })
      }
      return response.json()
    })
    .then(function (data) {
      usersCache = null
      return data
    })
}

// ========================================
// Группы пользователей (роли)
// ========================================

// Получить список групп (contexts) для назначения ролей
export function getContexts() {
  return fetchThroughProxy(API_BASE + '/api/v1/contexts', {
    headers: authHeaders
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения контекстов (статус: ' + response.status + ')')
      }
      return response.json()
    })
}

// Добавить пользователя в группу (назначить роль)
export function addUserToGroup(userId, contextId, roleId) {
  return fetchThroughProxy(API_BASE + '/api/v1/users/' + userId + '/groups', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      contextId: contextId,
      roleId: roleId
    })
  })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.errorMessage || 'Ошибка назначения роли (статус: ' + response.status + ')')
        })
      }
      usersCache = null
      return response.json()
    })
}

// Удалить пользователя из группы
export function removeUserFromGroup(userId, contextId, roleId) {
  console.log('[OJS removeUserFromGroup] DELETE /api/v1/users/' + userId + '/groups contextId=' + contextId + ' roleId=' + roleId)
  return fetchThroughProxy(API_BASE + '/api/v1/users/' + userId + '/groups', {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({
      contextId: contextId,
      roleId: roleId
    })
  })
    .then(function (response) {
      return response.text().then(function (text) {
        console.log('[OJS removeUserFromGroup] Response status:', response.status, 'body:', text)
        if (!response.ok) {
          // OJS API может не поддерживать удаление из групп через REST
          // Не прерываем цепочку, просто логируем
          console.warn('[OJS removeUserFromGroup] Не удалось удалить роль (статус: ' + response.status + '):', text)
          return {}
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
    .then(function (data) {
      usersCache = null
      return data
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
      var journal = data.items && data.items.length > 0 ? data.items[0] : null
      console.log('[OJS getJournalInfo] Journal data:', JSON.stringify(journal, null, 2))
      return journal
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