import { useRouter } from 'vue-router'
import { useAuth } from './useAuth'
import { ROLES } from '@/config/constants'

/**
 * Composable для защиты маршрутов
 * Использовать в router.beforeEach
 */
export function useAuthorization() {
  var router = useRouter()
  var auth = useAuth()

  /**
   * Проверить, имеет ли пользователь доступ к маршруту
   * Возвращает true если доступ разрешён, иначе redirect
   */
  function checkAccess(to) {
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

    return true
  }

  return {
    checkAccess: checkAccess
  }
}

/**
 * Middleware для авторизации
 * Использовать в router/index.js:
 * router.beforeEach(useAuthorization().checkAccess)
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

  return true
}