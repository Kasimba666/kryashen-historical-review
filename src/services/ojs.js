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

// Включить локаль (например 'en') для текущего журнала (context).
// OJS при сохранении многоязычных полей метаданных (title.en, abstract.en и т.п.)
// валидирует, что локаль присутствует в supportedLocales / supportedFormLocales
// журнала. Если 'en' там нет — PUT /publications/{id} возвращает 400.
export function enableContextLocale(locale) {
  locale = locale || 'en'
  return getCurrentContextId()
    .then(function (contextId) {
      return getJournalInfo().then(function (journal) {
        if (!journal) {
          throw new Error('Журнал не найден')
        }
        var primaryLocale = journal.primaryLocale || 'ru'
        var supported = Array.isArray(journal.supportedLocales)
          ? journal.supportedLocales.slice()
          : [primaryLocale]
        var formLocales = Array.isArray(journal.supportedFormLocales)
          ? journal.supportedFormLocales.slice()
          : [primaryLocale]

        if (supported.indexOf(locale) === -1) supported.push(locale)
        if (formLocales.indexOf(locale) === -1) formLocales.push(locale)

        var payload = {
          primaryLocale: primaryLocale,
          supportedLocales: supported,
          supportedFormLocales: formLocales
        }

        return fetchThroughProxy(API_BASE + '/api/v1/contexts/' + contextId, {
          method: 'PUT',
          headers: jsonAuthHeaders,
          body: JSON.stringify(payload)
        })
      })
    })
    .then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          var errMsg = 'Ошибка включения локали ' + locale + ' (статус: ' + response.status + ')'
          try {
            var err = JSON.parse(text)
            if (err.errorMessage) errMsg = err.errorMessage
          } catch (e) {}
          throw new Error(errMsg)
        })
      }
      return true
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

function localizeValue(obj) {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.ru || obj.en || ''
}

// Комплексная проверка таблиц на «осиротевшие» записи.
// Валидная статья = материал (submission) + публикация (publication),
// связанные между собой, плюс (опционально) авторы (contributors).
// Возвращает три группы невалидных записей:
//   1) submissionsWithoutPublication — материалы без публикации;
//   2) publicationsWithoutSubmission — публикации без (валидного) материала;
//   3) authorsWithoutPublication — авторы без (валидной) публикации.
export function getTableCheckData() {
  return Promise.all([getSubmissions(), getJournalInfo(), getIssues()])
    .then(function (init) {
      var subs = init[0] || []
      var journal = init[1]
      var issues = init[2] || []
      var journalId = journal ? journal.id : null

      // Убедимся, что у каждого материала загружен массив publications
      return Promise.all(subs.map(function (s) {
        if (s.publications && s.publications.length) return Promise.resolve(s)
        return getSubmissionDetail(s.id).catch(function () { return s })
      })).then(function (loaded) {
        return { subs: loaded, journalId: journalId, issues: issues }
      })
    })
    .then(function (ctx) {
      var subs = ctx.subs
      var journalId = ctx.journalId
      var submissionIds = {}
      subs.forEach(function (s) { submissionIds[s.id] = s })

      // Собираем все публикации со ссылкой на родительский материал
      var allPublications = []
      subs.forEach(function (s) {
        (s.publications || []).forEach(function (pub) {
          allPublications.push({ pub: pub, submissionId: s.id })
        })
      })

      var publicationIds = {}
      allPublications.forEach(function (p) { publicationIds[p.pub.id] = p })

      // Материалы без публикаций
      var submissionsWithoutPublication = subs
        .filter(function (s) { return !s.publications || s.publications.length === 0 })
        .map(function (s) {
          var titleObj = (s.currentPublication && s.currentPublication.title) || s.title || {}
          return {
            id: s.id,
            title: localizeValue(titleObj) || '(без названия)',
            status: s.status,
            stageId: s.stageId,
            dateSubmitted: s.dateSubmitted || s.dateLastActivity || null,
            publicationsCount: 0
          }
        })

      // Материалы с публикацией, но без привязки к выпуску (issue)
      var articlesWithoutIssue = []
      subs.forEach(function (s) {
        var pubs = s.publications || []
        if (pubs.length === 0) return
        var hasIssue = pubs.some(function (pub) { return pub.issueId })
        if (!hasIssue) {
          var titleObj = (s.currentPublication && s.currentPublication.title) || pubs[0].title || s.title || {}
          articlesWithoutIssue.push({
            id: s.id,
            title: localizeValue(titleObj) || '(без названия)',
            status: s.status,
            publicationsCount: pubs.length,
            publications: pubs.map(function (pub) {
              return {
                id: pub.id,
                status: pub.status,
                issueId: pub.issueId || null
              }
            })
          })
        }
      })

      // Выпуски без привязки к журналу
      var issuesWithoutJournal = ctx.issues
        .filter(function (issue) {
          return !issue.journalId || (journalId !== null && issue.journalId !== journalId)
        })
        .map(function (issue) {
          return {
            id: issue.id,
            title: localizeValue(issue.title) || issue.identification || '(без названия)',
            journalId: issue.journalId || null,
            identification: issue.identification || ''
          }
        })

      // Загружаем контрибьютеров для каждой публикации
      return Promise.all(allPublications.map(function (p) {
        return getContributors(p.submissionId, p.pub.id)
          .then(function (list) { return { p: p, contributors: list || [] } })
          .catch(function () { return { p: p, contributors: [] } })
      })).then(function (entries) {
        var pubContributors = {}
        entries.forEach(function (e) { pubContributors[e.p.pub.id] = e.contributors })

        // Публикации без валидного материала
        var publicationsWithoutSubmission = allPublications
          .filter(function (p) {
            var sid = p.pub.submissionId
            return !sid || !submissionIds[sid] || sid !== p.submissionId
          })
          .map(function (p) {
            return {
              id: p.pub.id,
              submissionId: p.pub.submissionId || null,
              title: localizeValue(p.pub.title) || '(без названия)',
              status: p.pub.status,
              datePublished: p.pub.datePublished || null,
              authors: (pubContributors[p.pub.id] || []).map(function (c) {
                return {
                  id: c.id,
                  name: (localizeValue(c.givenName) + ' ' + localizeValue(c.familyName)).trim(),
                  email: c.email || ''
                }
              }),
              _contributors: pubContributors[p.pub.id] || []
            }
          })

        // Авторы без валидной публикации
        var authorsWithoutPublication = []
        entries.forEach(function (e) {
          var pub = e.p.pub
          var pubValid = submissionIds[pub.submissionId] && pub.submissionId === e.p.submissionId
            e.contributors.forEach(function (c) {
              if (!pubValid || !c.publicationId || !publicationIds[c.publicationId]) {
                authorsWithoutPublication.push({
                  id: c.id,
                  givenName: localizeValue(c.givenName),
                  familyName: localizeValue(c.familyName),
                  email: c.email || '',
                  publicationId: c.publicationId || null,
                  submissionId: e.p.submissionId,
                  publicationValid: !!pubValid && !!publicationIds[c.publicationId]
                })
              }
            })
        })

        return {
          submissionsWithoutPublication: submissionsWithoutPublication,
          publicationsWithoutSubmission: publicationsWithoutSubmission,
          authorsWithoutPublication: authorsWithoutPublication,
          articlesWithoutIssue: articlesWithoutIssue,
          issuesWithoutJournal: issuesWithoutJournal
        }
      })
    })
}

// Каскадное удаление материала: OJS при DELETE /submissions/{id}
// сам удаляет связанные публикации и контрибьютеров.
export function deleteSubmissionCascade(submissionId) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId, {
    method: 'DELETE',
    headers: authHeaders
  }).then(function (r) {
    if (!r.ok) {
      return r.json().then(function (e) {
        throw new Error(e.errorMessage || 'Ошибка удаления материала')
      })
    }
    return true
  })
}

// Каскадное удаление публикации: сначала удаляем всех контрибьютеров,
// затем саму публикацию, чтобы не осталось зависших авторов.
export function deletePublicationCascade(submissionId, publicationId, contributors) {
  var deletions = (contributors || []).map(function (c) {
    return deleteContributor(submissionId, publicationId, c.id).catch(function () {})
  })
  return Promise.all(deletions).then(function () {
    return fetchThroughProxy(
      API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId,
      { method: 'DELETE', headers: authHeaders }
    ).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (e) {
          throw new Error(e.errorMessage || 'Ошибка удаления публикации')
        })
      }
      return true
    })
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

// Получить полные данные конкретной публикации (включая keywords,
// которые в ответе /submissions/{id} НЕ возвращаются, в отличие от
// прямого эндпоинта /submissions/{id}/publications/{id}).
export function getPublication(submissionId, publicationId) {
  return fetchThroughProxy(
    API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId,
    { headers: authHeaders }
  )
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Ошибка получения публикации (статус: ' + response.status + ')')
      }
      return response.json()
    })
}

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

// ========================================
// Управление выпусками через component-handler ($$$call$$$)
// REST API /api/v1/issues в OJS 3.5 НЕ поддерживает создание/изменение/
// удаление/публикацию выпусков. Эти операции доступны только через
// компонент-обработчики (IssueGridHandler): publishIssue, unpublishIssue,
// deleteIssue, updateIssue (создание/редактирование через IssueForm).
// Запросы идут с cookie-сессией и CSRF-токеном (как обычная форма OJS),
// поэтому НЕ используем JSON/Bearer и кастомные заголовки (чтобы не было
// CORS-preflight). CSRF передаём полем/параметром csrfToken.
// ========================================

// Получить CSRF-токен сессии OJS. Работает как ДО входа (страница логина
// содержит скрытое поле csrfToken), так и ПОСЛЕ (dashboard содержит токен
// в разметке/JSON). Используется для component-handler запросов.
export function getComponentToken() {
  function extract(text) {
    var m = text.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) ||
            text.match(/"csrfToken"\s*:\s*"([^"]+)"/) ||
            text.match(/csrfToken[=:]\s*"?([a-f0-9]{16,})/i)
    return m ? m[1] : null
  }
  return fetchThroughProxy(API_BASE + '/ru/login', { credentials: 'include' })
    .then(function (response) { return response.text() })
    .then(function (html) {
      var token = extract(html)
      if (token) return token
      // Уже авторизованы — токен в dashboard
      return fetchThroughProxy(API_BASE + '/ru', { credentials: 'include' })
        .then(function (response) { return response.text() })
        .then(function (html2) {
          var token2 = extract(html2)
          if (!token2) throw new Error('CSRF-токен не найден (войдите в систему)')
          return token2
        })
    })
}

function buildFormBody(obj) {
  return Object.keys(obj).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k] == null ? '' : obj[k])
  }).join('&')
}

// Вызов component-handler для выпусков.
// gridOp — путь вида 'future-issue-grid/update-issue',
//          'issue-grid/publish-issue', 'back-issue-grid/unpublish-issue',
//          'back-issue-grid/delete-issue'.
// issueId — ID выпуска (для create = null).
// formObj — поля формы (для create/update) или null.
// extraParams — доп. query-параметры (напр. confirmed=1).
function callIssueComponent(gridOp, issueId, formObj, extraParams) {
  return getComponentToken().then(function (csrf) {
    var query = 'csrfToken=' + encodeURIComponent(csrf)
    if (issueId) query += '&issueId=' + encodeURIComponent(issueId)
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        query += '&' + k + '=' + encodeURIComponent(extraParams[k])
      })
    }
    var url = API_BASE + '/$$$call$$$/grid/issues/' + gridOp + '?' + query

    var options = {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      }
    }
    if (formObj) {
      var body = buildFormBody(formObj)
      body += '&csrfToken=' + encodeURIComponent(csrf)
      options.body = body
    }
    return fetchThroughProxy(url, options)
  })
}

// Обработка ответа component-handler (возвращает JSONMessage в JSON).
function handleComponentResponse(prefix) {
  return function (response) {
    return response.text().then(function (text) {
      if (!response.ok) {
        throw new Error(prefix + ' (статус: ' + response.status + ')')
      }
      try {
        var json = JSON.parse(text)
        if (json && json.status === false) {
          var msg = (json.content && json.content.replace(/<[^>]+>/g, ' ').trim()) ||
                    json.errorMessage || 'неизвестная ошибка'
          throw new Error(prefix + ': ' + msg)
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          // Ответ не JSON (напр. HTML контента) — считаем успехом
        } else {
          throw e
        }
      }
      return true
    })
  }
}

// Собрать поля формы IssueForm из данных выпуска.
function issueFormFields(data) {
  return {
    'title[ru]': (data.title && data.title.ru) || '',
    'title[en]': (data.title && data.title.en) || '',
    'description[ru]': (data.description && data.description.ru) || '',
    'description[en]': (data.description && data.description.en) || '',
    'volume': data.volume || '',
    'number': data.number || '',
    'year': data.year || '',
    'showVolume': 1,
    'showNumber': 1,
    'showYear': 1,
    'showTitle': 1
  }
}

// Создать новый выпуск (через IssueForm::execute, issueId отсутствует).
export function createIssue(data) {
  var form = issueFormFields(data || {})
  if (data && data.datePublished) form['datePublished'] = data.datePublished
  return callIssueComponent('future-issue-grid/update-issue', null, form)
    .then(handleComponentResponse('Ошибка создания выпуска'))
}

// Обновить существующий выпуск.
export function updateIssue(id, data) {
  if (!id) return createIssue(data)
  var form = issueFormFields(data || {})
  if (data && data.datePublished) form['datePublished'] = data.datePublished
  return callIssueComponent('future-issue-grid/update-issue', id, form)
    .then(handleComponentResponse('Ошибка обновления выпуска'))
}

// Опубликовать выпуск.
// НЕОПУБЛИКОВАННЫЙ выпуск публикуется через FutureIssueGridHandler
// (grid 'future-issue-grid'), как это делает штатный UI OJS (форма
// assignPublicIdentifiersForm.tpl шлёт запрос именно на
// grid.issues.FutureIssueGridHandler?op=publishIssue). Использование
// 'issue-grid' (BackIssueGridHandler) для неопубликованного выпуска
// приводит к 500-й ошибке на сервере.
// Форма подтверждения содержит поля: issueId, confirmed=1,
// sendIssueNotification (по умолчанию включён), csrfToken.
export function publishIssue(id) {
  return callIssueComponent('future-issue-grid/publish-issue', id, {
    confirmed: 1,
    sendIssueNotification: 0
  })
    .then(handleComponentResponse('Ошибка публикации выпуска'))
}

// Снять выпуск с публикации (BackIssueGridHandler::unpublishIssue).
export function unpublishIssue(id) {
  return callIssueComponent('back-issue-grid/unpublish-issue', id, null)
    .then(handleComponentResponse('Ошибка снятия выпуска с публикации'))
}

// Удалить выпуск (IssueGridHandler::deleteIssue).
export function deleteIssue(id) {
  return callIssueComponent('back-issue-grid/delete-issue', id, null)
    .then(handleComponentResponse('Ошибка удаления выпуска'))
}
