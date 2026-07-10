<template>
  <div class="issue-detail-page">
    <el-button class="back-button" text @click="goBack">
      <el-icon><ArrowLeft /></el-icon>
      Назад к выпускам
    </el-button>

    <el-skeleton :loading="loading" animated :count="5">
      <template #default>
        <el-card v-if="issue" class="issue-detail-card">
          <div class="issue-detail-header">
            <div v-if="issue.coverImageUrl && issue.coverImageUrl.length > 0" class="issue-detail-cover">
              <el-image :src="issue.coverImageUrl[0]" fit="contain" />
            </div>
            <div class="issue-detail-info">
              <h1 class="issue-detail-title">{{ issueTitle }}</h1>
              <p v-if="issueDescription" class="issue-detail-description" v-html="issueDescription"></p>
              <div class="issue-detail-meta">
                <el-tag v-if="issue.volume" type="info">Том {{ issue.volume }}</el-tag>
                <el-tag v-if="issue.number" type="info">№ {{ issue.number }}</el-tag>
                <el-tag v-if="issue.year" type="info">{{ issue.year }}</el-tag>
                <el-tag v-if="issue.published" type="success">Опубликован</el-tag>
                <el-tag v-if="!issue.published" type="warning">Черновик</el-tag>
              </div>
              <p v-if="issue.identification" class="issue-identification">{{ issue.identification }}</p>
            </div>
          </div>
        </el-card>

        <!-- Галереи (PDF) -->
        <div v-if="issue && issue.galleys && issue.galleys.length > 0" class="galleys-section">
          <h2 class="section-title">Файлы выпуска</h2>
          <el-card
            v-for="galley in issue.galleys"
            :key="galley.fileId"
            class="galley-card"
            shadow="hover"
            @click="openGalley(galley)"
          >
            <div class="galley-content">
              <el-icon :size="24"><Document /></el-icon>
              <div class="galley-info">
                <span class="galley-label">{{ galley.label }}</span>
                <span v-if="galley.locale" class="galley-locale">{{ galley.locale }}</span>
              </div>
              <el-icon class="galley-arrow"><Download /></el-icon>
            </div>
          </el-card>
        </div>

        <!-- Статьи выпуска -->
        <div class="articles-section">
          <div class="section-header">
            <h2 class="section-title">Статьи выпуска</h2>
            <div v-if="canManageArticles" class="section-actions">
              <el-button type="primary" size="small" @click="openCreateArticleDialog">
                <el-icon><Plus /></el-icon>
                Создать статью
              </el-button>
              <el-button size="small" @click="openAddArticleDialog">
                Добавить из материалов
              </el-button>
            </div>
          </div>

          <el-empty v-if="!articles || articles.length === 0" description="Статьи не добавлены" />

          <el-card
            v-for="article in articles"
            :key="article.id"
            class="article-card"
            shadow="hover"
          >
            <div class="article-info">
              <p class="article-title-authors">
                <span v-if="article.titleRu" class="article-title">{{ article.titleRu }}</span><span v-if="article.titleRu && article.titleEn" class="article-title-sep"> / </span><span v-if="article.titleEn" class="article-title-en">{{ article.titleEn }}</span><span v-if="article.authors" class="article-authors"> — {{ article.authors }}</span>
              </p>
              <p v-if="article.sectionTitle" class="article-section">
                <el-tag size="small" type="info">{{ article.sectionTitle }}</el-tag>
              </p>
              <p v-if="article.abstract && getLocalized(article.abstract)" class="article-abstract">
                {{ getLocalized(article.abstract) }}
              </p>
              <p v-if="article.keywords && article.keywords.length" class="article-keywords">
                <span class="keyword-label">Ключевые слова: </span>
                <span v-for="kw in article.keywords" :key="kw" class="keyword-chip">{{ kw }}</span>
              </p>
              <div class="article-meta-row">
                <span v-if="article.pages" class="article-pages">Стр. {{ article.pages }}</span>
                <el-link
                  v-if="article.galley"
                  type="primary"
                  class="article-galley-link"
                  :href="article.galley.urlPublished || article.galley.urlRemote"
                  target="_blank"
                >
                  <el-icon><Document /></el-icon> PDF
                </el-link>
              </div>
              <div v-if="article.status" class="article-status">
                <el-tag size="small" :type="getArticleStatusType(article.status)">
                  {{ getArticleStatusLabel(article.status) }}
                </el-tag>
              </div>
            </div>
            <div v-if="canManageArticles && !issue.published" class="article-actions" @click.stop>
              <el-button
                size="small"
                @click="openEditArticleDialog(article)"
                title="Редактировать"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="confirmRemoveArticle(article)"
                title="Удалить из выпуска"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </el-card>
        </div>
      </template>
    </el-skeleton>

    <!-- Диалог добавления статьи в выпуск -->
    <el-dialog v-model="addArticleDialogVisible" title="Добавить статью в выпуск" width="600px">
      <el-skeleton :loading="loadingSubmissions" animated :count="5">
        <template #default>
          <el-table :data="availableSubmissions" stripe style="width: 100%" max-height="400">
            <el-table-column label="Название (RU/EN) и авторы">
              <template #default="scope">
                <template v-if="scope.row.title">{{ scope.row.title.ru || '' }}<template v-if="scope.row.title && scope.row.title.en"> / {{ scope.row.title.en }}</template></template><template v-else>{{ getLocalized(scope.row.title) }}</template><template v-if="scope.row.authors"> — {{ scope.row.authors }}</template>
              </template>
            </el-table-column>
            <el-table-column label="Действия" width="100" fixed="right">
              <template #default="scope">
                <el-button
                  size="small"
                  type="primary"
                  @click="addArticleToIssue(scope.row)"
                  :disabled="isArticleInIssue(scope.row.id)"
                >
                  {{ isArticleInIssue(scope.row.id) ? 'Уже добавлена' : 'Добавить' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loadingSubmissions && availableSubmissions.length === 0" description="Нет доступных статей" />
        </template>
      </el-skeleton>
    </el-dialog>

    <!-- Диалог подтверждения удаления статьи из выпуска -->
    <el-dialog v-model="removeArticleDialogVisible" title="Удалить статью из выпуска" width="400px">
      <p>Вы уверены, что хотите удалить статью <strong>{{ removingArticle ? getLocalized(removingArticle.title) : '' }}</strong> из выпуска?</p>
      <p style="color: var(--el-text-color-secondary); font-size: 0.9rem; margin-top: 8px;">
        Статья будет удалена из выпуска, но не удалена из системы.
      </p>

      <template #footer>
        <el-button @click="removeArticleDialogVisible = false">Отмена</el-button>
        <el-button type="danger" @click="removeArticle" :loading="removing">
          Удалить
        </el-button>
      </template>
    </el-dialog>

    <!-- Диалог создания новой статьи -->
    <el-dialog v-model="createArticleDialogVisible" title="Создать статью" width="600px">
      <el-form label-width="120px" :model="articleForm">
        <el-form-item label="Раздел" prop="sectionId">
          <el-select v-model="articleForm.sectionId" style="width: 100%;" :disabled="sections.length === 0">
            <el-option
              v-for="section in sections"
              :key="section.id"
              :label="getLocalized(section.title) || section.id"
              :value="section.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Название (RU)" prop="titleRu">
          <el-input v-model="articleForm.titleRu" placeholder="Название на русском" />
        </el-form-item>
        <el-form-item label="Название (EN)" prop="titleEn">
          <el-input v-model="articleForm.titleEn" placeholder="Название на английском" />
        </el-form-item>
        <el-form-item label="Абстракт (RU)">
          <el-input v-model="articleForm.abstractRu" type="textarea" :rows="3" placeholder="Абстракт на русском" />
        </el-form-item>
        <el-form-item label="Абстракт (EN)">
          <el-input v-model="articleForm.abstractEn" type="textarea" :rows="3" placeholder="Абстракт на английском" />
        </el-form-item>
        <el-form-item label="Авторы">
          <div class="authors-list">
            <div v-for="(author, idx) in articleForm.authors" :key="idx" class="author-row">
              <el-input v-model="author.givenName" placeholder="Имя" />
              <el-input v-model="author.familyName" placeholder="Фамилия" />
              <el-input v-model="author.email" placeholder="Email*" />
              <el-button
                size="small"
                type="danger"
                circle
                @click="removeAuthor(idx)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button size="small" @click="addAuthor">
              <el-icon><Plus /></el-icon> Добавить автора
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="Ключевые слова">
          <el-select
            v-model="articleForm.keywordsArr"
            class="keywords-select"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            placeholder="Введите и нажмите Enter"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="PDF файл">
          <el-upload
            drag
            action="#"
            :auto-upload="false"
            :on-change="handlePdfChange"
            :file-list="pdfFileList"
            accept=".pdf"
          >
            <div class="upload-content">
              <el-icon :size="40"><Upload /></el-icon>
              <div>Перетащите PDF сюда или кликните</div>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="createArticleDialogVisible = false">Отмена</el-button>
        <el-button type="primary" @click="createArticle" :loading="creatingArticle">
          Создать и добавить
        </el-button>
      </template>
    </el-dialog>

    <!-- Диалог редактирования статьи -->
    <el-dialog v-model="editArticleDialogVisible" title="Редактировать статью" width="600px">
      <el-form label-width="120px" :model="articleForm">
        <el-form-item label="Название (RU)">
          <el-input v-model="articleForm.titleRu" placeholder="Название на русском" />
        </el-form-item>
        <el-form-item label="Название (EN)">
          <el-input v-model="articleForm.titleEn" placeholder="Название на английском" />
        </el-form-item>
        <el-form-item label="Авторы">
          <div class="authors-list">
            <div v-for="(author, idx) in articleForm.authors" :key="idx" class="author-row">
              <el-input v-model="author.givenName" placeholder="Имя" />
              <el-input v-model="author.familyName" placeholder="Фамилия" />
              <el-input v-model="author.email" placeholder="Email*" />
              <el-button
                size="small"
                type="danger"
                circle
                @click="removeAuthor(idx)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button size="small" @click="addAuthor">
              <el-icon><Plus /></el-icon> Добавить автора
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="Ключевые слова">
          <el-select
            v-model="articleForm.keywordsArr"
            class="keywords-select"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            placeholder="Введите и нажмите Enter"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="Страницы">
          <el-input v-model="articleForm.pages" placeholder="Например: 45-67" />
        </el-form-item>
        <el-form-item label="Статус">
          <el-select v-model="articleForm.status" style="width: 100%;">
            <el-option label="Поступила" value="submitted" />
            <el-option label="Рецензирована" value="reviewed" />
            <el-option label="Редактируется" value="copyediting" />
            <el-option label="Готова к публикации" value="ready" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editArticleDialogVisible = false">Отмена</el-button>
        <el-button type="primary" @click="saveArticleEdit" :loading="savingArticle">
          Сохранить
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ArrowLeft, Document, Download, Plus, Edit, Delete, Upload } from '@element-plus/icons-vue'
import { getIssueDetail, getSubmissions, addArticleToIssue, removeArticleFromIssue, createSubmission, createPublication, updatePublication, uploadSubmissionFile, createGalley, submitToProduction, catalogSubmission, getSections, getCurrentContextId, getSubmissionDetail, getPublication, getContributors, createContributor, deleteContributor, AUTHOR_USER_GROUP_ID } from '@/services/ojs'
import { useAuth } from '@/composables/useAuth'
import { ROLES } from '@/config/constants'

export default {
  name: 'IssueDetailPage',
  components: {
    ArrowLeft,
    Document,
    Download,
    Plus,
    Edit,
    Delete,
    Upload
  },
  data() {
    return {
      issue: null,
      loading: true,
      addArticleDialogVisible: false,
      removeArticleDialogVisible: false,
      removingArticle: null,
      removing: false,
      submissions: [],
      availableSubmissions: [],
      loadingSubmissions: false,
      createArticleDialogVisible: false,
      editArticleDialogVisible: false,
      editingArticle: null,
      savingArticle: false,
      creatingArticle: false,
      articleForm: {
        titleRu: '',
        titleEn: '',
        abstractRu: '',
        abstractEn: '',
        authors: [{ givenName: '', familyName: '', email: '' }],
        keywordsArr: [],
        pdfFile: null,
        pages: '',
        sectionId: null
      },
      pdfFileList: [],
      sections: [],
      articlesData: [],
      _editingSubmissionId: null,
      _editingPublicationId: null,
      _editingPublicationVersion: null
    }
  },
  computed: {
    issueTitle: function () {
      if (!this.issue) return ''
      return this.issue.title && this.issue.title.ru
        ? this.issue.title.ru
        : (this.issue.title && this.issue.title.en ? this.issue.title.en : '')
    },
    issueDescription: function () {
      if (!this.issue) return ''
      return this.issue.description && this.issue.description.ru
        ? this.issue.description.ru
        : (this.issue.description && this.issue.description.en ? this.issue.description.en : '')
    },
    articles: function () {
      if (this.articlesData && this.articlesData.length) return this.articlesData
      if (!this.issue) return []
      return this.issue.articles || []
    },
    canManageArticles: function () {
      var auth = useAuth()
      return auth.isAdmin() || auth.hasRole(ROLES.SUBSCRIPTION_MANAGER)
    }
  },
  mounted() {
    this.loadIssue()
  },
  methods: {
    getLocalized: function (obj) {
      if (!obj) return ''
      return obj.ru || obj.en || ''
    },
    // OJS возвращает keywords либо как массив строк { ru: ["a","b"] },
    // либо (из прямого эндпоинта публикации) как массив объектов
    // { ru: [{ name: "a" }, { name: "b" }] }. Приводим к массиву строк.
    keywordsToArray: function (kwObj) {
      if (!kwObj) return []
      var arr = kwObj.ru || kwObj.en || []
      if (!Array.isArray(arr)) return []
      return arr
        .map(function (k) {
          if (typeof k === 'string') return k
          if (k && typeof k === 'object' && k.name) return k.name
          return ''
        })
        .map(function (s) { return (s || '').trim() })
        .filter(Boolean)
    },
    getAuthorFullName: function (author) {
      if (!author) return ''
      var given = this.getLocalized(author.givenName)
      var family = this.getLocalized(author.familyName)
      return (given + ' ' + family).trim()
    },
    getArticleStatusType: function (status) {
      var types = {
        'submitted': 'info',
        'reviewed': 'success',
        'copyediting': 'warning',
        'ready': 'success'
      }
      return types[status] || 'info'
    },
    getArticleStatusLabel: function (status) {
      var labels = {
        'submitted': 'Поступила',
        'reviewed': 'Рецензирована',
        'copyediting': 'Редактируется',
        'ready': 'Готова к публикации'
      }
      return labels[status] || status || 'Неизвестно'
    },
    getSectionTitle: function (sectionId) {
      if (!sectionId || !this.sections.length) return ''
      for (var i = 0; i < this.sections.length; i++) {
        if (String(this.sections[i].id) === String(sectionId)) {
          return this.getLocalized(this.sections[i].title) || sectionId
        }
      }
      return ''
    },
    addAuthor: function () {
      if (!Array.isArray(this.articleForm.authors)) {
        this.articleForm.authors = []
      }
      this.articleForm.authors.push({ givenName: '', familyName: '', email: '' })
    },
    removeAuthor: function (idx) {
      if (!Array.isArray(this.articleForm.authors)) return
      this.articleForm.authors.splice(idx, 1)
      if (this.articleForm.authors.length === 0) {
        this.articleForm.authors.push({ givenName: '', familyName: '', email: '' })
      }
    },
    // Проверка заполненности обязательных полей авторов.
    // Email обязателен для каждого контрибьютера (требование OJS).
    validateAuthors: function () {
      var authors = this.articleForm.authors || []
      for (var i = 0; i < authors.length; i++) {
        var a = authors[i] || {}
        var hasName = (a.givenName && a.givenName.trim()) || (a.familyName && a.familyName.trim())
        var hasEmail = a.email && a.email.trim()
        // полностью пустые строки авторов пропускаем
        if (!hasName && !hasEmail) continue
        if (!hasName) {
          return 'Укажите имя и/или фамилию автора (строка ' + (i + 1) + ')'
        }
        if (!hasEmail) {
          return 'Для каждого автора обязателен Email (строка ' + (i + 1) + ')'
        }
      }
      return null
    },
    // Объекты авторов -> объекты contributor (формат OJS contributors API).
    // Email теперь обязателен и заполняется вручную (не mock).
    buildContributorsPayload: function (submissionId) {
      var self = this
      return (this.articleForm.authors || [])
        .filter(function (a) {
          var author = a || {}
          return (author.givenName && author.givenName.trim()) ||
                 (author.familyName && author.familyName.trim()) ||
                 (author.email && author.email.trim())
        })
        .map(function (a) {
          var givenName = (a.givenName || '').trim()
          var familyName = (a.familyName || '').trim()
          var email = (a.email || '').trim()
          return {
            givenName: { ru: givenName },
            familyName: { ru: familyName },
            email: email,
            userGroupId: AUTHOR_USER_GROUP_ID
          }
        })
    },
    // Записать список авторов как contributors публикации.
    // Сначала удаляем существующих, затем добавляем текущих (простейшая
    // стратегия синхронизации, т.к. отдельного PATCH/PUT массива нет).
    saveContributors: function (submissionId, publicationId, contributors) {
      var self = this
      return getContributors(submissionId, publicationId)
        .then(function (existing) {
          var deletions = (existing || []).map(function (c) {
            return deleteContributor(submissionId, publicationId, c.id)
              .catch(function () { /* игнорируем ошибку удаления */ })
          })
          return Promise.all(deletions)
        })
        .then(function () {
          var creations = (contributors || []).map(function (c) {
            return createContributor(submissionId, publicationId, c)
              .catch(function (err) {
                self.$message && self.$message.warning('Не удалось добавить автора: ' + (c.familyName.ru || '') + ' — ' + (err.message || ''))
              })
          })
          return Promise.all(creations)
        })
    },
    loadIssue() {
      var id = this.$route.params.id
      var self = this
      this.loading = true
      getIssueDetail(id)
        .then(function (data) {
          self.issue = data
          return getSections()
        })
        .then(function (sections) {
          self.sections = sections || []
          var articleIds = (self.issue && self.issue.articles || []).map(function (a) { return a.id })
          return self.enrichArticles(articleIds)
        })
        .catch(function (error) {
          self.issue = null
        })
        .finally(function () {
          self.loading = false
        })
    },
    // Обогащаем статьи выпуска данными из OJS:
    // сам объект issue содержит только ID статей, без авторов. Поэтому
    // для каждой статьи грузим submission, а контрибьютеров-авторов —
    // через отдельный эндпоинт getContributors (авторитетный источник,
    // тот же, что используется в диалоге редактирования).
    enrichArticles: function (articleIds) {
      var self = this
      if (!articleIds || !articleIds.length) {
        self.articlesData = []
        return Promise.resolve()
      }
      return Promise.all(articleIds.map(function (articleId) {
        return getSubmissionDetail(articleId)
          .then(function (sub) {
            var pub = sub.currentPublication ||
              (sub.publications && sub.publications[0]) || {}
            var galley = (pub.galleys && pub.galleys[0]) || null
            var titleObj = (pub.title || sub.title) || {}
            var keywordsArr = self.keywordsToArray(pub.keywords)
            var publicationId = sub.currentPublicationId ||
              (sub.publications && sub.publications[0] && sub.publications[0].id)

            var base = {
              id: articleId,
              titleRu: titleObj.ru || '',
              titleEn: titleObj.en || '',
              authors: '',
              abstract: pub.abstract,
              keywords: keywordsArr,
              sectionId: pub.sectionId,
              sectionTitle: self.getSectionTitle(pub.sectionId),
              pages: sub.pages || pub.pages || '',
              status: sub.status,
              galley: galley
            }

            if (!publicationId) {
              base.keywords = keywordsArr
              return base
            }
            // Контрибьютеров-авторов и ключевые слова грузим через
            // отдельные эндпоинты: authors — getContributors, keywords —
            // только из прямого эндпоинта публикации (в ответе
            // /submissions/{id} поле keywords всегда пустое).
            return Promise.all([
              getContributors(articleId, publicationId),
              getPublication(articleId, publicationId)
            ])
              .then(function (res) {
                var contributors = res[0] || []
                var pubData = res[1] || {}
                base.authors = contributors.map(function (c) {
                  return self.getAuthorFullName(c)
                }).filter(Boolean).join(', ')
                if (pubData && pubData.keywords) {
                  base.keywords = self.keywordsToArray(pubData.keywords)
                } else {
                  base.keywords = keywordsArr
                }
                return base
              })
              .catch(function () { return base })
          })
          .catch(function () {
            return null
          })
      })).then(function (list) {
        self.articlesData = list.filter(Boolean)
      })
    },
    goBack() {
      this.$router.push('/')
    },
    openGalley(galley) {
      if (galley.urlPublished) {
        window.open(galley.urlPublished, '_blank')
      } else if (galley.urlRemote) {
        window.open(galley.urlRemote, '_blank')
      }
    },
    openAddArticleDialog() {
      this.loadSubmissions()
      this.addArticleDialogVisible = true
    },
    loadSubmissions() {
      this.loadingSubmissions = true
      var self = this
      getSubmissions()
        .then(function (data) {
          self.submissions = data
          var currentArticleIds = (self.issue.articles || []).map(function (a) { return a.id })
          self.availableSubmissions = data.filter(function (s) {
            return currentArticleIds.indexOf(s.id) === -1
          })
        })
        .catch(function (error) {
          self.$message && self.$message.error('Не удалось загрузить статьи')
        })
        .finally(function () {
          self.loadingSubmissions = false
        })
    },
    isArticleInIssue(submissionId) {
      if (!this.issue || !this.issue.articles) return false
      return this.issue.articles.some(function (a) { return a.id === submissionId })
    },
    addArticleToIssue(submission) {
      if (!this.issue || !submission) return
      var self = this
      addArticleToIssue(this.issue.id, submission.id)
        .then(function () {
          self.$message && self.$message.success('Статья добавлена в выпуск')
          self.loadIssue()
          self.loadSubmissions()
        })
        .catch(function (error) {
          self.$message && self.$message.error(error.message || 'Не удалось добавить статью')
        })
    },
    confirmRemoveArticle(article) {
      this.removingArticle = article
      this.removeArticleDialogVisible = true
    },
    openEditArticleDialog(article) {
      this.editingArticle = article
      var self = this
      this.editArticleDialogVisible = true
      this.articleForm = {
        titleRu: this.getLocalized(article.title),
        titleEn: article.title && article.title.en || '',
        authors: [{ givenName: '', familyName: '', email: '' }],
        keywordsArr: (article.keywords || []).slice(),
        pages: article.pages || '',
        status: article.status || 'submitted'
      }
      // Загружаем реальных контрибьютеров из БД, чтобы их можно было отредактировать
      getSubmissionDetail(article.id)
        .then(function (sub) {
          var publicationId = sub.currentPublicationId ||
            (sub.publications && sub.publications[0] && sub.publications[0].id)
          self._editingSubmissionId = article.id
          self._editingPublicationId = publicationId
          self._editingPublicationVersion = (sub.currentPublication && sub.currentPublication.version) ||
            (sub.publications && sub.publications[0] && sub.publications[0].version) || 1
          if (!publicationId) return null
          return Promise.all([
            getContributors(article.id, publicationId),
            getPublication(article.id, publicationId)
          ])
        })
        .then(function (res) {
          if (!res) return
          var contributors = res[0] || []
          var pubData = res[1] || {}
          // Ключевые слова достоверно приходят только из прямого
          // эндпоинта публикации (в ответе submission их нет).
          if (pubData && pubData.keywords) {
            self.articleForm.keywordsArr = self.keywordsToArray(pubData.keywords)
          }
          if (!contributors || !contributors.length) return
          var authorsArr = contributors.map(function (c) {
            return {
              givenName: (c.givenName && (c.givenName.ru || c.givenName.en)) || '',
              familyName: (c.familyName && (c.familyName.ru || c.familyName.en)) || '',
              email: c.email || ''
            }
          })
          if (authorsArr.length === 0) authorsArr.push({ givenName: '', familyName: '', email: '' })
          self.articleForm.authors = authorsArr
        })
        .catch(function () {
          // fallback: парсим строку authors из отображаемых данных
          var fallback = []
          if (article.authors) {
            fallback = String(article.authors)
              .split(',')
              .map(function (s) { return s.trim() })
              .filter(Boolean)
              .map(function (name) {
                var parts = name.split(/\s+/)
                var given = parts.shift() || name
                var family = parts.join(' ') || name
                return { givenName: given, familyName: family, email: '' }
              })
          }
          if (fallback.length === 0) fallback.push({ givenName: '', familyName: '', email: '' })
          self.articleForm.authors = fallback
        })
    },
    saveArticleEdit() {
      if (!this.editingArticle) return
      var vErr = this.validateAuthors()
      if (vErr) {
        this.$message && this.$message.warning(vErr)
        return
      }
      this.savingArticle = true
      var self = this
      var submissionId = this._editingSubmissionId || this.editingArticle.id

      var proceed = function (publicationId) {
        self._editingPublicationId = publicationId
        var contributors = self.buildContributorsPayload(submissionId)
        return self.saveContributors(submissionId, publicationId, contributors)
          .then(function () {
            // Обновляем название и ключевые слова публикации.
            // OJS требует поле version при PUT /publications/{id},
            // иначе возвращает 400 и данные не сохраняются.
            var pubData = { version: self._editingPublicationVersion || 1 }
            if (self.articleForm.titleRu || self.articleForm.titleEn) {
              pubData.title = {}
              if (self.articleForm.titleRu) pubData.title.ru = self.articleForm.titleRu
              if (self.articleForm.titleEn) pubData.title.en = self.articleForm.titleEn
            }
            var kwList = (self.articleForm.keywordsArr || [])
              .map(function (s) { return (s || '').trim() })
              .filter(Boolean)
            if (kwList.length) {
              pubData.keywords = { ru: kwList }
            }
            if (Object.keys(pubData).length <= 1) return
            return updatePublication(submissionId, publicationId, pubData)
          })
          .then(function () {
            self.$message && self.$message.success('Изменения сохранены')
            self.editArticleDialogVisible = false
            self.editingArticle = null
            self._editingSubmissionId = null
            self._editingPublicationId = null
            self._editingPublicationVersion = null
            self.loadIssue()
          })
      }

      if (this._editingPublicationId) {
        return proceed(this._editingPublicationId)
          .catch(function (error) {
            self.$message && self.$message.error(error.message || 'Не удалось сохранить авторов')
          })
          .finally(function () {
            self.savingArticle = false
          })
      }

      getSubmissionDetail(submissionId)
        .then(function (sub) {
          var publicationId = sub.currentPublicationId ||
            (sub.publications && sub.publications[0] && sub.publications[0].id)
          if (!publicationId) {
            throw new Error('Не получен ID publication')
          }
          return proceed(publicationId)
        })
        .catch(function (error) {
          self.$message && self.$message.error(error.message || 'Не удалось сохранить авторов')
        })
        .finally(function () {
          self.savingArticle = false
        })
    },
    removeArticle() {
      if (!this.removingArticle || !this.issue) return
      this.removing = true
      var self = this
      var articleId = this.removingArticle.id
      var issueId = this.issue.id
      removeArticleFromIssue(issueId, articleId)
        .then(function () {
          self.$message && self.$message.success('Статья удалена из выпуска')
          self.removeArticleDialogVisible = false
          self.removingArticle = null
          self.loadIssue()
        })
        .catch(function (error) {
          self.$message && self.$message.error(error.message || 'Не удалось удалить статью')
        })
        .finally(function () {
          self.removing = false
        })
    },
    openCreateArticleDialog() {
      var self = this
      this.articleForm = {
        titleRu: '',
        titleEn: '',
        abstractRu: '',
        abstractEn: '',
        authors: [{ givenName: '', familyName: '', email: '' }],
        keywordsArr: [],
        pdfFile: null,
        pages: '',
        sectionId: null,
        contextId: null
      }
      this.pdfFileList = []
      this.createArticleDialogVisible = true

      getCurrentContextId()
        .then(function (contextId) {
          self.articleForm.contextId = contextId
          return getSections()
        })
        .then(function (sections) {
          self.sections = sections
          if (sections.length > 0) {
            var section = sections[0]
            var sectionId = section.id || section.sectionId || section.section_id || section.section
            self.articleForm.sectionId = Number(sectionId)
          } else {
            self.articleForm.sectionId = 1
          }
        })
        .catch(function (error) {
          self.articleForm.sectionId = 1
        })
    },
    handlePdfChange(file) {
      this.articleForm.pdfFile = file.raw
    },
    createArticle() {
      if (!this.articleForm.titleRu) {
        this.$message && this.$message.warning('Введите название статьи')
        return
      }
      var vErr = this.validateAuthors()
      if (vErr) {
        this.$message && this.$message.warning(vErr)
        return
      }
      this.creatingArticle = true
      var self = this

      if (!this.articleForm.sectionId) this.articleForm.sectionId = 1
      var sectionId = parseInt(this.articleForm.sectionId, 10)

      // keywords: массив (el-select multiple) -> { ru: [...] }
      var keywords = {}
      var kwList = (this.articleForm.keywordsArr || [])
        .map(function (s) { return (s || '').trim() })
        .filter(Boolean)
      if (kwList.length) {
        keywords = { ru: kwList }
      }

      var submissionData = {
        sectionId: sectionId,
        locale: 'ru'
      }

      createSubmission(submissionData)
        .then(function (submission) {
          var submissionId = submission.id || submission.submissionId
          if (!submissionId) {
            throw new Error('Не получен ID submission')
          }

          var publicationId = submission.currentPublicationId ||
            (submission.publications && submission.publications[0] && submission.publications[0].id)
          if (!publicationId) {
            throw new Error('Не получен ID publication')
          }
          self._publicationId = publicationId
          self._submissionId = submissionId

          var publicationData = {
            version: 1,
            title: { ru: self.articleForm.titleRu },
            abstract: self.articleForm.abstractRu
              ? { ru: self.articleForm.abstractRu }
              : undefined,
            sectionId: sectionId,
            keywords: keywords
          }
          Object.keys(publicationData).forEach(function (key) {
            if (publicationData[key] === undefined) {
              delete publicationData[key]
            }
          })
          return updatePublication(submissionId, publicationId, publicationData)
        })
        .then(function () {
          // Шаг 3b. Авторы пишутся через отдельный эндпоинт contributors
          // (PUT publication с полем authors OJS игнорирует).
          // submissionId берём из self._submissionId, т.к. одноимённая
          // var-переменная недоступна вне первого .then-колбэка.
          var contributors = self.buildContributorsPayload(self._submissionId)
          return self.saveContributors(self._submissionId, self._publicationId, contributors)
        })
        .then(function () {
          if (!self.articleForm.pdfFile) return
          return uploadSubmissionFile(self._submissionId, self.articleForm.pdfFile, 'ru')
            .then(function (fileResp) {
              var fileId = fileResp.id || (fileResp.file && fileResp.file.id)
              if (!fileId) return
              return createGalley(self._submissionId, self._publicationId, fileId, 'ru')
                .catch(function (err) {
                  // Galley — необязательный шаг
                })
            })
            .catch(function (err) {
              // Ошибка загрузки файла не прерывает создание статьи
            })
        })
        .then(function () {
          return submitToProduction(self._submissionId)
            .catch(function (err) {
              // продолжаем без перевода в production
            })
        })
        .then(function () {
          return catalogSubmission(self.issue.id, self._submissionId)
        })
        .then(function () {
          self.$message && self.$message.success('Статья создана и добавлена в выпуск')
          self.createArticleDialogVisible = false
          self.loadIssue()
        })
        .catch(function (error) {
          self.$message && self.$message.error(error.message || 'Не удалось создать статью')
        })
        .finally(function () {
          self.creatingArticle = false
          self._publicationId = null
          self._submissionId = null
        })
    }
  }
}
</script>

<style scoped lang="scss">
.issue-detail-page {
  max-width: 900px;
  margin: 0 auto;
}

.back-button {
  margin-bottom: 16px;
}

.issue-detail-card {
  margin-bottom: 24px;
}

.issue-detail-header {
  display: flex;
  gap: 24px;
}

.issue-detail-cover {
  flex-shrink: 0;
  width: 120px;
  height: 170px;
  overflow: hidden;
  border-radius: 4px;

  :deep(.el-image) {
    width: 100%;
    height: 100%;
  }
}

.issue-detail-info {
  flex: 1;
  min-width: 0;
}

.issue-detail-title {
  margin: 0 0 12px;
  font-size: 1.4rem;
  font-weight: 600;
}

.issue-detail-description {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.issue-detail-meta {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.issue-identification {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.galleys-section,
.articles-section {
  margin-top: 24px;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 16px;
}

.galley-card {
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform 0.1s;

  &:hover {
    transform: translateX(4px);
  }
}

.galley-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.galley-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.galley-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.galley-locale {
  font-size: 0.8rem;
  color: var(--el-text-color-placeholder);
}

.galley-arrow {
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
}

.article-card {
  margin-bottom: 8px;
}

.article-info {
  flex: 1;
  min-width: 0;
}

.article-title {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 500;
}

.article-title-en {
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
}

.article-title-sep {
  font-size: 0.85rem;
  color: var(--el-text-color-placeholder);
}

.article-authors {
  margin: 0;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
}

.article-section {
  margin: 2px 0 0;
}

.article-abstract {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.article-keywords {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
}

.keyword-label {
  font-weight: 500;
}

.keyword-chip {
  display: inline-block;
  margin: 0 4px 2px 0;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.article-meta-row {
  margin: 6px 0 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.article-pages {
  font-size: 0.8rem;
  color: var(--el-text-color-placeholder);
}

.article-galley-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.article-status {
  margin-top: 8px;
}

.article-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.authors-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
}

// Крестик удаления ключевого слова — красным
.keywords-select {
  :deep(.el-tag__close) {
    color: hsl(0, 100%, 50%);
  }

  :deep(.el-tag__close:hover) {
    color: hsl(0, 100%, 40%);
    background: transparent;
  }
}
</style>
