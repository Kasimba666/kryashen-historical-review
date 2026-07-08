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
                <el-tag v-if="isPublished" type="success">Опубликован</el-tag>
                <el-tag v-else type="warning">Черновик</el-tag>
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
              <el-button type="primary" size="small" @click="openAddArticleDialog">
                <el-icon><Plus /></el-icon>
                Добавить статью
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
              <h3 class="article-title">{{ getLocalized(article.title) }}</h3>
              <p v-if="article.authors" class="article-authors">{{ article.authors }}</p>
              <p v-if="article.pages" class="article-pages">Стр. {{ article.pages }}</p>
              <div v-if="article.status" class="article-status">
                <el-tag size="small" :type="getArticleStatusType(article.status)">
                  {{ getArticleStatusLabel(article.status) }}
                </el-tag>
              </div>
            </div>
    <div v-if="canManageArticles && !isPublished" class="article-actions" @click.stop>
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
            <el-table-column prop="title" label="Название">
              <template #default="scope">
                {{ getLocalized(scope.row.title) }}
              </template>
            </el-table-column>
            <el-table-column prop="authors" label="Авторы" width="200">
              <template #default="scope">
                {{ scope.row.authors || 'Не указаны' }}
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
          <el-input v-model="articleForm.authors" placeholder="ФИО авторов" />
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
import { ArrowLeft, Document, Download, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { getIssueDetail, getSubmissions, addArticleToIssue, removeArticleFromIssue } from '@/services/ojs'
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
    Delete
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
      editArticleDialogVisible: false,
      editingArticle: null,
      savingArticle: false,
      articleForm: {
        titleRu: '',
        titleEn: '',
        authors: '',
        pages: '',
        status: 'submitted'
      }
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
      if (!this.issue) return []
      return this.issue.articles || []
    },
    isPublished: function () {
      if (!this.issue) return false
      // OJS uses boolean `published` field to indicate if issue is published
      return this.issue.published === true
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
    loadIssue() {
      var id = this.$route.params.id
      this.loading = true
      getIssueDetail(id)
        .then(function (data) {
          console.log('[IssueDetailPage] Issue data:', JSON.stringify(data, null, 2))
          this.issue = data
        }.bind(this))
        .catch(function (error) {
          console.error(error)
          this.issue = null
        }.bind(this))
        .finally(function () {
          this.loading = false
        }.bind(this))
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
        }.bind(this))
        .catch(function (error) {
          console.error('Ошибка загрузки submissions', error)
          self.$message && self.$message.error('Не удалось загрузить статьи')
        }.bind(this))
        .finally(function () {
          self.loadingSubmissions = false
        }.bind(this))
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
          console.error('Ошибка добавления статьи', error)
          self.$message && self.$message.error(error.message || 'Не удалось добавить статью')
        })
    },
    confirmRemoveArticle(article) {
      this.removingArticle = article
      this.removeArticleDialogVisible = true
    },
    openEditArticleDialog(article) {
      this.editingArticle = article
      this.articleForm = {
        titleRu: this.getLocalized(article.title),
        titleEn: article.title && article.title.en || '',
        authors: article.authors || '',
        pages: article.pages || '',
        status: article.status || 'submitted'
      }
      this.editArticleDialogVisible = true
    },
    saveArticleEdit() {
      if (!this.editingArticle) return
      this.savingArticle = true
      var self = this

      // В реальном проекте здесь должен быть API вызов для обновления статьи
      // Пока просто обновляем локально
      var updatedArticle = {
        id: this.editingArticle.id,
        title: {
          ru: this.articleForm.titleRu,
          en: this.articleForm.titleEn
        },
        authors: this.articleForm.authors,
        pages: this.articleForm.pages,
        status: this.articleForm.status
      }

      // Имитируем сохранение
      setTimeout(function () {
        var index = self.issue.articles.findIndex(function (a) { return a.id === self.editingArticle.id })
        if (index !== -1) {
          self.issue.articles.splice(index, 1, updatedArticle)
        }
        self.$message && self.$message.success('Статья обновлена')
        self.editArticleDialogVisible = false
        self.editingArticle = null
        self.savingArticle = false
      }, 500)
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
          console.error('Ошибка удаления статьи', error)
          self.$message && self.$message.error(error.message || 'Не удалось удалить статью')
        })
        .finally(function () {
          self.removing = false
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

.article-authors {
  margin: 0;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
}

.article-pages {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--el-text-color-placeholder);
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
</style>