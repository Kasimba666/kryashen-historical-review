/**
 * Константы приложения
 */

// OJS роли
export var ROLES = {
  JOURNAL_MANAGER: 16,
  EDITOR: 17,
  REVIEWER: 4096,
  AUTHOR: 65536,
  READER: 1048576,
  SUBSCRIPTION_MANAGER: 2097152
}

// Время жизни сессии (24 часа)
export var SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000

// Время кэширования списка пользователей (5 минут)
export var USERS_CACHE_DURATION = 5 * 60 * 1000

// Таймаут для HTTP запросов (10 секунд)
export var REQUEST_TIMEOUT = 10000

// Ключ для localStorage
export var SESSION_KEY = 'kryashen-session'