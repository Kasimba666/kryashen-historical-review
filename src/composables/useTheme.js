var THEME_KEY = 'kryashen-theme'

/**
 * Composable для управления светлой/тёмной темой
 * Сохраняет выбор в localStorage
 */
export function useTheme() {
  /**
   * Получить текущую тему
   */
  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light'
  }

  /**
   * Применить тему к документу
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }

  /**
   * Переключить тему
   */
  function toggleTheme() {
    var current = getTheme()
    var next = current === 'light' ? 'dark' : 'light'
    applyTheme(next)
    return next
  }

  /**
   * Инициализировать тему при загрузке
   */
  function initTheme() {
    var theme = getTheme()
    applyTheme(theme)
    return theme
  }

  return {
    getTheme: getTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    initTheme: initTheme
  }
}