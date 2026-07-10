import { SESSION_KEY, SESSION_EXPIRY_MS } from '@/config/constants'

/**
 * Composable для управления сессией пользователя OJS
 *
 * Хранит в localStorage информацию о текущем пользователе:
 * {
 *   username: string,
 *   fullName: string,
 *   email: string,
 *   preferredPublicName: { ru, en },
 *   groups: [{ id, name, abbrev, roleId }],
 *   expiresAt: number (timestamp)
 *   sessionId: string (опционально, для валидации)
 * }
 *
 * Роли (roleId) из OJS:
 *   16 — Journal Manager (управляющий журналом)
 *   17 — Editor (редактор)
 *   4096 — Reviewer (рецензент)
 *   65536 — Author (автор)
 *   1048576 — Reader (читатель)
 *   2097152 — Subscription Manager
 *
 * Администратор сайта (site admin) — это служебный аккаунт OJS
 * с логином «ojs», которому нельзя назначать роли через интерфейс.
 */


export function useAuth() {
  /**
   * Получить сохранённую сессию
   */
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      var session = JSON.parse(raw)
      
      // Проверяем срок действия сессии
      if (session.expiresAt && Date.now() > session.expiresAt) {
        logout()
        return null
      }
      
      return session
    } catch (e) {
      return null
    }
  }

  /**
   * Сохранить сессию
   */
  function setSession(user) {
    var session = Object.assign({}, user, {
      expiresAt: Date.now() + SESSION_EXPIRY_MS
    })
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }

  /**
   * Проверить, авторизован ли пользователь
   */
  function isAuthenticated() {
    return getSession() !== null
  }

  /**
   * Выполнить вход (сохранить данные пользователя)
   */
  function login(user) {
    setSession(user)
  }

  /**
   * Выполнить выход (удалить сессию)
   */
  function logout() {
    localStorage.removeItem(SESSION_KEY)
  }

  /**
   * Проверить, есть ли у пользователя определённая роль
   */
  function hasRole(roleId) {
    var session = getSession()
    if (!session || !session.groups) return false
    return session.groups.some(function (g) {
      return g.roleId === roleId
    })
  }

  /**
   * Проверить, является ли пользователь администратором журнала
   * (Journal Manager = roleId 16)
   */
  function isAdmin() {
    return hasRole(16)
  }

  /**
   * Проверить, является ли пользователь администратором сайта
   * (служебный аккаунт OJS с логином «ojs»)
   */
  function isSiteAdmin() {
    var session = getSession()
    return !!session && session.username === 'ojs'
  }

  /**
   * Получить отображаемое имя пользователя
   */
  function getDisplayName() {
    var session = getSession()
    if (!session) return ''

    // Пытаемся показать предпочитаемое публичное имя
    if (session.preferredPublicName) {
      if (session.preferredPublicName.ru) return session.preferredPublicName.ru
      if (session.preferredPublicName.en) return session.preferredPublicName.en
    }

    return session.fullName || session.username || ''
  }

  /**
   * Получить список ролей для отображения
   */
  function getRoleNames() {
    var session = getSession()
    if (!session || !session.groups) return []
    return session.groups.map(function (g) {
      return {
        id: g.id,
        name: g.name,
        abbrev: g.abbrev,
        roleId: g.roleId
      }
    })
  }

  /**
   * Получить username
   */
  function getUsername() {
    var session = getSession()
    return session ? session.username : ''
  }

  return {
    getSession: getSession,
    isAuthenticated: isAuthenticated,
    login: login,
    logout: logout,
    hasRole: hasRole,
    isAdmin: isAdmin,
    isSiteAdmin: isSiteAdmin,
    getDisplayName: getDisplayName,
    getRoleNames: getRoleNames,
    getUsername: getUsername
  }
}