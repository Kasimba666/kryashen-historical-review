import { useAuth } from './useAuth'

/**
 * Middleware для авторизации
 * Использовать в router/index.js:
 * router.beforeEach(authMiddleware)
 */
export function authMiddleware(to) {
  var auth = useAuth()
  var isAuthenticated = auth.isAuthenticated()

  // Если маршрут требует авторизации
  if (to.meta && to.meta.requiresAuth && !isAuthenticated) {
    return '/login'
  }

  // Если пользователь авторизован и пытается зайти на страницу логина
  if (to.path === '/login' && isAuthenticated) {
    return '/'
  }

  // Проверка ролей (если указаны в meta.roles)
  if (to.meta && to.meta.roles && to.meta.roles.length > 0) {
    var hasRequiredRole = to.meta.roles.some(function (roleId) {
      return auth.hasRole(roleId)
    })
    if (!hasRequiredRole) {
      return '/'
    }
  }

  // Страница только для администратора сайта (аккаунт «ojs»)
  if (to.meta && to.meta.siteAdminOnly && !auth.isSiteAdmin()) {
    return '/'
  }

  return true
}
