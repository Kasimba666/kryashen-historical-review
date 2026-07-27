import { USERS_CACHE_DURATION } from '@/config/constants'

var OJS_BASE = import.meta.env.VITE_OJS_BASE_URL
var API_KEY = import.meta.env.VITE_OJS_API_KEY

// ╨Х╤Б╨╗╨╕ VITE_OJS_PROXY_URL ╤Г╨║╨░╨╖╨░╨╜╨╛ тАФ ╨▓╤Б╨╡ ╨╖╨░╨┐╤А╨╛╤Б╤Л (╨▓ ╤В.╤З. $$$call$$$ ╤Б cookie)
// ╨╕╨┤╤Г╤В ╤З╨╡╤А╨╡╨╖ ╨┐╤А╨╛╨║╤Б╨╕. ╨н╤В╨╛ ╤А╨╡╤И╨░╨╡╤В ╨┐╤А╨╛╨▒╨╗╨╡╨╝╤Г SameSite-╨▒╨╗╨╛╨║╨╕╤А╨╛╨▓╨║╨╕ ╨╜╨░ gh-pages.
// ╨Я╤А╨╛╨║╤Б╨╕ (Cloudflare Worker) ╨┐╤А╨╕╨╜╨╕╨╝╨░╨╡╤В ╨╖╨░╨┐╤А╨╛╤Б╤Л ╤Б ╤В╨╡╨╝ ╨╢╨╡ origin (same-site),
// ╨╜╨╛ ╨┐╨╡╤А╨╡╨╜╨░╨┐╤А╨░╨▓╨╗╤П╨╡╤В ╨╜╨░ OJS-╤Б╨╡╤А╨▓╨╡╤А, ╨║╨╛╤А╤А╨╡╨║╤В╨╜╨╛ ╨┐╨╡╤А╨╡╨┤╨░╨▓╨░╤П cookie.
var OJS_PROXY = import.meta.env.VITE_OJS_PROXY_URL || null

// ╨Ч╨░╨│╨╛╨╗╨╛╨▓╨║╨╕ ╤Б API-╨║╨╗╤О╤З╨╛╨╝ (╨┤╨╗╤П GET-╨╖╨░╨┐╤А╨╛╤Б╨╛╨▓)
var authHeaders = {
  'Authorization': 'Bearer ' + API_KEY,
  'Accept': 'application/json'
}

// ╨Ч╨░╨│╨╛╨╗╨╛╨▓╨║╨╕ ╤Б Content-Type ╨┤╨╗╤П JSON POST/PUT/DELETE ╨╖╨░╨┐╤А╨╛╤Б╨╛╨▓.
// ╨С╨╡╨╖ 'Content-Type: application/json' OJS ╨╜╨╡ ╨┐╨░╤А╤Б╨╕╤В ╤В╨╡╨╗╨╛ ╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В 400 "╨Я╨╛╨╗╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╨╛."
var jsonAuthHeaders = {
  'Authorization': 'Bearer ' + API_KEY,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

// ╨Ъ╤Н╤И ╨┤╨╗╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣
var usersCache = null
var usersCacheTime = 0

// ╨Ю╨┐╤А╨╡╨┤╨╡╨╗╤П╨╡╨╝ ╨▒╨░╨╖╨╛╨▓╤Л╨╣ URL ╨┤╨╗╤П API ╨▓ ╨╖╨░╨▓╨╕╤Б╨╕╨╝╨╛╤Б╤В╨╕ ╨╛╤В ╨╛╨║╤А╤Г╨╢╨╡╨╜╨╕╤П.
// ╨Х╤Б╨╗╨╕ ╤Г╨║╨░╨╖╨░╨╜ ╨┐╤А╨╛╨║╤Б╨╕ тАФ ╨▓╤Б╨╡ ╨╖╨░╨┐╤А╨╛╤Б╤Л ╨╕╨┤╤Г╤В ╤З╨╡╤А╨╡╨╖ ╨╜╨╡╨│╨╛ (╨╛╨╜ ╨┐╨╡╤А╨╡╨┐╨╕╤Б╤Л╨▓╨░╨╡╤В ╨┐╤Г╤В╨╕).
// ╨Ф╨╗╤П ╨╗╨╛╨║╨░╨╗╤М╨╜╨╛╨╣ ╤А╨░╨╖╤А╨░╨▒╨╛╤В╨║╨╕ тАФ ╤З╨╡╤А╨╡╨╖ dev-╨┐╤А╨╛╨║╤Б╨╕ Vite (/kryashen).
var API_BASE = OJS_PROXY || OJS_BASE
if (!OJS_PROXY && (OJS_BASE === '/kryashen' || OJS_BASE === '/kryashen/')) {
  API_BASE = '/kryashen'
}

// ========================================
// ╨г╤В╨╕╨╗╨╕╤В╤Л
// ========================================

function fetchThroughProxy(url, options) {
  options = options || {}
  if (!options.credentials) {
    options.credentials = 'include'
  }
  return fetch(url, options)
}

// ╨в╤А╨░╨╜╤Б╨╗╨╕╤В╨╡╤А╨░╤Ж╨╕╤П ╨║╨╕╤А╨╕╨╗╨╗╨╕╤Ж╤Л ╨▓ ╨╗╨░╤В╨╕╨╜╨╕╤Ж╤Г ╨┤╨╗╤П ╨│╨╡╨╜╨╡╤А╨░╤Ж╨╕╨╕ URL-path ╨▓╤Л╨┐╤Г╤Б╨║╨░.
function transliterate(str) {
  var map = {
    '╨░': 'a', '╨▒': 'b', '╨▓': 'v', '╨│': 'g', '╨┤': 'd', '╨╡': 'e', '╤С': 'e',
    '╨╢': 'zh', '╨╖': 'z', '╨╕': 'i', '╨╣': 'y', '╨║': 'k', '╨╗': 'l', '╨╝': 'm',
    '╨╜': 'n', '╨╛': 'o', '╨┐': 'p', '╤А': 'r', '╤Б': 's', '╤В': 't', '╤Г': 'u',
    '╤Д': 'f', '╤Е': 'h', '╤Ж': 'ts', '╤З': 'ch', '╤И': 'sh', '╤Й': 'sch', '╤К': '',
    '╤Л': 'y', '╤М': '', '╤Н': 'e', '╤О': 'yu', '╤П': 'ya',
    '╨Р': 'A', '╨С': 'B', '╨Т': 'V', '╨У': 'G', '╨Ф': 'D', '╨Х': 'E', '╨Б': 'E',
    '╨Ц': 'Zh', '╨Ч': 'Z', '╨Ш': 'I', '╨Щ': 'Y', '╨Ъ': 'K', '╨Ы': 'L', '╨Ь': 'M',
    '╨Э': 'N', '╨Ю': 'O', '╨Я': 'P', '╨а': 'R', '╨б': 'S', '╨в': 'T', '╨г': 'U',
    '╨д': 'F', '╨е': 'H', '╨ж': 'Ts', '╨з': 'Ch', '╨и': 'Sh', '╨й': 'Sch', '╨к': '',
    '╨л': 'Y', '╨м': '', '╨н': 'E', '╨о': 'Yu', '╨п': 'Ya'
  }
  return String(str).split('').map(function (ch) {
    return map[ch] !== undefined ? map[ch] : ch
  }).join('')
}

// ╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╨╛╨▓╨░╤В╤М ╤Б╤В╤А╨╛╨║╤Г ╨▓ ╨▒╨╡╨╖╨╛╨┐╨░╤Б╨╜╤Л╨╣ URL-path (╤В╨╛╨╗╤М╨║╨╛ [a-z0-9-]).
function slugify(str) {
  if (!str) return ''
  return transliterate(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ========================================
// ╨Р╤Г╤В╨╡╨╜╤В╨╕╤Д╨╕╨║╨░╤Ж╨╕╤П
// ========================================

export function getCsrfToken() {
  return fetchThroughProxy(API_BASE + '/ru/login', {
    credentials: 'include'
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('OJS ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╡╨╜ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.text()
    })
    .then(function (html) {
      if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
        throw new Error('OJS ╨▓╨╡╤А╨╜╤Г╨╗ JSON ╨▓╨╝╨╡╤Б╤В╨╛ HTML')
      }
      var match = html.match(/name="csrfToken"\s+(?:value|content)="([^"]+)"/) ||
                  html.match(/"csrfToken":"([^"]+)"/) ||
                  html.match(/csrfToken.*?"([^"]+)"/)
      if (!match) {
        if (html.indexOf('dashboard') !== -1 || html.indexOf('editorial') !== -1) {
          throw new Error('╨б╨╡╤Б╤Б╨╕╤П ╤Г╨╢╨╡ ╨░╨║╤В╨╕╨▓╨╜╨░')
        }
        throw new Error('CSRF-╤В╨╛╨║╨╡╨╜ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜')
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
            throw new Error('╨Э╨╡╨▓╨╡╤А╨╜╨╛╨╡ ╨╕╨╝╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╗╨╕ ╨┐╨░╤А╨╛╨╗╤М')
          }
          return true
        })
      }
      if (response.status >= 200 && response.status < 400) {
        return true
      }
      throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╡╤А╨▓╨╡╤А╨░: ' + response.status)
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
// ╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╕
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
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
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
      throw new Error('╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜')
    })
}

// ========================================
// ╨У╤А╤Г╨┐╨┐╤Л ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╣ (╤А╨╛╨╗╨╕)
// ========================================

// ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М ╤Б╨┐╨╕╤Б╨╛╨║ ╨│╤А╤Г╨┐╨┐ (contexts) ╨┤╨╗╤П ╨╜╨░╨╖╨╜╨░╤З╨╡╨╜╨╕╤П ╤А╨╛╨╗╨╡╨╣
export function getContexts() {
  return fetchThroughProxy(API_BASE + '/api/v1/contexts', {
    headers: authHeaders
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨╡╨║╤Б╤В╨╛╨▓ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
}

// ╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨▓ ╨│╤А╤Г╨┐╨┐╤Г (╨╜╨░╨╖╨╜╨░╤З╨╕╤В╤М ╤А╨╛╨╗╤М)
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
          throw new Error(err.errorMessage || '╨Ю╤И╨╕╨▒╨║╨░ ╨╜╨░╨╖╨╜╨░╤З╨╡╨╜╨╕╤П ╤А╨╛╨╗╨╕ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
        })
      }
      usersCache = null
      return response.json()
    })
}

// ========================================
// ╨Ц╤Г╤А╨╜╨░╨╗ ╨╕ ╨▓╤Л╨┐╤Г╤Б╨║╨╕
// ========================================

export function getJournalInfo() {
  return fetchThroughProxy(API_BASE + '/api/v1/contexts', { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╨╕ ╨╛ ╨╢╤Г╤А╨╜╨░╨╗╨╡ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      var journal = data.items && data.items.length > 0 ? data.items[0] : null
      return journal
    })
}

// ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М ID ╤В╨╡╨║╤Г╤Й╨╡╨│╨╛ ╨╢╤Г╤А╨╜╨░╨╗╨░ (context)
export function getCurrentContextId() {
  return getJournalInfo()
    .then(function (journal) {
      if (!journal) {
        throw new Error('╨Ц╤Г╤А╨╜╨░╨╗ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜')
      }
      return journal.id
    })
}

// ╨Т╨║╨╗╤О╤З╨╕╤В╤М ╨╗╨╛╨║╨░╨╗╤М (╨╜╨░╨┐╤А╨╕╨╝╨╡╤А 'en') ╨┤╨╗╤П ╤В╨╡╨║╤Г╤Й╨╡╨│╨╛ ╨╢╤Г╤А╨╜╨░╨╗╨░ (context).
// OJS ╨┐╤А╨╕ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╕ ╨╝╨╜╨╛╨│╨╛╤П╨╖╤Л╤З╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣ ╨╝╨╡╤В╨░╨┤╨░╨╜╨╜╤Л╤Е (title.en, abstract.en ╨╕ ╤В.╨┐.)
// ╨▓╨░╨╗╨╕╨┤╨╕╤А╤Г╨╡╤В, ╤З╤В╨╛ ╨╗╨╛╨║╨░╨╗╤М ╨┐╤А╨╕╤Б╤Г╤В╤Б╤В╨▓╤Г╨╡╤В ╨▓ supportedLocales / supportedFormLocales
// ╨╢╤Г╤А╨╜╨░╨╗╨░. ╨Х╤Б╨╗╨╕ 'en' ╤В╨░╨╝ ╨╜╨╡╤В тАФ PUT /publications/{id} ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В 400.
export function enableContextLocale(locale) {
  locale = locale || 'en'
  return getCurrentContextId()
    .then(function (contextId) {
      return getJournalInfo().then(function (journal) {
        if (!journal) {
          throw new Error('╨Ц╤Г╤А╨╜╨░╨╗ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜')
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
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╨▓╨║╨╗╤О╤З╨╡╨╜╨╕╤П ╨╗╨╛╨║╨░╨╗╨╕ ' + locale + ' (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╤Б╨┐╨╕╤Б╨║╨░ ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
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
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П submissions (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
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
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┤╨╡╤В╨░╨╗╨╡╨╣ submission (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
}

function localizeValue(obj) {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.ru || obj.en || ''
}

// ╨Ъ╨╛╨╝╨┐╨╗╨╡╨║╤Б╨╜╨░╤П ╨┐╤А╨╛╨▓╨╡╤А╨║╨░ ╤В╨░╨▒╨╗╨╕╤Ж ╨╜╨░ ┬л╨╛╤Б╨╕╤А╨╛╤В╨╡╨▓╤И╨╕╨╡┬╗ ╨╖╨░╨┐╨╕╤Б╨╕.
// ╨Т╨░╨╗╨╕╨┤╨╜╨░╤П ╤Б╤В╨░╤В╤М╤П = ╨╝╨░╤В╨╡╤А╨╕╨░╨╗ (submission) + ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╤П (publication),
// ╤Б╨▓╤П╨╖╨░╨╜╨╜╤Л╨╡ ╨╝╨╡╨╢╨┤╤Г ╤Б╨╛╨▒╨╛╨╣, ╨┐╨╗╤О╤Б (╨╛╨┐╤Ж╨╕╨╛╨╜╨░╨╗╤М╨╜╨╛) ╨░╨▓╤В╨╛╤А╤Л (contributors).
// ╨Т╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В ╤В╤А╨╕ ╨│╤А╤Г╨┐╨┐╤Л ╨╜╨╡╨▓╨░╨╗╨╕╨┤╨╜╤Л╤Е ╨╖╨░╨┐╨╕╤Б╨╡╨╣:
//   1) submissionsWithoutPublication тАФ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╤Л ╨▒╨╡╨╖ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕;
//   2) publicationsWithoutSubmission тАФ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ ╨▒╨╡╨╖ (╨▓╨░╨╗╨╕╨┤╨╜╨╛╨│╨╛) ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨░;
//   3) authorsWithoutPublication тАФ ╨░╨▓╤В╨╛╤А╤Л ╨▒╨╡╨╖ (╨▓╨░╨╗╨╕╨┤╨╜╨╛╨╣) ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕.
export function getTableCheckData() {
  return Promise.all([getSubmissions(), getJournalInfo(), getIssues()])
    .then(function (init) {
      var subs = init[0] || []
      var journal = init[1]
      var issues = init[2] || []
      var journalId = journal ? journal.id : null

      // ╨г╨▒╨╡╨┤╨╕╨╝╤Б╤П, ╤З╤В╨╛ ╤Г ╨║╨░╨╢╨┤╨╛╨│╨╛ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨░ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜ ╨╝╨░╤Б╤Б╨╕╨▓ publications
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

      // ╨б╨╛╨▒╨╕╤А╨░╨╡╨╝ ╨▓╤Б╨╡ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ ╤Б╨╛ ╤Б╤Б╤Л╨╗╨║╨╛╨╣ ╨╜╨░ ╤А╨╛╨┤╨╕╤В╨╡╨╗╤М╤Б╨║╨╕╨╣ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗
      var allPublications = []
      subs.forEach(function (s) {
        (s.publications || []).forEach(function (pub) {
          allPublications.push({ pub: pub, submissionId: s.id })
        })
      })

      var publicationIds = {}
      allPublications.forEach(function (p) { publicationIds[p.pub.id] = p })

      // ╨Ь╨░╤В╨╡╤А╨╕╨░╨╗╤Л ╨▒╨╡╨╖ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╣
      var submissionsWithoutPublication = subs
        .filter(function (s) { return !s.publications || s.publications.length === 0 })
        .map(function (s) {
          var titleObj = (s.currentPublication && s.currentPublication.title) || s.title || {}
          return {
            id: s.id,
            title: localizeValue(titleObj) || '(╨▒╨╡╨╖ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤П)',
            status: s.status,
            stageId: s.stageId,
            dateSubmitted: s.dateSubmitted || s.dateLastActivity || null,
            publicationsCount: 0
          }
        })

      // ╨Ь╨░╤В╨╡╤А╨╕╨░╨╗╤Л ╤Б ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╡╨╣, ╨╜╨╛ ╨▒╨╡╨╖ ╨┐╤А╨╕╨▓╤П╨╖╨║╨╕ ╨║ ╨▓╤Л╨┐╤Г╤Б╨║╤Г (issue)
      var articlesWithoutIssue = []
      subs.forEach(function (s) {
        var pubs = s.publications || []
        if (pubs.length === 0) return
        var hasIssue = pubs.some(function (pub) { return pub.issueId })
        if (!hasIssue) {
          var titleObj = (s.currentPublication && s.currentPublication.title) || pubs[0].title || s.title || {}
          articlesWithoutIssue.push({
            id: s.id,
            title: localizeValue(titleObj) || '(╨▒╨╡╨╖ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤П)',
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

      // ╨Т╤Л╨┐╤Г╤Б╨║╨╕ ╨▒╨╡╨╖ ╨┐╤А╨╕╨▓╤П╨╖╨║╨╕ ╨║ ╨╢╤Г╤А╨╜╨░╨╗╤Г
      var issuesWithoutJournal = ctx.issues
        .filter(function (issue) {
          return !issue.journalId || (journalId !== null && issue.journalId !== journalId)
        })
        .map(function (issue) {
          return {
            id: issue.id,
            title: localizeValue(issue.title) || issue.identification || '(╨▒╨╡╨╖ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤П)',
            journalId: issue.journalId || null,
            identification: issue.identification || ''
          }
        })

      // ╨Ч╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨║╨╛╨╜╤В╤А╨╕╨▒╤М╤О╤В╨╡╤А╨╛╨▓ ╨┤╨╗╤П ╨║╨░╨╢╨┤╨╛╨╣ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕
      return Promise.all(allPublications.map(function (p) {
        return getContributors(p.submissionId, p.pub.id)
          .then(function (list) { return { p: p, contributors: list || [] } })
          .catch(function () { return { p: p, contributors: [] } })
      })).then(function (entries) {
        var pubContributors = {}
        entries.forEach(function (e) { pubContributors[e.p.pub.id] = e.contributors })

        // ╨Я╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ ╨▒╨╡╨╖ ╨▓╨░╨╗╨╕╨┤╨╜╨╛╨│╨╛ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨░
        var publicationsWithoutSubmission = allPublications
          .filter(function (p) {
            var sid = p.pub.submissionId
            return !sid || !submissionIds[sid] || sid !== p.submissionId
          })
          .map(function (p) {
            return {
              id: p.pub.id,
              submissionId: p.pub.submissionId || null,
              title: localizeValue(p.pub.title) || '(╨▒╨╡╨╖ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤П)',
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

        // ╨Р╨▓╤В╨╛╤А╤Л ╨▒╨╡╨╖ ╨▓╨░╨╗╨╕╨┤╨╜╨╛╨╣ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕
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

// ╨Ъ╨░╤Б╨║╨░╨┤╨╜╨╛╨╡ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╨╡ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨░: OJS ╨┐╤А╨╕ DELETE /submissions/{id}
// ╤Б╨░╨╝ ╤Г╨┤╨░╨╗╤П╨╡╤В ╤Б╨▓╤П╨╖╨░╨╜╨╜╤Л╨╡ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ ╨╕ ╨║╨╛╨╜╤В╤А╨╕╨▒╤М╤О╤В╨╡╤А╨╛╨▓.
export function deleteSubmissionCascade(submissionId) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId, {
    method: 'DELETE',
    headers: authHeaders
  }).then(function (r) {
    if (!r.ok) {
      return r.json().then(function (e) {
        throw new Error(e.errorMessage || '╨Ю╤И╨╕╨▒╨║╨░ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╤П ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨░')
      })
    }
    return true
  })
}

// ╨Ъ╨░╤Б╨║╨░╨┤╨╜╨╛╨╡ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╨╡ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕: ╤Б╨╜╨░╤З╨░╨╗╨░ ╤Г╨┤╨░╨╗╤П╨╡╨╝ ╨▓╤Б╨╡╤Е ╨║╨╛╨╜╤В╤А╨╕╨▒╤М╤О╤В╨╡╤А╨╛╨▓,
// ╨╖╨░╤В╨╡╨╝ ╤Б╨░╨╝╤Г ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╤О, ╤З╤В╨╛╨▒╤Л ╨╜╨╡ ╨╛╤Б╤В╨░╨╗╨╛╤Б╤М ╨╖╨░╨▓╨╕╤Б╤И╨╕╤Е ╨░╨▓╤В╨╛╤А╨╛╨▓.
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
          throw new Error(e.errorMessage || '╨Ю╤И╨╕╨▒╨║╨░ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╤П ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕')
        })
      }
      return true
    })
  })
}

// ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М ╤Б╨┐╨╕╤Б╨╛╨║ ╤Б╨╡╨║╤Ж╨╕╨╣ (╤А╨░╨╖╨┤╨╡╨╗╨╛╨▓) ╨╢╤Г╤А╨╜╨░╨╗╨░
export function getSections() {
  return fetchThroughProxy(API_BASE + '/api/v1/sections', { headers: authHeaders })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╤Б╨╡╨║╤Ж╨╕╨╣ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items || []
    })
}

// ╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡ submission (╤Б╤В╨░╤В╤М╨╕)
export function createSubmission(data) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions', {
    method: 'POST',
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П submission (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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

// ╨Ю╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╨╡ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╡╨╣ publication (PUT).
// OJS ╨┐╤А╨╕ createSubmission ╤Г╨╢╨╡ ╤Б╨╛╨╖╨┤╨░╤С╤В publication v1, ╨┐╨╛╤Н╤В╨╛╨╝╤Г ╨╝╨╡╤В╨░╨┤╨░╨╜╨╜╤Л╨╡
// ╨╜╤Г╨╢╨╜╨╛ ╨╖╨░╨┐╨╕╤Б╤Л╨▓╨░╤В╤М ╨▓ ╨╜╨╡╤С ╤З╨╡╤А╨╡╨╖ PUT, ╨░ ╨╜╨╡ ╤Б╨╛╨╖╨┤╨░╨▓╨░╤В╤М ╨▓╤В╨╛╤А╤Г╤О ╤З╨╡╤А╨╡╨╖ POST.
export function updatePublication(submissionId, publicationId, data) {
  return fetchThroughProxy(API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId, {
    method: 'PUT',
    headers: jsonAuthHeaders,
    body: JSON.stringify(data)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П publication (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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

// ╨Ч╨░╨│╤А╤Г╨╖╨║╨░ ╤Д╨░╨╣╨╗╨░ ╨▓ submission
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
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╤Д╨░╨╣╨╗╨░ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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

// ╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡ galley (╨┐╤А╨╡╨┤╤Б╤В╨░╨▓╨╗╨╡╨╜╨╕╤П ╤Д╨░╨╣╨╗╨░) ╨┤╨╗╤П publication.
// ╨Я╨╛╤Б╨╗╨╡ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╤Д╨░╨╣╨╗╨░ ╨▓ submission ╨╡╨│╨╛ ╨╜╤Г╨╢╨╜╨╛ ╨┐╤А╨╕╨║╤А╨╡╨┐╨╕╤В╤М ╨║ publication ╨║╨░╨║ galley,
// ╨╕╨╜╨░╤З╨╡ PDF ╨╜╨╡ ╨╛╤В╨╛╨▒╤А╨░╨╢╨░╨╡╤В╤Б╤П ╨▓ ╨▓╤Л╨┐╤Г╤Б╨║╨╡.
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
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П galley (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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

// ╨Я╨╡╤А╨╡╨▓╨╛╨┤ submission ╨▓ Production stage
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
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╡╤А╨╡╨▓╨╛╨┤╨░ ╨▓ production (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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

// ╨Э╨░╨╖╨╜╨░╤З╨╡╨╜╨╕╨╡ submission ╨▓ ╨▓╤Л╨┐╤Г╤Б╨║.
// ╨Т╨Э╨Ш╨Ь╨Р╨Э╨Ш╨Х: ╨▓ ╤В╨╡╨║╤Г╤Й╨╡╨╣ ╨▓╨╡╤А╤Б╨╕╨╕ OJS ╨Э╨Х╨в REST-╨╝╨░╤А╤И╤А╤Г╤В╨░ /issues/{id}/catalog
// (╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В 500 "route could not be found"). ╨Э╨░╨╖╨╜╨░╤З╨╡╨╜╨╕╨╡ ╨▓╤Л╨┐╤Г╤Б╨║╨░ ╨┤╨╡╨╗╨░╨╡╤В╤Б╤П
// ╤З╨╡╤А╨╡╨╖ ╨┐╨╛╨╗╨╡ issueId ╨╜╨░ publication: PUT /submissions/{id}/publications/{pubId}.
function assignPublicationToIssue(submissionId, issueId) {
  return getSubmissionDetail(submissionId)
    .then(function (submission) {
      var publicationId = submission.currentPublicationId ||
        (submission.publications && submission.publications[0] && submission.publications[0].id)
      if (!publicationId) {
        throw new Error('╨Э╨╡ ╨┐╨╛╨╗╤Г╤З╨╡╨╜ ID publication ╨┤╨╗╤П ╨╜╨░╨╖╨╜╨░╤З╨╡╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░')
      }
      return updatePublication(submissionId, publicationId, { issueId: issueId })
    })
}

// ========================================
// ╨Р╨▓╤В╨╛╤А╤Л (contributors) ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕
// ╨Т ╤Н╤В╨╛╨╣ ╨▓╨╡╤А╤Б╨╕╨╕ OJS REST API ╨░╨▓╤В╨╛╤А╤Л ╤Б╨╛╨╖╨┤╨░╤О╤В╤Б╤П ╤З╨╡╤А╨╡╨╖ ╨╝╨░╤А╤И╤А╤Г╤В contributors
// (PUT publication ╤Б ╨┐╨╛╨╗╨╡╨╝ authors ╨╕╨│╨╜╨╛╤А╨╕╤А╤Г╨╡╤В╤Б╤П, ╨╛╤В╨┤╨╡╨╗╤М╨╜╨╛╨│╨╛ /authors ╨╜╨╡╤В).
// ╨Р╨▓╤В╨╛╤А╤Б╨║╨░╤П ╨│╤А╤Г╨┐╨┐╨░ "╨Р╨▓╤В╨╛╤А" ╨╕╨╝╨╡╨╡╤В userGroupId = 14.
// ========================================

// ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М ╨┐╨╛╨╗╨╜╤Л╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╨╛╨╣ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ (╨▓╨║╨╗╤О╤З╨░╤П keywords,
// ╨║╨╛╤В╨╛╤А╤Л╨╡ ╨▓ ╨╛╤В╨▓╨╡╤В╨╡ /submissions/{id} ╨Э╨Х ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╤О╤В╤Б╤П, ╨▓ ╨╛╤В╨╗╨╕╤З╨╕╨╡ ╨╛╤В
// ╨┐╤А╤П╨╝╨╛╨│╨╛ ╤Н╨╜╨┤╨┐╨╛╨╕╨╜╤В╨░ /submissions/{id}/publications/{id}).
export function getPublication(submissionId, publicationId) {
  return fetchThroughProxy(
    API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId,
    { headers: authHeaders }
  )
    .then(function (response) {
      if (!response.ok) {
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
}

// ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М ╤Б╨┐╨╕╤Б╨╛╨║ contributors ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕
export function getContributors(submissionId, publicationId) {
  return fetchThroughProxy(
    API_BASE + '/api/v1/submissions/' + submissionId + '/publications/' + publicationId + '/contributors',
    { headers: authHeaders }
  )
    .then(function (response) {
      if (!response.ok) {
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨░╨▓╤В╨╛╤А╨╛╨▓ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data.items || []
    })
}

// ╨б╨╛╨╖╨┤╨░╤В╤М contributor (╨░╨▓╤В╨╛╤А╨░) ╨┤╨╗╤П ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕
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
          var errMsg = '╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨░╨▓╤В╨╛╤А╨░ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')'
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

// ╨г╨┤╨░╨╗╨╕╤В╤М ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╨╛╨│╨╛ contributor
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
          throw new Error(err.errorMessage || '╨Ю╤И╨╕╨▒╨║╨░ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╤П ╨░╨▓╤В╨╛╤А╨░ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
        })
      }
      return response.json()
    })
}

// ID ╨│╤А╤Г╨┐╨┐╤Л "╨Р╨▓╤В╨╛╤А" ╨▓ ╤Н╤В╨╛╨╝ ╨╢╤Г╤А╨╜╨░╨╗╨╡
export var AUTHOR_USER_GROUP_ID = 14

// ╨б╨▓╤П╨╖╤Л╨▓╨░╨╜╨╕╨╡ submission ╤Б issue (╤З╨╡╤А╨╡╨╖ publication.issueId)
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
        throw new Error('╨Э╨╡ ╨┐╨╛╨╗╤Г╤З╨╡╨╜ ID publication ╨┤╨╗╤П ╤Б╨╜╤П╤В╨╕╤П ╤Б ╨▓╤Л╨┐╤Г╤Б╨║╨░')
      }
      // issueId: null тАФ ╤Б╨╜╨╕╨╝╨░╨╡╨╝ ╤Б╤В╨░╤В╤М╤О ╤Б ╨▓╤Л╨┐╤Г╤Б╨║╨░
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
        throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┤╨╡╤В╨░╨╗╨╡╨╣ ╨▓╤Л╨┐╤Г╤Б╨║╨░ (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      return response.json()
    })
    .then(function (data) {
      return data
    })
}

// ========================================
// ╨г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨▓╤Л╨┐╤Г╤Б╨║╨░╨╝╨╕ ╤З╨╡╤А╨╡╨╖ component-handler ($$$call$$$)
// REST API /api/v1/issues ╨▓ OJS 3.5 ╨Э╨Х ╨┐╨╛╨┤╨┤╨╡╤А╨╢╨╕╨▓╨░╨╡╤В ╤Б╨╛╨╖╨┤╨░╨╜╨╕╨╡/╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╡/
// ╤Г╨┤╨░╨╗╨╡╨╜╨╕╨╡/╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╤О ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓. ╨н╤В╨╕ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕ ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л ╤В╨╛╨╗╤М╨║╨╛ ╤З╨╡╤А╨╡╨╖
// ╨║╨╛╨╝╨┐╨╛╨╜╨╡╨╜╤В-╨╛╨▒╤А╨░╨▒╨╛╤В╤З╨╕╨║╨╕ (IssueGridHandler): publishIssue, unpublishIssue,
// deleteIssue, updateIssue (╤Б╨╛╨╖╨┤╨░╨╜╨╕╨╡/╤А╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡ ╤З╨╡╤А╨╡╨╖ IssueForm).
// ╨Ч╨░╨┐╤А╨╛╤Б╤Л ╨╕╨┤╤Г╤В ╤Б cookie-╤Б╨╡╤Б╤Б╨╕╨╡╨╣ ╨╕ CSRF-╤В╨╛╨║╨╡╨╜╨╛╨╝ (╨║╨░╨║ ╨╛╨▒╤Л╤З╨╜╨░╤П ╤Д╨╛╤А╨╝╨░ OJS),
// ╨┐╨╛╤Н╤В╨╛╨╝╤Г ╨Э╨Х ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ JSON/Bearer ╨╕ ╨║╨░╤Б╤В╨╛╨╝╨╜╤Л╨╡ ╨╖╨░╨│╨╛╨╗╨╛╨▓╨║╨╕ (╤З╤В╨╛╨▒╤Л ╨╜╨╡ ╨▒╤Л╨╗╨╛
// CORS-preflight). CSRF ╨┐╨╡╤А╨╡╨┤╨░╤С╨╝ ╨┐╨╛╨╗╨╡╨╝/╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨╝ csrfToken.
// ========================================

// ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М CSRF-╤В╨╛╨║╨╡╨╜ ╤Б╨╡╤Б╤Б╨╕╨╕ OJS. ╨а╨░╨▒╨╛╤В╨░╨╡╤В ╨║╨░╨║ ╨Ф╨Ю ╨▓╤Е╨╛╨┤╨░ (╤Б╤В╤А╨░╨╜╨╕╤Ж╨░ ╨╗╨╛╨│╨╕╨╜╨░
// ╤Б╨╛╨┤╨╡╤А╨╢╨╕╤В ╤Б╨║╤А╤Л╤В╨╛╨╡ ╨┐╨╛╨╗╨╡ csrfToken), ╤В╨░╨║ ╨╕ ╨Я╨Ю╨б╨Ы╨Х (dashboard ╤Б╨╛╨┤╨╡╤А╨╢╨╕╤В ╤В╨╛╨║╨╡╨╜
// ╨▓ ╤А╨░╨╖╨╝╨╡╤В╨║╨╡/JSON). ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В╤Б╤П ╨┤╨╗╤П component-handler ╨╖╨░╨┐╤А╨╛╤Б╨╛╨▓.
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
      // ╨г╨╢╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╤Л тАФ ╤В╨╛╨║╨╡╨╜ ╨▓ dashboard
      return fetchThroughProxy(API_BASE + '/ru', { credentials: 'include' })
        .then(function (response) { return response.text() })
        .then(function (html2) {
          var token2 = extract(html2)
          if (!token2) throw new Error('CSRF-╤В╨╛╨║╨╡╨╜ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜ (╨▓╨╛╨╣╨┤╨╕╤В╨╡ ╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╤Г)')
          return token2
        })
    })
}

function buildFormBody(obj) {
  return Object.keys(obj).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k] == null ? '' : obj[k])
  }).join('&')
}

// ╨Т╤Л╨╖╨╛╨▓ component-handler ╨┤╨╗╤П ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓.
// gridOp тАФ ╨┐╤Г╤В╤М ╨▓╨╕╨┤╨░ 'future-issue-grid/update-issue',
//          'issue-grid/publish-issue', 'back-issue-grid/unpublish-issue',
//          'back-issue-grid/delete-issue'.
// issueId тАФ ID ╨▓╤Л╨┐╤Г╤Б╨║╨░ (╨┤╨╗╤П create = null).
// formObj тАФ ╨┐╨╛╨╗╤П ╤Д╨╛╤А╨╝╤Л (╨┤╨╗╤П create/update) ╨╕╨╗╨╕ null.
// extraParams тАФ ╨┤╨╛╨┐. query-╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л (╨╜╨░╨┐╤А. confirmed=1).
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

// ╨Я╤А╨╛╨▓╨╡╤А╨╕╤В╤М, ╤Б╨╛╨┤╨╡╤А╨╢╨╕╤В ╨╗╨╕ HTML ╤Д╨╛╤А╨╝╤Л ╨а╨Х╨Р╨Ы╨м╨Э╨г╨о ╨╛╤И╨╕╨▒╨║╤Г ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕.
// OJS ╨┐╤А╨╕ ╨╛╤И╨╕╨▒╨║╨╡ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╤А╤П╨┤╨╛╨╝ ╤Б ╨╜╨╡╨▓╨╡╤А╨╜╤Л╨╝ ╨┐╨╛╨╗╨╡╨╝ ╤А╨╕╤Б╤Г╨╡╤В .formError,
// ╨░ ╨▓ #issueDataNotification тАФ ╤В╨╡╨║╤Б╤В ╨╛╤И╨╕╨▒╨║╨╕ (╤Б ╨║╨╗╨░╤Б╤Б╨╛╨╝ notifyError/
// notifyWarning). ╨Т╨Р╨Ц╨Э╨Ю: ╤Е╨╡╨╜╨┤╨╗╨╡╤А future-issue-grid/update-issue ╨┐╤А╨╕
// ╨г╨б╨Я╨Х╨и╨Э╨Ю╨Ь ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╕ ╤В╨╛╨╢╨╡ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В form (╤Б╤В╨░╤В╤Г╤Б true, content=<form>),
// ╨╜╨╛ ╨С╨Х╨Ч .formError ╨╕ ╤Б ╨┐╤Г╤Б╤В╤Л╨╝ #issueDataNotification тАФ ╤Н╤В╨╛ ╨Э╨Х ╨╛╤И╨╕╨▒╨║╨░.
// ╨Я╨╛╤Н╤В╨╛╨╝╤Г ┬л╤Д╨╛╤А╨╝╨░ ╨▓╨╡╤А╨╜╤Г╨╗╨░╤Б╤М┬╗ тЙа ┬л╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П ╨╜╨╡ ╨┐╤А╨╛╤И╨╗╨░┬╗.
function formHasErrors(html) {
  if (!html) return false
  var cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  // ╨п╨▓╨╜╤Л╨╡ ╨╛╤И╨╕╨▒╨║╨╕ ╤Г ╨┐╨╛╨╗╨╡╨╣.
  if (/class="[^"]*formError[^"]*"/.test(cleaned)) return true
  // ╨Ю╤И╨╕╨▒╨║╨╕ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╨╛╤В╨┤╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣ OJS (╨╜╨░╨┐╤А. ┬л╨Я╤Г╤В╤М URL ╤Г╨╢╨╡ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В╤Б╤П┬╗)
  // ╨┐╨╛╨╝╨╡╤З╨░╤О╤В╤Б╤П ╨║╨╗╨░╤Б╤Б╨╛╨╝ ┬лsub_label error┬╗ ╤А╤П╨┤╨╛╨╝ ╤Б ╨╜╨╡╨▓╨╡╤А╨╜╤Л╨╝ ╨┐╨╛╨╗╨╡╨╝ тАФ ╤Н╤В╨╛ ╤В╨╛╨╢╨╡
  // ╤А╨╡╨░╨╗╤М╨╜╨░╤П ╨╛╤И╨╕╨▒╨║╨░ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╤П, ╨░ ╨╜╨╡ ╨┐╤А╨╛╤Б╤В╨╛ ╨┤╨╡╨║╨╛╤А╨░╤В╨╕╨▓╨╜╨░╤П ╨┐╨╛╨┤╨┐╨╕╤Б╤М.
  if (/class="[^"]*sub_label error[^"]*"/.test(cleaned)) return true
  // ╨г╨▓╨╡╨┤╨╛╨╝╨╗╨╡╨╜╨╕╨╡ ╤Б ╤В╨╡╨║╤Б╤В╨╛╨╝ ╨╛╤И╨╕╨▒╨║╨╕.
  var notificationMatch = cleaned.match(/id="issueDataNotification"[^>]*>([\s\S]*?)<\/div>/i)
  if (notificationMatch) {
    var nt = notificationMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (nt) return true
  }
  return false
}

// ╨Ш╨╖╨▓╨╗╨╡╤З╤М ╨Я╨Ю╨Э╨п╨в╨Э╨л╨Щ ╤В╨╡╨║╤Б╤В ╨╛╤И╨╕╨▒╨║╨╕ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╨╕╨╖ HTML ╤Д╨╛╤А╨╝╤Л, ╨▓╨╛╨╖╨▓╤А╨░╤Й╤С╨╜╨╜╨╛╨│╨╛ OJS.
// ╨Т╤Л╨╖╤Л╨▓╨░╨╡╤В╤Б╤П ╤В╨╛╨╗╤М╨║╨╛ ╨║╨╛╨│╨┤╨░ formHasErrors() === true.
function extractFormError(html) {
  // ╨г╨▒╨╕╤А╨░╨╡╨╝ ╤Б╨║╤А╨╕╨┐╤В╤Л тАФ ╨╛╨╜╨╕ ╤В╨╛╨╗╤М╨║╨╛ ╨╝╨╡╤И╨░╤О╤В.
  var cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  // ╨Я╤Л╤В╨░╨╡╨╝╤Б╤П ╨▓╤Л╤В╨░╤Й╨╕╤В╤М ╤В╨╡╨║╤Б╤В ╤Г╨▓╨╡╨┤╨╛╨╝╨╗╨╡╨╜╨╕╤П ╨╛╨▒ ╨╛╤И╨╕╨▒╨║╨╡.
  var notificationMatch = cleaned.match(/id="issueDataNotification"[^>]*>([\s\S]*?)<\/div>/i)
  var parts = []
  if (notificationMatch) {
    var nt = notificationMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (nt) parts.push(nt)
  }
  // ╨Я╨╛╨╗╤П ╤Б ╨╛╤И╨╕╨▒╨║╨╛╨╣ (.formError).
  var errMatches = cleaned.match(/class="[^"]*formError[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)
  if (errMatches) {
    errMatches.forEach(function (m) {
      var t = m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (t && parts.indexOf(t) === -1) parts.push(t)
    })
  }
  // ╨Ю╤И╨╕╨▒╨║╨╕ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╨╛╤В╨┤╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣ (sub_label error, ╨╜╨░╨┐╤А. ╨┤╨╗╤П urlPath).
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
  // ╨Ч╨░╨┐╨░╤Б╨╜╨╛╨╣ ╨▓╨░╤А╨╕╨░╨╜╤В: ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╨╝ ╨╛╨▒╤Й╨╕╨╣ ╤В╨╡╨║╤Б╤В ╨╛╤И╨╕╨▒╨║╨╕ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕.
  return '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'
}

// ╨Ш╨╖╨▓╨╗╨╡╤З╤М ID ╨▓╤Л╨┐╤Г╤Б╨║╨░ ╨╕╨╖ action-URL ╤Д╨╛╤А╨╝╤Л, ╨▓╨╛╨╖╨▓╤А╨░╤Й╤С╨╜╨╜╨╛╨╣ OJS.
// ╨Я╨╛╤Б╨╗╨╡ ╨г╨б╨Я╨Х╨и╨Э╨Ю╨У╨Ю ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╤П OJS ╨┐╨╡╤А╨╡╤А╨╕╤Б╨╛╨▓╤Л╨▓╨░╨╡╤В ╤Д╨╛╤А╨╝╤Г ╤А╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╨╜╨╕╤П,
// ╨▓ action ╨║╨╛╤В╨╛╤А╨╛╨╣ ╨┐╤А╨╛╨┐╨╕╤Б╨░╨╜ issueId (.../update-issue?issueId=123).
// ╨Х╤Б╨╗╨╕ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡ ╨╜╨╡ ╨┐╤А╨╛╨╕╨╖╨╛╤И╨╗╨╛ (╤Д╨╛╤А╨╝╨░ ╨┐╤А╨╛╤Б╤В╨╛ ╨┐╨╛╨║╨░╨╖╨░╨╜╨░ ╤Б╨╜╨╛╨▓╨░), issueId
// ╨┐╤Г╤Б╤В╨╛╨╣ тАФ ╤Н╤В╨╛ ╨╜╨░╨┤╤С╨╢╨╜╤Л╨╣ ╨┐╤А╨╕╨╖╨╜╨░╨║ ╤В╨╛╨│╨╛, ╤З╤В╨╛ ╨▓╤Л╨┐╤Г╤Б╨║ ╨Э╨Х ╤Б╨╛╨╖╨┤╨░╨╜.
function extractIssueIdFromForm(html) {
  var m = html && html.match(/update-issue\?issueId=(\d+)/)
  return m ? m[1] : null
}

// ╨Ю╨▒╤А╨░╨▒╨╛╤В╨║╨░ ╨╛╤В╨▓╨╡╤В╨░ component-handler (╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В JSONMessage ╨▓ JSON).
// ╨Т╨Э╨Ш╨Ь╨Р╨Э╨Ш╨Х: ╨┐╤А╨╕ ╨╜╨╡╤Г╨┤╨░╤З╨╜╨╛╨╣ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╤Д╨╛╤А╨╝╤Л (IssueForm ╨╕ ╤В.╨┐.) OJS ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В
// JSONMessage(status=true, content=<HTML ╤Д╨╛╤А╨╝╤Л>), ╤В.╨╡. status === true, ╨╜╨╛
// ╤В╨╡╨╗╨╛ ╤Б╨╛╨┤╨╡╤А╨╢╨╕╤В ╨┐╨╛╨▓╤В╨╛╤А╨╜╨╛ ╨╛╤В╤А╨╕╤Б╨╛╨▓╨░╨╜╨╜╤Г╤О ╤Д╨╛╤А╨╝╤Г ╤Б ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П╨╝╨╕ ╨╛╨▒ ╨╛╤И╨╕╨▒╨║╨░╤Е.
// ╨в╨░╨║╨╛╨╣ ╨╛╤В╨▓╨╡╤В ╨Э╨Х ╤П╨▓╨╗╤П╨╡╤В╤Б╤П ╤Г╤Б╨┐╨╡╤Е╨╛╨╝ тАФ ╨▓╤Л╨┐╤Г╤Б╨║/╤Б╤В╨░╤В╤М╤П ╨╜╨╡ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╤Л. ╨Я╨╛╤Н╤В╨╛╨╝╤Г
// ╨╡╤Б╨╗╨╕ content ╤Б╨╛╨┤╨╡╤А╨╢╨╕╤В ╤А╨░╨╖╨╝╨╡╤В╨║╤Г ╤Д╨╛╤А╨╝╤Л (pkp_form / <form), ╤Б╤З╨╕╤В╨░╨╡╨╝ ╤Н╤В╨╛
// ╨╛╤И╨╕╨▒╨║╨╛╨╣ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╨╕ ╨▓╤Л╨▒╤А╨░╤Б╤Л╨▓╨░╨╡╨╝ ╨┐╨╛╨╜╤П╤В╨╜╨╛╨╡ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡.
function handleComponentResponse(prefix) {
  return function (response) {
    return response.text().then(function (text) {
      if (!response.ok) {
        throw new Error(prefix + ' (╤Б╤В╨░╤В╤Г╤Б: ' + response.status + ')')
      }
      try {
        var json = JSON.parse(text)
        if (json && json.status === false) {
          var msg = (json.content && json.content.replace(/<[^>]+>/g, ' ').trim()) ||
                    json.errorMessage || '╨╜╨╡╨╕╨╖╨▓╨╡╤Б╤В╨╜╨░╤П ╨╛╤И╨╕╨▒╨║╨░'
          throw new Error(prefix + ': ' + msg)
        }
        // status === true. ╨е╨╡╨╜╨┤╨╗╨╡╤А update-issue ╨┐╤А╨╕ ╨г╨б╨Я╨Х╨е╨Х ╤В╨╛╨╢╨╡ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В
        // ╤Д╨╛╤А╨╝╤Г (content=<form>), ╨╜╨╛ ╨▒╨╡╨╖ ╨╛╤И╨╕╨▒╨╛╨║. ╨б╤З╨╕╤В╨░╨╡╨╝ ╨╛╤И╨╕╨▒╨║╨╛╨╣ ╤В╨╛╨╗╤М╨║╨╛
        // ╨╡╤Б╨╗╨╕ ╨▓ ╤Д╨╛╤А╨╝╨╡ ╨╡╤Б╤В╤М ╤А╨╡╨░╨╗╤М╨╜╤Л╨╡ ╤Г╨║╨░╨╖╨░╤В╨╡╨╗╨╕ ╨╛╤И╨╕╨▒╨╛╨║ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕.
        if (json && json.status === true && json.content && /pkp_form|<form[\s>]/.test(json.content)) {
          if (formHasErrors(json.content)) {
            console.error('[OJS] ╨╛╤В╨▓╨╡╤В ╤Д╨╛╤А╨╝╤Л (╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П ╨╜╨╡ ╨┐╤А╨╛╤И╨╗╨░):', json.content)
            throw new Error(prefix + ': ' + (extractFormError(json.content) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
          }
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          // ╨Ю╤В╨▓╨╡╤В ╨▓╨╛╨╛╨▒╤Й╨╡ ╨╜╨╡ JSON (╨╜╨░╨┐╤А. ╨│╨╛╨╗╤Л╨╣ HTML) тАФ ╨╡╤Б╨╗╨╕ ╨┐╨╛╤Е╨╛╨╢ ╨╜╨░ ╤Д╨╛╤А╨╝╤Г
          // ╤Б ╨╛╤И╨╕╨▒╨║╨░╨╝╨╕, ╤Н╤В╨╛ ╨╛╤И╨╕╨▒╨║╨░ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕, ╨╕╨╜╨░╤З╨╡ ╤Б╤З╨╕╤В╨░╨╡╨╝ ╤Г╤Б╨┐╨╡╤Е╨╛╨╝.
          if (/pkp_form|<form[\s>]/.test(text)) {
            if (formHasErrors(text)) {
              console.error('[OJS] ╨╛╤В╨▓╨╡╤В ╤Д╨╛╤А╨╝╤Л (╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П ╨╜╨╡ ╨┐╤А╨╛╤И╨╗╨░):', text)
              throw new Error(prefix + ': ' + (extractFormError(text) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
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

// ╨Я╨╛╤Б╤В╤А╨╛╨╕╤В╤М ╨┐╨╛╨╗╤П ╤Д╨╛╤А╨╝╤Л IssueForm ╨╕╨╖ ╨┤╨░╨╜╨╜╤Л╤Е ╨▓╤Л╨┐╤Г╤Б╨║╨░, ╨┐╨╛╨┤╤Б╤В╨░╨▓╨╗╤П╤П
// ╨а╨Х╨Р╨Ы╨м╨Э╨л╨Х ╨║╨╛╨┤╤Л ╨╗╨╛╨║╨░╨╗╨╡╨╣ ╨╢╤Г╤А╨╜╨░╨╗╨░ (╨╜╨░╨┐╤А. 'ru_RU', 'en_US', ╨░ ╨╜╨╡ ╨┐╤А╨╛╤Б╤В╨╛ 'ru'/'en').
// OJS ╤В╤А╨╡╨▒╤Г╨╡╤В ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╤П ╨╜╨░╨╖╨▓╨░╨╜╨╕╤П (title) ╨┤╨╗╤П ╨Ю╨б╨Э╨Ю╨Т╨Э╨Ю╨Щ ╨╗╨╛╨║╨░╨╗╨╕ ╨╢╤Г╤А╨╜╨░╨╗╨░, ╨╕
// ╨╕╨╝╨╡╨╜╨░ ╨┐╨╛╨╗╨╡╨╣ ╤Д╨╛╤А╨╝╤Л ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╤О╤В ╨╕╨╝╨╡╨╜╨╜╨╛ ╨║╨╛╨┤╤Л ╨╗╨╛╨║╨░╨╗╨╡╨╣ ╨╢╤Г╤А╨╜╨░╨╗╨░ (title[ru_RU]).
// ╨Х╤Б╨╗╨╕ ╤Б╨╗╨░╤В╤М title[ru] ╨┐╤А╨╕ ╨╛╤Б╨╜╨╛╨▓╨╜╨╛╨╣ ╨╗╨╛╨║╨░╨╗╨╕ ru_RU тАФ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П ╨┐╨░╨┤╨░╨╡╤В.
function issueFormFields(data, journal) {
  data = data || {}
  journal = journal || {}
  var supported = Array.isArray(journal.supportedFormLocales) && journal.supportedFormLocales.length
    ? journal.supportedFormLocales
    : (Array.isArray(journal.supportedLocales) && journal.supportedLocales.length ? journal.supportedLocales : ['ru'])
  var primary = journal.primaryLocale || supported[0] || 'ru'

  // ╨Э╨░╨╣╤В╨╕ ╨╗╨╛╨║╨░╨╗╤М ╨╢╤Г╤А╨╜╨░╨╗╨░, ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╤Г╤О╤Й╤Г╤О ┬л╤А╤Г╤Б╤Б╨║╨╛╨╝╤Г┬╗ ╨╕╨╗╨╕ ┬л╨░╨╜╨│╨╗╨╕╨╣╤Б╨║╨╛╨╝╤Г┬╗ ╨▓╨▓╨╛╨┤╤Г.
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

  // ╨У╨░╤А╨░╨╜╤В╨╕╤А╤Г╨╡╨╝, ╤З╤В╨╛ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡/╨╛╨┐╨╕╤Б╨░╨╜╨╕╨╡ ╨╜╨╡╨┐╤Г╤Б╤В╤Л╨╡ ╤Е╨╛╤В╤П ╨▒╤Л ╨▓ ╨╛╤Б╨╜╨╛╨▓╨╜╨╛╨╣ ╨╗╨╛╨║╨░╨╗╨╕.
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

  // OJS ╤В╤А╨╡╨▒╤Г╨╡╤В ╨┐╨╛╨╗╨╡ urlPath (╨Я╤Г╤В╤М URL тАФ ┬л╨Э╨╡╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╨╣ ╨┐╤Г╤В╤М ╨┤╨╗╤П
  // ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╤П ╨▓ URL ╨▓╨╝╨╡╤Б╤В╨╛ ID┬╗). ╨Х╤Б╨╗╨╕ ╨╜╨╡ ╨┐╨╡╤А╨╡╨┤╨░╤В╤М ╨╡╨│╨╛, ╤Д╨╛╤А╨╝╨░
  // ╨▓╤Л╨┐╤Г╤Б╨║╨░ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В╤Б╤П ╤Б ╨╛╤И╨╕╨▒╨║╨╛╨╣/╨┐╨╛╨▓╤В╨╛╤А╨╜╤Л╨╝ ╨┐╨╛╨║╨░╨╖╨╛╨╝. ╨У╨╡╨╜╨╡╤А╨╕╤А╤Г╨╡╨╝
  // ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╣ URL-╨▒╨╡╨╖╨╛╨┐╨░╤Б╨╜╤Л╨╣ slug ╨╕╨╖ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤П (╨╕╨╗╨╕ ╨╕╨╖ ╤В╨╛╨╝╨░/╨╜╨╛╨╝╨╡╤А╨░/
  // ╨│╨╛╨┤╨░), ╨╗╨╕╨▒╨╛ ╨╕╨╖ ╨┐╨╡╤А╨╡╨┤╨░╨╜╨╜╨╛╨│╨╛ data.urlPath/data.path.
  var rawPath = data.urlPath || data.path || ''
  var generatedPath = rawPath
    ? slugify(rawPath)
    : (slugify(primaryTitle) || slugify((data.volume || '') + '-' + (data.number || '') + '-' + (data.year || '')))
  if (!generatedPath) {
    generatedPath = 'issue-' + Date.now()
  }
  // ╨У╨░╤А╨░╨╜╤В╨╕╤А╤Г╨╡╨╝ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╨╛╤Б╤В╤М urlPath. OJS ╨╖╨░╨┐╤А╨╡╤Й╨░╨╡╤В ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В╤Л ╨┐╤Г╤В╨╕: ╨┐╤А╨╕
  // ╤Б╨╛╨▓╨┐╨░╨┤╨╡╨╜╨╕╨╕ ╨▓╤Л╨┐╤Г╤Б╨║ ╨Э╨Х ╤Б╨╛╨╖╨┤╨░╤С╤В╤Б╤П, ╨░ ╤Д╨╛╤А╨╝╨░ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В╤Б╤П ╤Б ╨╛╤И╨╕╨▒╨║╨╛╨╣
  // ┬л╨Я╤Г╤В╤М URL ╤Г╨╢╨╡ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В╤Б╤П┬╗. ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╣ ╤Б╤Г╤Д╤Д╨╕╨║╤Б ╨║
  // ╨░╨▓╤В╨╛╤Б╨│╨╡╨╜╨╡╤А╨╕╤А╨╛╨▓╨░╨╜╨╜╨╛╨╝╤Г ╨┐╤Г╤В╨╕, ╤З╤В╨╛╨▒╤Л ╨╕╤Б╨║╨╗╤О╤З╨╕╤В╤М ╨║╨╛╨╗╨╗╨╕╨╖╨╕╨╕ (╨╜╨░╨┐╤А╨╕╨╝╨╡╤А, ╨║╨╛╨│╨┤╨░
  // ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╤Б╨╛╨╖╨┤╨░╤С╤В ╨┤╨▓╨░ ╨▓╤Л╨┐╤Г╤Б╨║╨░ ╤Б ╨╛╨┤╨╕╨╜╨░╨║╨╛╨▓╤Л╨╝╨╕ ╤В╨╛╨╝╨╛╨╝/╨╜╨╛╨╝╨╡╤А╨╛╨╝/╨│╨╛╨┤╨╛╨╝).
  fields['urlPath'] = generatedPath + '-' + Date.now().toString(36)

  // OJS-╤Д╨╛╤А╨╝╨░ ╤Б╨╛╤Е╤А╨░╨╜╤П╨╡╤В ╨┤╨░╨╜╨╜╤Л╨╡ ╤В╨╛╨╗╤М╨║╨╛ ╨╡╤Б╨╗╨╕ ╨▓ POST-╤В╨╡╨╗╨╡ ╨┐╤А╨╕╤Б╤Г╤В╤Б╤В╨▓╤Г╨╡╤В
  // ╨╕╨╝╤П ╨║╨╜╨╛╨┐╨║╨╕ ╨╛╤В╨┐╤А╨░╨▓╨║╨╕ (submitFormButton). ╨С╨╡╨╖ ╨╜╨╡╨│╨╛ Form::isSubmitted()
  // ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В false, ╨╕ OJS ╨╗╨╕╤И╤М ╨┐╨╛╨▓╤В╨╛╤А╨╜╨╛ ╨╛╤В╤А╨╕╤Б╨╛╨▓╤Л╨▓╨░╨╡╤В ╤Д╨╛╤А╨╝╤Г, ╨Э╨Х ╤Б╨╛╤Е╤А╨░╨╜╤П╤П
  // ╨▓╤Л╨┐╤Г╤Б╨║ (╨▒╨╡╨╖ ╨║╨░╨║╨╛╨╣-╨╗╨╕╨▒╨╛ ╨╛╤И╨╕╨▒╨║╨╕). ╨Я╨╛╤Н╤В╨╛╨╝╤Г ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╨╛ ╤И╨╗╤С╨╝ ╨║╨╜╨╛╨┐╨║╤Г.
  fields['submitFormButton'] = '1'

  // title[<locale>] ╨┤╨╗╤П ╨║╨░╨╢╨┤╨╛╨╣ ╨┐╨╛╨┤╨┤╨╡╤А╨╢╨╕╨▓╨░╨╡╨╝╨╛╨╣ ╨╗╨╛╨║╨░╨╗╨╕.
  supported.forEach(function (loc) {
    var val = ''
    if (loc === ruLocale) val = userRuTitle || primaryTitle
    else if (loc === enLocale) val = userEnTitle || primaryTitle
    else val = primaryTitle // ╨╗╤О╨▒╨░╤П ╨┐╤А╨╛╤З╨░╤П ╨╗╨╛╨║╨░╨╗╤М ╨┐╨╛╨╗╤Г╤З╨░╨╡╤В ╨╛╤Б╨╜╨╛╨▓╨╜╨╛╨╡ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡
    fields['title[' + loc + ']'] = val
    fields['description[' + loc + ']'] = (loc === ruLocale ? (userRuDesc || primaryDesc)
      : (loc === enLocale ? (userEnDesc || primaryDesc) : primaryDesc))
  })

  // ╨б╤В╤А╨░╤Е╨╛╨▓╨║╨░: OJS ╨▓ ╤А╨░╨╖╨╜╤Л╤Е ╨▓╨╡╤А╤Б╨╕╤П╤Е/╨║╨╛╨╜╤Д╨╕╨│╤Г╤А╨░╤Ж╨╕╤П╤Е ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В ╨╗╨╕╨▒╨╛ ╨┐╨╛╨╗╨╜╤Л╨╡
  // ╨║╨╛╨┤╤Л ╨╗╨╛╨║╨░╨╗╨╡╨╣ (ru_RU, en_US), ╨╗╨╕╨▒╨╛ ╨║╨╛╤А╨╛╤В╨║╨╕╨╡ (ru, en). ╨з╤В╨╛╨▒╤Л ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П
  // ╨│╨░╤А╨░╨╜╤В╨╕╤А╨╛╨▓╨░╨╜╨╜╨╛ ╨╜╨░╤И╨╗╨░ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡/╨╛╨┐╨╕╤Б╨░╨╜╨╕╨╡ ╨▓ ╨╛╤Б╨╜╨╛╨▓╨╜╨╛╨╣ ╨╗╨╛╨║╨░╨╗╨╕ ╨╜╨╡╨╖╨░╨▓╨╕╤Б╨╕╨╝╨╛ ╨╛╤В
  // ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝╨╛╨│╨╛ ╨║╨╛╨┤╨░, ╨┤╤Г╨▒╨╗╨╕╤А╤Г╨╡╨╝ ╨╖╨╜╨░╤З╨╡╨╜╨╕╤П ╨╕ ╨┐╨╛╨┤ ╨║╨╛╤А╨╛╤В╨║╨╕╨╡ ╨║╨╛╨┤╤Л ╤В╨╛╨╢╨╡.
  fields['title[ru]'] = userRuTitle || primaryTitle
  fields['title[en]'] = userEnTitle || primaryTitle
  fields['description[ru]'] = userRuDesc || primaryDesc
  fields['description[en]'] = userEnDesc || primaryDesc

  return fields
}

// ╨Я╤А╨╛╨▓╨╡╤А╨╕╤В╤М, ╤З╤В╨╛ ╨▓╤Л╨┐╤Г╤Б╨║ ╤А╨╡╨░╨╗╤М╨╜╨╛ ╤Б╨╛╤Е╤А╨░╨╜╤С╨╜. ╨б╤А╨░╨▓╨╜╨╕╨▓╨░╨╡╨╝ ╤Б╨┐╨╕╤Б╨╛╨║ ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓ ╨Ф╨Ю
// ╨╕ ╨Я╨Ю╨б╨Ы╨Х ╨╛╤В╨┐╤А╨░╨▓╨║╨╕ ╤Д╨╛╤А╨╝╤Л: ╨╡╤Б╨╗╨╕ ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡ ╤Б╤В╨░╨╗╨╛ ╨╜╨░ ╨╛╨┤╨╕╨╜ ╨▒╨╛╨╗╤М╤И╨╡ (╨┐╨╛ ╨║╤А╨░╨╣╨╜╨╡╨╣
// ╨╝╨╡╤А╨╡) тАФ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡ ╨┐╤А╨╛╤И╨╗╨╛. ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╨╛, ╨╡╤Б╨╗╨╕ ╨▓ ╨╛╤В╨▓╨╡╤В╨╜╨╛╨╣ ╤Д╨╛╤А╨╝╨╡ ╨╡╤Б╤В╤М
// issueId, ╤Б╨▓╨╡╤А╤П╨╡╨╝ ╨╡╨│╨╛ ╨╜╨░╨╗╨╕╤З╨╕╨╡ ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡. ╨Х╤Б╨╗╨╕ ╨╜╨╕ ╨╛╨┤╨╜╨╛ ╤Г╤Б╨╗╨╛╨▓╨╕╨╡ ╨╜╨╡
// ╨▓╤Л╨┐╨╛╨╗╨╜╤П╨╡╤В╤Б╤П тАФ ╨▒╤А╨╛╤Б╨░╨╡╨╝ ╨┐╨╛╨╜╤П╤В╨╜╤Г╤О ╨╛╤И╨╕╨▒╨║╤Г ╨▓╨╝╨╡╤Б╤В╨╛ ╨╗╨╛╨╢╨╜╨╛╨│╨╛ ┬л╤Г╤Б╨┐╨╡╤Е╨░┬╗.
// ╨Э╨░╨┤╤С╨╢╨╜╨╛ ╨┐╤А╨╛╨▓╨╡╤А╨╕╤В╤М, ╤З╤В╨╛ ╨▓╤Л╨┐╤Г╤Б╨║ ╤А╨╡╨░╨╗╤М╨╜╨╛ ╤Б╨╛╤Е╤А╨░╨╜╤С╨╜. OJS ╨┐╤А╨╕ ╤Г╤Б╨┐╨╡╤Е╨╡
// ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╤В {"status":true,"content":""} тАФ ╨┐╤Г╤Б╤В╨╛╨╣ content ╨▒╨╡╨╖ issueId,
// ╨┐╨╛╤Н╤В╨╛╨╝╤Г ╨╜╨╡╨╗╤М╨╖╤П ╨┐╨╛╨╗╨░╨│╨░╤В╤М╤Б╤П ╤В╨╛╨╗╤М╨║╨╛ ╨╜╨░ issueId ╨╕╨╖ ╤Д╨╛╤А╨╝╤Л. ╨Ь╤Л ╤Б╨▓╨╡╤А╤П╨╡╨╝
// ╤Б╨┐╨╕╤Б╨╛╨║ ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓ ╨Ф╨Ю ╨╕ ╨Я╨Ю╨б╨Ы╨Х ╨╕ ╨╕╤Й╨╡╨╝ ╤Б╨╛╨╖╨┤╨░╨╜╨╜╤Л╨╣ ╨▓╤Л╨┐╤Г╤Б╨║ ╨┐╨╛ ID (╨╡╤Б╨╗╨╕ ╨╡╤Б╤В╤М ╨▓
// ╤Д╨╛╤А╨╝╨╡) ╨╕╨╗╨╕ ╨┐╨╛ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤О (╨╡╤Б╨╗╨╕ ╨╛╨╜╨╛ ╨┐╨╡╤А╨╡╨┤╨░╨╜╨╛). ╨в╨╛╨╗╤М╨║╨╛ ╨╡╤Б╨╗╨╕ ╨▓╤Л╨┐╤Г╤Б╨║
// ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤В╨╡╨╗╤М╨╜╨╛ ╨┐╨╛╤П╨▓╨╕╨╗╤Б╤П ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡ тАФ ╤Б╤З╨╕╤В╨░╨╡╨╝ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╤Л╨╝. ╨Ш╨╜╨░╤З╨╡
// (╨┤╨░╨╢╨╡ ╨┐╤А╨╕ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╨╕ ╤П╨▓╨╜╨╛╨╣ ╨╛╤И╨╕╨▒╨║╨╕ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕) ╨▓╤Л╨▒╤А╨░╤Б╤Л╨▓╨░╨╡╨╝ ╨┐╨╛╨╜╤П╤В╨╜╤Г╤О
// ╨╛╤И╨╕╨▒╨║╤Г ╨▓╨╝╨╡╤Б╤В╨╛ ╨Ы╨Ю╨Ц╨Э╨Ю╨У╨Ю ╤Г╤Б╨┐╨╡╤Е╨░.
function verifyIssueSaved(operationLabel, issuesBefore, componentText, expectedTitle, opts) {
  // ╨а╨╡╨░╨╗╤М╨╜╨░╤П ╨╛╤И╨╕╨▒╨║╨░ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕ ╨▓ ╨╛╤В╨▓╨╡╤В╨╡ (╨╜╨░╨┐╤А. urlPath ┬л╤Г╨╢╨╡ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╤В╤Б╤П┬╗)?
  if (formHasErrors(componentText || '')) {
    throw new Error(operationLabel + ': ' + (extractFormError(componentText) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
  }
  opts = opts || {}
  // ╨Я╤А╨╕ ╨Ю╨С╨Э╨Ю╨Т╨Ы╨Х╨Э╨Ш╨Ш ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╡╨│╨╛ ╨▓╤Л╨┐╤Г╤Б╨║╨░ ╨╛╨╜ ╤Г╨╢╨╡ ╨╡╤Б╤В╤М ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡, ╨┐╨╛╤Н╤В╨╛╨╝╤Г
  // ╤З╨╕╤Б╨╗╨╛ ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓ ╨╜╨╡ ╤А╨░╤Б╤В╤С╤В ╨╕ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨╜╨╡ ╨╝╨╡╨╜╤П╨╡╤В╤Б╤П тАФ ╤Б╤В╨░╤А╤Л╨╡ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕
  // (╤А╨╛╤Б╤В ╤Б╨┐╨╕╤Б╨║╨░ / ╨╜╨╛╨▓╨╛╨╡ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡ / issueId ╨▓ ╤Д╨╛╤А╨╝╨╡) ╨╜╨╡ ╤Б╤А╨░╨▒╨░╤В╤Л╨▓╨░╤О╤В ╨╕
  // ╨╗╨╛╨╢╨╜╨╛ ╤Б╨╛╨╛╨▒╤Й╨░╤О╤В ╨╛╨▒ ╨╛╤И╨╕╨▒╨║╨╡ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╤П. ╨Т╨╝╨╡╤Б╤В╨╛ ╤Н╤В╨╛╨│╨╛ ╨┐╨╡╤А╨╡╨╖╨░╨┐╤А╨░╤И╨╕╨▓╨░╨╡╨╝
  // ╤Б╨░╨╝ ╨▓╤Л╨┐╤Г╤Б╨║ ╨╕ ╤Б╨▓╨╡╤А╤П╨╡╨╝ ╤Б╨╛╤Е╤А╨░╨╜╤С╨╜╨╜╤Л╨╡ ╨┐╨╛╨╗╤П.
  if (opts.isUpdate && opts.issueId) {
    return getIssueDetail(opts.issueId)
      .then(function (issue) {
        if (!issue) {
          throw new Error(operationLabel + ': ╨╜╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨┐╨╛╨┤╤В╨▓╨╡╤А╨┤╨╕╤В╤М ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡ ╨▓╤Л╨┐╤Г╤Б╨║╨░')
        }
        var exp = opts.expected || {}
        var mismatches = []
        function check(field, val) {
          if (val === undefined || val === null || val === '') return
          if (String(issue[field]) !== String(val)) {
            mismatches.push(field + ' (╨╛╨╢╨╕╨┤╨░╨╗╨╛╤Б╤М ' + val + ', ╨╡╤Б╤В╤М ' + issue[field] + ')')
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
          console.warn('[OJS] ╨╜╨╡ ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╤Л ╨┐╨╛╨╗╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░:', mismatches.join(', '))
        }
        return { id: issue.id }
      })
      .catch(function (err) {
        // ╨Х╤Б╨╗╨╕ ╨╜╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨┐╤А╨╛╨▓╨╡╤А╨╕╤В╤М ╨┤╨╡╤В╨░╨╗╤М╨╜╨╛ (╨╜╨╛ ╨║╨╛╨╝╨┐╨╛╨╜╨╡╨╜╤В ╨▓╨╡╤А╨╜╤Г╨╗ ╤Г╤Б╨┐╨╡╤Е ╨▒╨╡╨╖
        // ╨╛╤И╨╕╨▒╨╛╨║ ╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╨╕) тАФ ╤Б╤З╨╕╤В╨░╨╡╨╝ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╤Л╨╝.
        if (err && err.message && /╨╜╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨┐╨╛╨┤╤В╨▓╨╡╤А╨┤╨╕╤В╤М/.test(err.message)) throw err
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
      // 1) issueId ╨╕╨╖ ╤Д╨╛╤А╨╝╤Л ╤В╨╛╤З╨╜╨╛ ╨┐╤А╨╕╤Б╤Г╤В╤Б╤В╨▓╤Г╨╡╤В ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡.
      var issueId = extractIssueIdFromForm(componentText)
      if (issueId && after.some(function (it) {
        return String(it.id) === String(issueId)
      })) {
        return { id: issueId }
      }
      // 2) ╨╕╤Й╨╡╨╝ ╨▓╤Л╨┐╤Г╤Б╨║ ╨┐╨╛ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤О ╤Б╤А╨╡╨┤╨╕ ╤В╨╡╤Е, ╤З╤В╨╛ ╨╜╨╡ ╨▒╤Л╨╗╨╕ ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡ ╨Ф╨Ю.
      if (expectedTitle) {
        var et = String(expectedTitle).trim().toLowerCase()
        var found = after.filter(function (it) {
          var t = it.title || {}
          var title = (t.ru || t.en || '').toLowerCase()
          return title === et && beforeTitles.indexOf(title) === -1
        })
        if (found.length) return { id: found[0].id }
      }
      // 3) ╨▓╤Л╤А╨╛╤Б╨╗╨╛ ╨╗╨╕ ╨╛╨▒╤Й╨╡╨╡ ╤З╨╕╤Б╨╗╨╛ ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓.
      if (after.length > (issuesBefore || []).length) {
        var last = after[after.length - 1]
        return { id: last ? last.id : null }
      }
      // ╨Т╤Л╨┐╤Г╤Б╨║ ╤А╨╡╨░╨╗╤М╨╜╨╛ ╨╜╨╡ ╤Б╨╛╨╖╨┤╨░╨╜ тАФ ╤Б╨╛╨╛╨▒╤Й╨░╨╡╨╝ ╨╛╨▒ ╤Н╤В╨╛╨╝ ╤П╨▓╨╜╨╛, ╨▒╨╡╨╖ ╨╗╨╛╨╢╨╜╨╛╨│╨╛ ╤Г╤Б╨┐╨╡╤Е╨░.
      throw new Error(operationLabel + ': ╨▓╤Л╨┐╤Г╤Б╨║ ╨╜╨╡ ╨▒╤Л╨╗ ╤Б╨╛╤Е╤А╨░╨╜╤С╨╜ (╨▓ ╤Б╨┐╨╕╤Б╨║╨╡ ╨╜╨╡╤В ╨╜╨╛╨▓╤Л╤Е ╨▓╤Л╨┐╤Г╤Б╨║╨╛╨▓). ' +
        '╨г╨▒╨╡╨┤╨╕╤В╨╡╤Б╤М, ╤З╤В╨╛ ╨▓╤Л ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜╤Л, ╨╕ ╤З╤В╨╛ ╨▓╤Л╨┐╤Г╤Б╨║ ╤Б ╤В╨░╨║╨╕╨╝ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡╨╝/╨Я╤Г╤В╤С╨╝ URL ╨╡╤Й╤С ╨╜╨╡ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╨╡╤В.')
    })
}

// ╨б╨╛╨╖╨┤╨░╤В╤М ╨╜╨╛╨▓╤Л╨╣ ╨▓╤Л╨┐╤Г╤Б╨║ (╤З╨╡╤А╨╡╨╖ IssueForm::execute, issueId ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╤Г╨╡╤В).
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
      // ╨б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╤В╨╡╨║╤Б╤В ╨╛╤В╨▓╨╡╤В╨░, ╤З╤В╨╛╨▒╤Л ╨╕╨╖╨▓╨╗╨╡╤З╤М issueId ╨╕ ╨┐╤А╨╛╨▓╨╡╤А╨╕╤В╤М ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡.
      return response.text().then(function (text) {
        componentText = text
        try {
          var json = JSON.parse(text)
          if (json && json.status === false) {
            throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░: ' + ((json.content && json.content.replace(/<[^>]+>/g, ' ').trim()) || json.errorMessage || '╨╜╨╡╨╕╨╖╨▓╨╡╤Б╤В╨╜╨░╤П ╨╛╤И╨╕╨▒╨║╨░'))
          }
          if (json && json.status === true && json.content && /pkp_form|<form[\s>]/.test(json.content)) {
            if (formHasErrors(json.content)) {
              console.error('[OJS] ╨╛╤В╨▓╨╡╤В ╤Д╨╛╤А╨╝╤Л (╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П ╨╜╨╡ ╨┐╤А╨╛╤И╨╗╨░):', json.content)
              throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░: ' + (extractFormError(json.content) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            if (/pkp_form|<form[\s>]/.test(text) && formHasErrors(text)) {
              throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░: ' + (extractFormError(text) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
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
      return verifyIssueSaved('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░', issuesBefore, componentText, expectedTitle)
    })
}

// ╨Ю╨▒╨╜╨╛╨▓╨╕╤В╤М ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╨╣ ╨▓╤Л╨┐╤Г╤Б╨║.
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
            throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░: ' + ((json.content && json.content.replace(/<[^>]+>/g, ' ').trim()) || json.errorMessage || '╨╜╨╡╨╕╨╖╨▓╨╡╤Б╤В╨╜╨░╤П ╨╛╤И╨╕╨▒╨║╨░'))
          }
          if (json && json.status === true && json.content && /pkp_form|<form[\s>]/.test(json.content)) {
            if (formHasErrors(json.content)) {
              console.error('[OJS] ╨╛╤В╨▓╨╡╤В ╤Д╨╛╤А╨╝╤Л (╨▓╨░╨╗╨╕╨┤╨░╤Ж╨╕╤П ╨╜╨╡ ╨┐╤А╨╛╤И╨╗╨░):', json.content)
              throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░: ' + (extractFormError(json.content) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            if (/pkp_form|<form[\s>]/.test(text) && formHasErrors(text)) {
              throw new Error('╨Ю╤И╨╕╨▒╨║╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░: ' + (extractFormError(text) || '╨┐╤А╨╛╨▓╨╡╤А╤М╤В╨╡ ╨╖╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╨╛╨╗╨╡╨╣'))
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
      return verifyIssueSaved('╨Ю╤И╨╕╨▒╨║╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░', issuesBefore, componentText, expectedTitle, {
        isUpdate: true,
        issueId: id,
        expected: data || {}
      })
    })
}

// ╨Ю╨┐╤Г╨▒╨╗╨╕╨║╨╛╨▓╨░╤В╤М ╨▓╤Л╨┐╤Г╤Б╨║.
// ╨Э╨Х╨Ю╨Я╨г╨С╨Ы╨Ш╨Ъ╨Ю╨Т╨Р╨Э╨Э╨л╨Щ ╨▓╤Л╨┐╤Г╤Б╨║ ╨┐╤Г╨▒╨╗╨╕╨║╤Г╨╡╤В╤Б╤П ╤З╨╡╤А╨╡╨╖ FutureIssueGridHandler
// (grid 'future-issue-grid'), ╨║╨░╨║ ╤Н╤В╨╛ ╨┤╨╡╨╗╨░╨╡╤В ╤И╤В╨░╤В╨╜╤Л╨╣ UI OJS (╤Д╨╛╤А╨╝╨░
// assignPublicIdentifiersForm.tpl ╤И╨╗╤С╤В ╨╖╨░╨┐╤А╨╛╤Б ╨╕╨╝╨╡╨╜╨╜╨╛ ╨╜╨░
// grid.issues.FutureIssueGridHandler?op=publishIssue). ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╡
// 'issue-grid' (BackIssueGridHandler) ╨┤╨╗╤П ╨╜╨╡╨╛╨┐╤Г╨▒╨╗╨╕╨║╨╛╨▓╨░╨╜╨╜╨╛╨│╨╛ ╨▓╤Л╨┐╤Г╤Б╨║╨░
// ╨┐╤А╨╕╨▓╨╛╨┤╨╕╤В ╨║ 500-╨╣ ╨╛╤И╨╕╨▒╨║╨╡ ╨╜╨░ ╤Б╨╡╤А╨▓╨╡╤А╨╡.
// ╨д╨╛╤А╨╝╨░ ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╕╤П ╤Б╨╛╨┤╨╡╤А╨╢╨╕╤В ╨┐╨╛╨╗╤П: issueId, confirmed=1,
// sendIssueNotification (╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О ╨▓╨║╨╗╤О╤З╤С╨╜), csrfToken.
export function publishIssue(id) {
  return callIssueComponent('future-issue-grid/publish-issue', id, null, {
    confirmed: 1,
    sendIssueNotification: 0
  })
    .then(handleComponentResponse('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ ╨▓╤Л╨┐╤Г╤Б╨║╨░'))
}

// ╨б╨╜╤П╤В╤М ╨▓╤Л╨┐╤Г╤Б╨║ ╤Б ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕ (BackIssueGridHandler::unpublishIssue).
export function unpublishIssue(id) {
  return callIssueComponent('back-issue-grid/unpublish-issue', id, null)
    .then(handleComponentResponse('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╜╤П╤В╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░ ╤Б ╨┐╤Г╨▒╨╗╨╕╨║╨░╤Ж╨╕╨╕'))
}

// ╨г╨┤╨░╨╗╨╕╤В╤М ╨▓╤Л╨┐╤Г╤Б╨║ (IssueGridHandler::deleteIssue).
// ╨Т╤Л╨▒╨╛╤А grid-╨╛╨▒╤А╨░╨▒╨╛╤В╤З╨╕╨║╨░ ╨╖╨░╨▓╨╕╤Б╨╕╤В ╨╛╤В ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╤П ╨▓╤Л╨┐╤Г╤Б╨║╨░:
//   - ╨╜╨╡╨╛╨┐╤Г╨▒╨╗╨╕╨║╨╛╨▓╨░╨╜╨╜╤Л╨╣ (┬л╨▒╤Г╨┤╤Г╤Й╨╕╨╣┬╗) ╨▓╤Л╨┐╤Г╤Б╨║ ╤Г╨┤╨░╨╗╤П╨╡╤В╤Б╤П ╤З╨╡╤А╨╡╨╖ FutureIssueGridHandler
//     (grid 'future-issue-grid'), ╨║╨░╨║ ╤Н╤В╨╛ ╨┤╨╡╨╗╨░╨╡╤В ╤И╤В╨░╤В╨╜╤Л╨╣ UI OJS;
//   - ╨╛╨┐╤Г╨▒╨╗╨╕╨║╨╛╨▓╨░╨╜╨╜╤Л╨╣ ╨▓╤Л╨┐╤Г╤Б╨║ тАФ ╤З╨╡╤А╨╡╨╖ BackIssueGridHandler (grid 'back-issue-grid').
// ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╨╡ ╨╜╨╡╨┐╨╛╨┤╤Е╨╛╨┤╤П╤Й╨╡╨│╨╛ grid-╨┐╤А╨╛╤Б╤В╤А╨░╨╜╤Б╤В╨▓╨░ (╨╜╨░╨┐╤А. back-issue-grid ╨┤╨╗╤П
// ╨▒╤Г╨┤╤Г╤Й╨╡╨│╨╛ ╨▓╤Л╨┐╤Г╤Б╨║╨░) ╨┐╤А╨╕╨▓╨╛╨┤╨╕╤В ╨║ 500-╨╣ ╨╛╤И╨╕╨▒╨║╨╡ ╨╜╨░ ╤Б╨╡╤А╨▓╨╡╤А╨╡.
export function deleteIssue(id, published) {
  var gridOp = published ? 'back-issue-grid/delete-issue' : 'future-issue-grid/delete-issue'
  return callIssueComponent(gridOp, id, null)
    .then(handleComponentResponse('Ошибка удаления выпуска'))
}

// ========================================
// REST API для управления пользователями
// (использует API-ключ, не требует сессии)
// ========================================

var OJS_API_KEY = import.meta.env.VITE_OJS_API_KEY || ''
var REQUEST_TIMEOUT = 30000

function buildApiUrl(endpoint) {
  return API_BASE + endpoint
}

function fetchWithTimeout(url, options, timeout) {
  options = options || {}
  timeout = timeout || REQUEST_TIMEOUT
  var controller = new AbortController()
  var timeoutId = setTimeout(function () { controller.abort() }, timeout)
  return fetch(url, Object.assign({}, options, { signal: controller.signal }))
    .then(function (res) {
      clearTimeout(timeoutId)
      return res
    })
    .catch(function (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error('Превышено время ожидания ответа от сервера')
      }
      throw err
    })
}

function safeJson(res) {
  return res.json().catch(function () { return {} })
}

export var ojsApi = {
  loginOjs: function (username, password) {
    if (username === (import.meta.env.VITE_OJS_ADMIN || 'ojs') &&
        password === (import.meta.env.VITE_OJS_ADMIN_PASSWORD || '')) {
      return Promise.resolve({ success: true })
    }
    return Promise.reject(new Error('Неверный логин или пароль'))
  },

  getUsersDirect: function (params) {
    params = params || {}
    var query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.count) query.set('count', String(params.count))
    if (params.offset) query.set('offset', String(params.offset))
    var qs = query.toString()
    var url = buildApiUrl('/api/v1/users' + (qs ? '?' + qs : ''))
    return fetchWithTimeout(url, {
      headers: {
        'Authorization': 'Bearer ' + OJS_API_KEY,
        'Accept': 'application/json'
      }
    }).then(function (res) {
      if (res.status >= 200 && res.status < 400) {
        return res.json()
      }
      return res.json().then(function (err) {
        throw new Error((err && err.error && err.error.message) || (err && err.message) || 'Ошибка загрузки пользователей')
      })
    })
  },

  getUserGroupsMap: function () {
    return ojsApi.getUsersDirect({ count: 100 })
      .then(function (response) {
        var items = Array.isArray(response && response.items) ? response.items : []
        var groupsMap = {}
        var seenGroupIds = {}
        var defaultNames = {
          1: 'Администратор', 2: 'Менеджер', 16: 'Редактор', 17: 'Главный редактор',
          25: 'Автор', 26: 'Рецензент', 27: 'Секретарь'
        }
        items.forEach(function (u) {
          var groups = Array.isArray(u.groups) ? u.groups : []
          groups.forEach(function (group) {
            var groupId = group.id
            if (!groupId || seenGroupIds[groupId]) return
            seenGroupIds[groupId] = true
            if (group.name) {
              var name = typeof group.name === 'object'
                ? (group.name.ru || group.name.en || group.name[Object.keys(group.name)[0]] || '')
                : group.name
              if (name) { groupsMap[groupId] = name; return }
            }
            groupsMap[groupId] = defaultNames[groupId] || ('Группа ' + groupId)
          })
        })
        return groupsMap
      })
  },

  createUser: function (user) {
    return fetchWithTimeout(buildApiUrl('/api/v1/user-management/users/create'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OJS_API_KEY
      },
      body: JSON.stringify(user)
    }).then(function (res) {
      if (!res.ok) {
        return safeJson(res).then(function (err) {
          var msg = typeof err.error === 'string' ? err.error : ((err.error && err.error.message) || err.message)
          throw new Error(msg || 'Ошибка создания пользователя')
        })
      }
      return res.json()
    })
  },

  updateUser: function (id, user) {
    return fetchWithTimeout(buildApiUrl('/api/v1/user-management/users/' + id + '/update'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OJS_API_KEY
      },
      body: JSON.stringify(user)
    }).then(function (res) {
      if (!res.ok) {
        return safeJson(res).then(function (err) {
          var msg = typeof err.error === 'string' ? err.error : ((err.error && err.error.message) || err.message)
          throw new Error(msg || 'Ошибка обновления пользователя')
        })
      }
      return res.json()
    })
  },

  deleteUser: function (id) {
    return fetchWithTimeout(buildApiUrl('/api/v1/user-management/users/' + id + '/delete'), {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + OJS_API_KEY }
    }).then(function (res) {
      if (!res.ok) {
        return safeJson(res).then(function (err) {
          var msg = typeof err.error === 'string' ? err.error : ((err.error && err.error.message) || err.message)
          throw new Error(msg || 'Ошибка удаления пользователя')
        })
      }
      return res.json()
    })
  }
}

export default ojsApi
