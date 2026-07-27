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

// Ключ для localStorage
export var SESSION_KEY = 'kryashen-session'

// Жанры (типы) файлов submission в OJS для журнала (context_id = 1).
// Список зафиксирован статически на основе дампа таблиц `genres` /
// `genre_settings` (см. .clinerules/AGENTS.md), т.к. публичный REST API
// не предоставляет отдельного эндпоинта для получения списка жанров.
// genre_id = 1 (entry_key = 'SUBMISSION', required = 1) — жанр по
// умолчанию для основного текста статьи (PDF), используется как
// DEFAULT_GENRE_ID при загрузке файлов.
export var GENRES = [
  { id: 1, entryKey: 'SUBMISSION', labelRu: 'Текст статьи', labelEn: 'Article Text' },
  { id: 2, entryKey: 'RESEARCHINSTRUMENT', labelRu: 'Инструмент исследования', labelEn: 'Research Instrument' },
  { id: 3, entryKey: 'RESEARCHMATERIALS', labelRu: 'Материалы исследования', labelEn: 'Research Materials' },
  { id: 4, entryKey: 'RESEARCHRESULTS', labelRu: 'Результаты исследования', labelEn: 'Research Results' },
  { id: 5, entryKey: 'TRANSCRIPTS', labelRu: 'Транскрипты', labelEn: 'Transcripts' },
  { id: 6, entryKey: 'DATAANALYSIS', labelRu: 'Анализ данных', labelEn: 'Data Analysis' },
  { id: 7, entryKey: 'DATASET', labelRu: 'Набор данных', labelEn: 'Data Set' },
  { id: 8, entryKey: 'SOURCETEXTS', labelRu: 'Исходные тексты', labelEn: 'Source Texts' },
  { id: 9, entryKey: 'MULTIMEDIA', labelRu: 'Мультимедиа', labelEn: 'Multimedia' },
  { id: 10, entryKey: 'IMAGE', labelRu: 'Изображение', labelEn: 'Image' },
  { id: 11, entryKey: 'STYLE', labelRu: 'Таблица стилей HTML', labelEn: 'HTML Stylesheet' },
  { id: 12, entryKey: 'OTHER', labelRu: 'Другое', labelEn: 'Other' }
]

// Жанр по умолчанию для основного текста статьи (PDF).
export var DEFAULT_GENRE_ID = 1


