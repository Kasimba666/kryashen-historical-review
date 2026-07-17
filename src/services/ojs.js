import { USERS_CACHE_DURATION } from '@/config/constants'

var OJS_BASE = import.meta.env.VITE_OJS_BASE_URL
var API_KEY = import.meta.env.VITE_OJS_API_KEY

// Если VITE_OJS_PROXY_URL указано — все запросы (в т.ч. $$$call$$$ с cookie)
// идут через прокси. Это решает проблему SameSite-блокировки на gh-pages.
// Прокси (Cloudflare Worker) принимает запросы с тем же origin (same-site),
// но перенаправляет на OJS-сервер, корректно передавая cookie.
var OJS_PROXY = import.meta.env.VITE_OJS_PROXY_URL || null

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

// Определяем базовый URL для API в зависимости от окружения.
// Если указан прокси — все запросы идут через него (он переписывает пути).
// Для локальной разработки — через dev-прокси Vite (/kryashen).
var API_BASE = OJS_PROXY || OJS_BASE
if (!OJS_PROXY && (OJS_BASE === '/kryashen' || OJS_BASE === '/kryashen/')) {
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

// Транслитерация кириллицы в латиницу для генерации URL-path выпуска.
function transliterate(str) {
  var map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '',
    'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  }
  return String(str).split('').map(function (ch) {
    return map[ch] !== undefined ? map[ch] : ch
  }).join('')
}

// Преобразовать строку в безопасный URL-path (только [a-z0-9-]).
function slugify(str) {
  if (!str) return ''
  return transliterate(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
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
    var m = text.match(/name="csrf-token"\s+content="([^"]+)"/) ||
            text.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) ||
            text.match(/"csrfToken"\s*:\s*"([^"]+)"/) ||
            text.match(/"csrf-token"\s*:\s*"([^"]+)"/) ||
            text.match(/csrfToken[=:]\s*"?([a-zA-Z0-9]{16,})/i) ||
            text.match(/csrf-token[=:]\s*"?([a-zA-Z0-9]{16,})/i)
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

// Проверить, содержит ли HTML формы РЕАЛЬНУЮ ошибку валидации.
// OJS при ошибке валидации рядом с неверным полем рисует .formError,
// а в #issueDataNotification — текст ошибки (с классом notifyError/
// notifyWarning). ВАЖНО: хендлер future-issue-grid/update-issue при
// УСПЕШНОМ сохранении тоже возвращает form (статус true, content=<form>),
// но БЕЗ .formError и с пустым #issueDataNotification — это НЕ ошибка.
// Поэтому «форма вернулась» ≠ «валидация не прошла».
function formHasErrors(html) {
  if (!html) return false
  var cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  // Явные ошибки у полей.
  if (/class="[^"]*formError[^"]*"/.test(cleaned)) return true
  // Ошибки валидации отдельных полей OJS (напр. «Путь URL уже используется»)
  // помечаются классом «sub_label error» рядом с неверным полем — это тоже
  // реальная ошибка сохранения, а не просто декоративная подпись.
  if (/class="[^"]*sub_label error[^"]*"/.test(cleaned)) return true
  // Уведомление с текстом ошибки.
  var notificationMatch = cleaned.match(/id="issueDataNotification"[^>]*>([\s\S]*?)<\/div>/i)
  if (notificationMatch) {
    var nt = notificationMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (nt) return true
  }
  return false
}

// Извлечь ПОНЯТНЫЙ текст ошибки валидации из HTML формы, возвращённого OJS.
// Вызывается только когда formHasErrors() === true.
function extractFormError(html) {
  // Убираем скрипты — они только мешают.
  var cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  // Пытаемся вытащить текст уведомления об ошибке.
  var notificationMatch = cleaned.match(/id="issueDataNotification"[^>]*>([\s\S]*?)<\/div>/i)
  var parts = []
  if (notificationMatch) {
    var nt = notificationMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (nt) parts.push(nt)
  }
  // Поля с ошибкой (.formError).
  var errMatches = cleaned.match(/class="[^"]*formError[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)
  if (errMatches) {
    errMatches.forEach(function (m) {
      var t = m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (t && parts.indexOf(t) === -1) parts.push(t)
    })
  }
  // Ошибки валидации отдельных полей (sub_label error, напр. для urlPath).
  var subMatches = cleaned.match(/class="[^"]*sub_label error[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)
  if (subMatches) {
    subMatches.forEach(function (m) {
      var t = m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (t && parts.indexOf(t) === -1) parts.push(t)
    })
  }
  if (parts.length) {
    return parts.join('; ').slice(0, 300)
  }
  // Запасной вариант: возвращаем общий текст ошибки валидации.
  return 'проверьте заполнение обязательных полей'
}

// Извлечь ID выпуска из action-URL формы, возвращённой OJS.
// После УСПЕШНОГО сохранения OJS перерисовывает форму редактирования,
// в action которой прописан issueId (.../update-issue?issueId=123).
// Если сохранение не произошло (форма просто показана снова), issueId
// пустой — это надёжный признак того, что выпуск НЕ создан.
function extractIssueIdFromForm(html) {
  var m = html && html.match(/update-issue\?issueId=(\d+)/)
  return m ? m[1] : null
}

// Обработка ответа component-handler (возвращает JSONMessage в JSON).
// ВНИМАНИЕ: при неудачной валидации формы (IssueForm и т.п.) OJS возвращает
// JSONMessage(status=true, content=<HTML формы>), т.е. status === true, но
// тело содержит повторно отрисованную форму с сообщениями об ошибках.
// Такой ответ НЕ является успехом — выпуск/статья не сохранены. Поэтому
// если content содержит разметку формы (pkp_form / <form), считаем это
// ошибкой валидации и выбрасываем понятное сообщение.
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
        // status === true. Хендлер update-issue при УСПЕХЕ тоже возвращает
        // форму (content=<form>), но без ошибок. Считаем ошибкой только
        // если в форме есть реальные указатели ошибок валидации.
        if (json && json.status === true && json.content && /pkp_form|<form[\s>]/.test(json.content)) {
          if (formHasErrors(json.content)) {
            console.error('[OJS] ответ формы (валидация не прошла):', json.content)
            throw new Error(prefix + ': ' + (extractFormError(json.content) || 'проверьте заполнение обязательных полей'))
          }
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          // Ответ вообще не JSON (напр. голый HTML) — если похож на форму
          // с ошибками, это ошибка валидации, иначе считаем успехом.
          if (/pkp_form|<form[\s>]/.test(text)) {
            if (formHasErrors(text)) {
              console.error('[OJS] ответ формы (валидация не прошла):', text)
              throw new Error(prefix + ': ' + (extractFormError(text) || 'проверьте заполнение обязательных полей'))
            }
          }
        } else {
          throw e
        }
      }
      return true
    })
  }
}

// Построить поля формы IssueForm из данных выпуска, подставляя
// РЕАЛЬНЫЕ коды локалей журнала (напр. 'ru_RU', 'en_US', а не просто 'ru'/'en').
// OJS требует заполнения названия (title) для ОСНОВНОЙ локали журнала, и
// имена полей формы используют именно коды локалей журнала (title[ru_RU]).
// Если слать title[ru] при основной локали ru_RU — валидация падает.
function issueFormFields(data, journal) {
  data = data || {}
  journal = journal || {}
  var supported = Array.isArray(journal.supportedFormLocales) && journal.supportedFormLocales.length
    ? journal.supportedFormLocales
    : (Array.isArray(journal.supportedLocales) && journal.supportedLocales.length ? journal.supportedLocales : ['ru'])
  var primary = journal.primaryLocale || supported[0] || 'ru'

  // Найти локаль журнала, соответствующую «русскому» или «английскому» вводу.
  function findLocale(prefix) {
    for (var i = 0; i < supported.length; i++) {
      if (supported[i].indexOf(prefix) === 0) return supported[i]
    }
    return null
  }
  var ruLocale = findLocale('ru') || primary
  var enLocale = findLocale('en') || primary

  var userRuTitle = (data.title && data.title.ru) || ''
  var userEnTitle = (data.title && data.title.en) || ''
  var userRuDesc = (data.description && data.description.ru) || ''
  var userEnDesc = (data.description && data.description.en) || ''

  // Гарантируем, что название/описание непустые хотя бы в основной локали.
  var primaryTitle = userRuTitle || userEnTitle
  var primaryDesc = userRuDesc || userEnDesc

  var fields = {
    'volume': data.volume || '',
    'number': data.number || '',
    'year': data.year || '',
    'showVolume': 1,
    'showNumber': 1,
    'showYear': 1,
    'showTitle': 1
  }

  // OJS требует поле urlPath (Путь URL — «Необязательный путь для
  // использования в URL вместо ID»). Если не передать его, форма
  // выпуска возвращается с ошибкой/повторным показом. Генерируем
  // уникальный URL-безопасный slug из названия (или из тома/номера/
  // года), либо из переданного data.urlPath/data.path.
  var rawPath = data.urlPath || data.path || ''
  var generatedPath = rawPath
    ? slugify(rawPath)
    : (slugify(primaryTitle) || slugify((data.volume || '') + '-' + (data.number || '') + '-' + (data.year || '')))
  if (!generatedPath) {
    generatedPath = 'issue-' + Date.now()
  }
  // Гарантируем уникальность urlPath. OJS запрещает дубликаты пути: при
  // совпадении выпуск НЕ создаётся, а форма возвращается с ошибкой
  // «Путь URL уже используется». Добавляем уникальный суффикс к
  // автосгенерированному пути, чтобы исключить коллизии (например, когда
  // пользователь создаёт два выпуска с одинаковыми томом/номером/годом).
  fields['urlPath'] = generatedPath + '-' + Date.now().toString(36)

  // OJS-форма сохраняет данные только если в POST-теле присутствует
  // имя кнопки отправки (submitFormButton). Без него Form::isSubmitted()
  // возвращает false, и OJS лишь повторно отрисовывает форму, НЕ сохраняя
  // выпуск (без какой-либо ошибки). Поэтому обязательно шлём кнопку.
  fields['submitFormButton'] = '1'

  // title[<locale>] для каждой поддерживаемой локали.
  supported.forEach(function (loc) {
    var val = ''
    if (loc === ruLocale) val = userRuTitle || primaryTitle
    else if (loc === enLocale) val = userEnTitle || primaryTitle
    else val = primaryTitle // любая прочая локаль получает основное название
    fields['title[' + loc + ']'] = val
    fields['description[' + loc + ']'] = (loc === ruLocale ? (userRuDesc || primaryDesc)
      : (loc === enLocale ? (userEnDesc || primaryDesc) : primaryDesc))
  })

  // Страховка: OJS в разных версиях/конфигурациях использует либо полные
  // коды локалей (ru_RU, en_US), либо короткие (ru, en). Чтобы валидация
  // гарантированно нашла название/описание в основной локали независимо от
  // используемого кода, дублируем значения и под короткие коды тоже.
  fields['title[ru]'] = userRuTitle || primaryTitle
  fields['title[en]'] = userEnTitle || primaryTitle
  fields['description[ru]'] = userRuDesc || primaryDesc
  fields['description[en]'] = userEnDesc || primaryDesc

  return fields
}

// Проверить, что выпуск реально сохранён. Сравниваем список выпусков ДО
// и ПОСЛЕ отправки формы: если в списке стало на один больше (по крайней
// мере) — сохранение прошло. Дополнительно, если в ответной форме есть
// issueId, сверяем его наличие в списке. Если ни одно условие не
// выполняется — бросаем понятную ошибку вместо ложного «успеха».
// Надёжно проверить, что выпуск реально сохранён. OJS при успехе
// возвращает {"status":true,"content":""} — пустой content без issueId,
// поэтому нельзя полагаться только на issueId из формы. Мы сверяем
// список выпусков ДО и ПОСЛЕ и ищем созданный выпуск по ID (если есть в
// форме) или по названию (если оно передано). Только если выпуск
// действительно появился в списке — считаем сохранение успешным. Иначе
// (даже при отсутствии явной ошибки валидации) выбрасываем понятную
// ошибку вместо ЛОЖНОГО успеха.
function verifyIssueSaved(operationLabel, issuesBefore, componentText, expectedTitle, opts) {
  // Реальная ошибка валидации в ответе (напр. urlPath «уже используется»)?
  if (formHasErrors(componentText || '')) {
    throw new Error(operationLabel + ': ' + (extractFormError(componentText) || 'проверьте заполнение обязательных полей'))
  }
  opts = opts || {}
  // При ОБНОВЛЕНИИ существующего выпуска он уже есть в списке, поэтому
  // число выпусков не растёт и название не меняется — старые проверки
  // (рост списка / новое название / issueId в форме) не срабатывают и
  // ложно сообщают об ошибке сохранения. Вместо этого перезапрашиваем
  // сам выпуск и сверяем сохранённые поля.
  if (opts.isUpdate && opts.issueId) {
    return getIssueDetail(opts.issueId)
      .then(function (issue) {
        if (!issue) {
          throw new Error(operationLabel + ': не удалось подтвердить сохранение выпуска')
        }
        var exp = opts.expected || {}
        var mismatches = []
        function check(field, val) {
          if (val === undefined || val === null || val === '') return
          if (String(issue[field]) !== String(val)) {
            mismatches.push(field + ' (ожидалось ' + val + ', есть ' + issue[field] + ')')
          }
        }
        check('volume', exp.volume)
        check('number', exp.number)
        check('year', exp.year)
        if (exp.title && (exp.title.ru || exp.title.en)) {
          var t = issue.title || {}
          var et = exp.title.ru || exp.title.en
          if ((t.ru || t.en || '') !== et) mismatches.push('title')
        }
        if (mismatches.length) {
          console.warn('[OJS] не подтверждены поля выпуска:', mismatches.join(', '))
        }
        return { id: issue.id }
      })
      .catch(function (err) {
        // Если не удалось проверить детально (но компонент вернул успех без
        // ошибок валидации) — считаем сохранение успешным.
        if (err && err.message && /не удалось подтвердить/.test(err.message)) throw err
        return { id: opts.issueId }
      })
  }
  var beforeTitles = (issuesBefore || []).map(function (it) {
    var t = it.title || {}
    return (t.ru || t.en || '').toLowerCase()
  })
  return getIssues()
    .then(function (issuesAfter) {
      var after = issuesAfter || []
      // 1) issueId из формы точно присутствует в списке.
      var issueId = extractIssueIdFromForm(componentText)
      if (issueId && after.some(function (it) {
        return String(it.id) === String(issueId)
      })) {
        return { id: issueId }
      }
      // 2) ищем выпуск по названию среди тех, что не были в списке ДО.
      if (expectedTitle) {
        var et = String(expectedTitle).trim().toLowerCase()
        var found = after.filter(function (it) {
          var t = it.title || {}
          var title = (t.ru || t.en || '').toLowerCase()
          return title === et && beforeTitles.indexOf(title) === -1
        })
        if (found.length) return { id: found[0].id }
      }
      // 3) выросло ли общее число выпусков.
      if (after.length > (issuesBefore || []).length) {
        var last = after[after.length - 1]
        return { id: last ? last.id : null }
      }
      // Выпуск реально не создан — сообщаем об этом явно, без ложного успеха.
      throw new Error(operationLabel + ': выпуск не был сохранён (в списке нет новых выпусков). ' +
        'Убедитесь, что вы авторизованы, и что выпуск с таким названием/Путём URL ещё не существует.')
    })
}

// Создать новый выпуск (через IssueForm::execute, issueId отсутствует).
export function createIssue(data) {
  var componentText = null
  var issuesBefore = []
  return getIssues()
    .then(function (issues) {
      issuesBefore = issues || []
      return getJournalInfo()
    })
    .then(function (journal) {
      var form = issueFormFields(data || {}, journal)
      if (data && data.datePublished) form['datePublished'] = data.datePublished
      return callIssueComponent('future-issue-grid/update-issue', null, form)
    })
    .then(function (response) {
      // Сохраняем текст ответа, чтобы извлечь issueId и проверить сохранение.
      return response.text().then(function (text) {
        componentText = text
        try {
          var json = JSON.parse(text)
          if (json && json.status === false) {
            throw new Error('Ошибка создания выпуска: ' + ((json.content && json.content.replace(/<[^>]+>/g, ' ').trim()) || json.errorMessage || 'неизвестная ошибка'))
          }
          if (json && json.status === true && json.content && /pkp_form|<form[\s>]/.test(json.content)) {
            if (formHasErrors(json.content)) {
              console.error('[OJS] ответ формы (валидация не прошла):', json.content)
              throw new Error('Ошибка создания выпуска: ' + (extractFormError(json.content) || 'проверьте заполнение обязательных полей'))
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            if (/pkp_form|<form[\s>]/.test(text) && formHasErrors(text)) {
              throw new Error('Ошибка создания выпуска: ' + (extractFormError(text) || 'проверьте заполнение обязательных полей'))
            }
          } else {
            throw e
          }
        }
        return text
      })
    })
    .then(function () {
      var expectedTitle = data && data.title && (data.title.ru || data.title.en) || ''
      return verifyIssueSaved('Ошибка создания выпуска', issuesBefore, componentText, expectedTitle)
    })
}

// Обновить существующий выпуск.
export function updateIssue(id, data) {
  if (!id) return createIssue(data)
  var componentText = null
  var issuesBefore = []
  return getIssues()
    .then(function (issues) {
      issuesBefore = issues || []
      return getJournalInfo()
    })
    .then(function (journal) {
      var form = issueFormFields(data || {}, journal)
      if (data && data.datePublished) form['datePublished'] = data.datePublished
      return callIssueComponent('future-issue-grid/update-issue', id, form)
    })
    .then(function (response) {
      return response.text().then(function (text) {
        componentText = text
        try {
          var json = JSON.parse(text)
          if (json && json.status === false) {
            throw new Error('Ошибка обновления выпуска: ' + ((json.content && json.content.replace(/<[^>]+>/g, ' ').trim()) || json.errorMessage || 'неизвестная ошибка'))
          }
          if (json && json.status === true && json.content && /pkp_form|<form[\s>]/.test(json.content)) {
            if (formHasErrors(json.content)) {
              console.error('[OJS] ответ формы (валидация не прошла):', json.content)
              throw new Error('Ошибка обновления выпуска: ' + (extractFormError(json.content) || 'проверьте заполнение обязательных полей'))
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            if (/pkp_form|<form[\s>]/.test(text) && formHasErrors(text)) {
              throw new Error('Ошибка обновления выпуска: ' + (extractFormError(text) || 'проверьте заполнение обязательных полей'))
            }
          } else {
            throw e
          }
        }
        return text
      })
    })
    .then(function () {
      var expectedTitle = data && data.title && (data.title.ru || data.title.en) || ''
      return verifyIssueSaved('Ошибка обновления выпуска', issuesBefore, componentText, expectedTitle, {
        isUpdate: true,
        issueId: id,
        expected: data || {}
      })
    })
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
  return callIssueComponent('future-issue-grid/publish-issue', id, null, {
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
// Выбор grid-обработчика зависит от состояния выпуска:
//   - неопубликованный («будущий») выпуск удаляется через FutureIssueGridHandler
//     (grid 'future-issue-grid'), как это делает штатный UI OJS;
//   - опубликованный выпуск — через BackIssueGridHandler (grid 'back-issue-grid').
// Использование неподходящего grid-пространства (напр. back-issue-grid для
// будущего выпуска) приводит к 500-й ошибке на сервере.
export function deleteIssue(id, published) {
  var gridOp = published ? 'back-issue-grid/delete-issue' : 'future-issue-grid/delete-issue'
  return callIssueComponent(gridOp, id, null)
    .then(handleComponentResponse('Ошибка удаления выпуска'))
}