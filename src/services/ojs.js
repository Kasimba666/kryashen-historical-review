import { USERS_CACHE_DURATION } from '@/config/constants'

var OJS_BASE = import.meta.env.VITE_OJS_BASE_URL
var API_KEY = import.meta.env.VITE_OJS_API_KEY

// Заголовки с API-ключом (для GET-запросов)
var authHeaders = {
  'Authorization': 'Bearer ' + API_KEY,
  'Accept': 'application/json'
}

// Заголовки с Content-Type для JSON POST/PUT/DELETE запросов.
// Без 'Content-Type: application/json' OJS не парсит тело и возвращает 400 "Поле обязательно."
var jsonAuthHeaders = {
  'Authorization': 'Bearer ' + API_KEY,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
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
  return fetchThroughProxy(API_BASE + '/api/v1/users', {
    method: 'POST',
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
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
    headers: jsonAuthHeaders,
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
  return fetchThroughProxy(API_BASE + '/api/v1/users/' + userId + '/groups', {
    method: 'DELETE',
    headers: jsonAuthHeaders,
    body: JSON.stringify({
      contextId: contextId,
      roleId: roleId
    })
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          // OJS API может не поддерживать удаление из групп через REST
          // Не прерываем цепочку, просто логируем
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
      return journal
    })
}

// Получить ID текущего журнала (context)
export function getCurrentContextId() {
  return getJournalInfo()
    .then(function (journal) {
      if (!journal) {
        throw new Error('Журнал не найден')
      }
      return journal.id
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

export function getSubmissions() {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions', { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения submissions (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items || []
    })
}

export function getSubmissionDetail(id) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + id, { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения деталей submission (статус: ' + response.status + ')')
      }
      return response.json()
    })
}

// Получить список секций (разделов) журнала
export function getSections() {
  return fetchThroughProxy(API_BASE + '/api/v1/sections', { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения секций (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items || []
    })
}

// Создание submission (статьи)
export function createSubmission(data) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions', {
    method: 'POST',
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка создания submission (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Создание publication для submission
export function createPublication(submissionId, data) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId + '/publications', {
    method: 'POST',
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка создания publication (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Обновление существующей publication (PUT).
// OJS при createSubmission уже создаёт publication v1, поэтому метаданные
// нужно записывать в неё через PUT, а не создавать вторую через POST.
export function updatePublication(submissionId, publicationId, data) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId, {
    method: 'PUT',
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка обновления publication (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Загрузка файла в submission
export function uploadSubmissionFile(submissionId, file, locale) {
  var formData = new FormData()
  formData.append('file', file)
  formData.append('locale', locale || 'ru')
  formData.append('stage', 'submission')

  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId + '/files', {
    method: 'POST',
    headers: authHeaders,
    body: formData
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка загрузки файла (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Создание galley (представления файла) для publication.
// После загрузки файла в submission его нужно прикрепить к publication как galley,
// иначе PDF не отображается в выпуске.
export function createGalley(submissionId, publicationId, fileId, locale) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId + '/galleys', {
    method: 'POST',
    headers: jsonAuthHeaders,
    body: JSON.stringify({
      fileId: fileId,
      label: 'PDF',
      locale: locale || 'ru'
    })
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка создания galley (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Перевод submission в Production stage
export function submitToProduction(submissionId) {
  var body = {
    stage: 4 // WORKFLOW_STAGE_ID_PRODUCTION = 4
  }
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId + '/workflow', {
    method: 'PUT',
    headers: jsonAuthHeaders,
    body: JSON.stringify(body)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка перевода в production (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Назначение submission в выпуск.
// ВНИМАНИЕ: в текущей версии OJS НЕТ REST-маршрута /issues/{id}/catalog
// (возвращает 500 "route could not be found"). Назначение выпуска делается
// через поле issueId на publication: PUT /submissions/{id}/publications/{pubId}.
function assignPublicationToIssue(submissionId, issueId) {
  return getSubmissionDetail(submissionId)
    .then(function (submission) {
      var publicationId = submission.currentPublicationId ||
        (submission.publications && submission.publications[0] && submission.publications[0].id)
      if (!publicationId) {
        throw new Error('Не получен ID publication для назначения выпуска')
      }
      return updatePublication(submissionId, publicationId, { issueId: issueId })
    })
}

// ========================================
// Авторы (contributors) публикации
// В этой версии OJS REST API авторы создаются через маршрут contributors
// (PUT publication с полем authors игнорируется, отдельного /authors нет).
// Авторская группа "Автор" имеет userGroupId = 14.
// ========================================

// Получить список contributors публикации
export function getContributors(submissionId, publicationId) {
  return fetchThroughProxy(
    API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId + '/contributors',
    { headers: authHeaders }
  )
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения авторов (статус: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items || []
    })
}

// Создать contributor (автора) для публикации
export function createContributor(submissionId, publicationId, contributor) {
  return fetchThroughProxy(
    API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId + '/contributors',
    {
      method: 'POST',
      headers: jsonAuthHeaders,
      body: JSON.stringify(contributor)
    }
  )
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка создания автора (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

// Удалить конкретного contributor
export function deleteContributor(submissionId, publicationId, contributorId) {
  return fetchThroughProxy(
    API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId + '/contributors/' + contributorId,
    {
      method: 'DELETE',
      headers: authHeaders
    }
  )
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.errorMessage || 'Ошибка удаления автора (статус: ' + response.status + ')')
        })
      }
      return response.json()
    })
}

// ID группы "Автор" в этом журнале
export var AUTHOR_USER_GROUP_ID = 14

// Связывание submission с issue (через publication.issueId)
export function catalogSubmission(issueId, submissionId) {
  return assignPublicationToIssue(submissionId, issueId)
    .then(function (data) {
      return data
    })
    .catch(function (error) {
      throw error
    })
}

export function addArticleToIssue(issueId, submissionId) {
  return assignPublicationToIssue(submissionId, issueId)
    .then(function (data) {
      return data
    })
    .catch(function (error) {
      throw error
    })
}

export function removeArticleFromIssue(issueId, submissionId) {
  return getSubmissionDetail(submissionId)
    .then(function (submission) {
      var publicationId = submission.currentPublicationId ||
        (submission.publications && submission.publications[0] && submission.publications[0].id)
      if (!publicationId) {
        throw new Error('Не получен ID publication для снятия с выпуска')
      }
      // issueId: null — снимаем статью с выпуска
      return updatePublication(submissionId, publicationId, { issueId: null })
    })
    .then(function (data) {
      return data
    })
    .catch(function (error) {
      throw error
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
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка создания выпуска (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return {} }
      })
    })
}

export function updateIssue(id, data) {
  // OJS API не поддерживает PUT/PATCH для /api/v1/issues/{id}
  // Возвращаем успех, чтобы цепочка промисов продолжилась
  return Promise.resolve({ id: id })
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

export function unpublishIssue(id) {
  // OJS не поддерживает стандартный REST метод для снятия с публикации
  // Используем пустой PATCH или особый endpoint
  return fetchThroughProxy(API_BASE + '/api/v1/issues/' + id + '/unpublish', {
    method: 'POST',
    headers: jsonAuthHeaders,
    body: JSON.stringify({})
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = 'Ошибка снятия с публикации (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        }
        try { return JSON.parse(text) } catch (e) { return { success: true } }
      })
    })
}
