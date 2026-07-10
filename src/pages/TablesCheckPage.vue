<template>
  <div class="tables-check-page">
    <div class="page-header">
      <h1 class="page-title">Проверка таблиц</h1>
      <el-button type="primary" :loading="loading" @click="runCheck">
        <el-icon><Search /></el-icon>
        Запустить поиск
      </el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="info-alert"
    >
      Валидная статья = материал (submission) + связанная публикация (publication),
      привязанная к выпуску (issue), который в свою очередь привязан к журналу.
      Ниже показаны невалидные записи, которые не отображаются на сайте:
      материалы без публикации, публикации без материала, авторы без публикации,
      а также материалы с публикацией, но без привязки к выпуску, и выпуски
      без привязки к журналу. Для каждой записи можно открыть детали и выполнить
      каскадное удаление со всех связанных таблиц.
    </el-alert>

    <el-skeleton :loading="loading" animated :count="3">
      <template #default>
        <template v-if="!loading && searched">
          <!-- Материалы без публикации -->
          <div class="section-block">
            <h2 class="section-title">
              Материалы без публикации
              <el-tag size="small" type="danger">{{ submissions.length }}</el-tag>
            </h2>
            <el-empty v-if="submissions.length === 0" description="Нет" />
            <el-table v-else :data="submissions" stripe class="result-table" @row-click="onRowClick('submission', $event)">
              <el-table-column prop="id" label="ID" width="90" />
              <el-table-column prop="title" label="Название" min-width="260" />
              <el-table-column label="Статус" width="160">
                <template #default="scope">
                  <el-tag size="small" :type="getStatusType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Действия" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click.stop="openSubmissionDetail(scope.row)">Детали</el-button>
                  <el-button size="small" type="danger" :loading="scope.row._deleting" @click.stop="deleteSubmission(scope.row)">Удалить</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Публикации без материала -->
          <div class="section-block">
            <h2 class="section-title">
              Публикации без материала
              <el-tag size="small" type="danger">{{ publications.length }}</el-tag>
            </h2>
            <el-empty v-if="publications.length === 0" description="Нет" />
            <el-table v-else :data="publications" stripe class="result-table" @row-click="onRowClick('publication', $event)">
              <el-table-column prop="id" label="ID публикации" width="120" />
              <el-table-column prop="submissionId" label="ID материала" width="130" />
              <el-table-column prop="title" label="Название" min-width="220" />
              <el-table-column label="Авторов" width="100">
                <template #default="scope">{{ scope.row.authors.length }}</template>
              </el-table-column>
              <el-table-column label="Действия" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click.stop="openPublicationDetail(scope.row)">Детали</el-button>
                  <el-button size="small" type="danger" :loading="scope.row._deleting" @click.stop="deletePublication(scope.row)">Удалить</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Авторы без публикации -->
          <div class="section-block">
            <h2 class="section-title">
              Авторы без публикации
              <el-tag size="small" type="danger">{{ authors.length }}</el-tag>
            </h2>
            <el-empty v-if="authors.length === 0" description="Нет" />
            <el-table v-else :data="authors" stripe class="result-table" @row-click="onRowClick('author', $event)">
              <el-table-column prop="id" label="ID" width="100" />
              <el-table-column label="Имя" min-width="200">
                <template #default="scope">{{ fullName(scope.row) }}</template>
              </el-table-column>
              <el-table-column prop="email" label="Email" min-width="200" />
              <el-table-column prop="publicationId" label="ID публикации" width="140" />
              <el-table-column label="Действия" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click.stop="openAuthorDetail(scope.row)">Детали</el-button>
                  <el-button size="small" type="danger" :loading="scope.row._deleting" @click.stop="deleteAuthor(scope.row)">Удалить</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Материалы с публикацией, но без выпуска -->
          <div class="section-block">
            <h2 class="section-title">
              Материалы с публикацией, но без выпуска
              <el-tag size="small" type="danger">{{ articlesWithoutIssue.length }}</el-tag>
            </h2>
            <el-empty v-if="articlesWithoutIssue.length === 0" description="Нет" />
            <el-table v-else :data="articlesWithoutIssue" stripe class="result-table" @row-click="onRowClick('article', $event)">
              <el-table-column prop="id" label="ID" width="90" />
              <el-table-column prop="title" label="Название" min-width="260" />
              <el-table-column label="Статус" width="160">
                <template #default="scope">
                  <el-tag size="small" :type="getStatusType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="publicationsCount" label="Публикаций" width="120" />
              <el-table-column label="Действия" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click.stop="openArticleDetail(scope.row)">Детали</el-button>
                  <el-button size="small" type="danger" :loading="scope.row._deleting" @click.stop="deleteArticleWithoutIssue(scope.row)">Удалить</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Выпуски без привязки к журналу -->
          <div class="section-block">
            <h2 class="section-title">
              Выпуски без привязки к журналу
              <el-tag size="small" type="danger">{{ issuesWithoutJournal.length }}</el-tag>
            </h2>
            <el-empty v-if="issuesWithoutJournal.length === 0" description="Нет" />
            <el-table v-else :data="issuesWithoutJournal" stripe class="result-table" @row-click="onRowClick('issue', $event)">
              <el-table-column prop="id" label="ID" width="90" />
              <el-table-column prop="title" label="Название" min-width="220" />
              <el-table-column prop="identification" label="Идентификация" min-width="160" />
              <el-table-column prop="journalId" label="ID журнала" width="140">
                <template #default="scope">{{ scope.row.journalId || '— (нет)' }}</template>
              </el-table-column>
              <el-table-column label="Действия" width="200" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click.stop="openIssueDetail(scope.row)">Детали</el-button>
                  <el-button size="small" type="danger" :loading="scope.row._deleting" @click.stop="deleteIssueWithoutJournal(scope.row)">Удалить</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <el-empty
            v-if="submissions.length === 0 && publications.length === 0 && authors.length === 0 && articlesWithoutIssue.length === 0 && issuesWithoutJournal.length === 0"
            description="Все записи валидны — осиротевших сущностей не найдено"
            class="all-clean"
          />
        </template>

        <el-empty
          v-if="!loading && !searched"
          description="Нажмите «Запустить поиск», чтобы проверить таблицы на осиротевшие записи"
        />
      </template>
    </el-skeleton>

    <!-- Детали материала -->
    <el-dialog v-model="submissionDialogVisible" title="Детали материала" width="600px">
      <template v-if="activeSubmission">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID">{{ activeSubmission.id }}</el-descriptions-item>
          <el-descriptions-item label="Название">{{ activeSubmission.title }}</el-descriptions-item>
          <el-descriptions-item label="Статус">{{ getStatusLabel(activeSubmission.status) }}</el-descriptions-item>
          <el-descriptions-item label="Этап">{{ getStageLabel(activeSubmission.stageId) }}</el-descriptions-item>
          <el-descriptions-item label="Дата">{{ formatDate(activeSubmission.dateSubmitted) }}</el-descriptions-item>
          <el-descriptions-item label="Публикаций">{{ activeSubmission.publicationsCount }}</el-descriptions-item>
        </el-descriptions>
        <p class="detail-note">
          У материала нет ни одной публикации — он не виден на сайте.
          Удаление затронет только таблицу submissions.
        </p>
      </template>
      <template #footer>
        <el-button @click="submissionDialogVisible = false">Закрыть</el-button>
        <el-button type="danger" :loading="activeSubmission && activeSubmission._deleting" @click="deleteSubmission(activeSubmission)">Удалить материал</el-button>
      </template>
    </el-dialog>

    <!-- Детали публикации -->
    <el-dialog v-model="publicationDialogVisible" title="Детали публикации" width="600px">
      <template v-if="activePublication">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID публикации">{{ activePublication.id }}</el-descriptions-item>
          <el-descriptions-item label="ID материала">{{ activePublication.submissionId || '— (нет)' }}</el-descriptions-item>
          <el-descriptions-item label="Название">{{ activePublication.title }}</el-descriptions-item>
          <el-descriptions-item label="Статус">{{ getStatusLabel(activePublication.status) }}</el-descriptions-item>
          <el-descriptions-item label="Дата публикации">{{ formatDate(activePublication.datePublished) }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="detail-subtitle">Связанные авторы ({{ activePublication.authors.length }})</h4>
        <el-table v-if="activePublication.authors.length" :data="activePublication.authors" size="small" class="detail-table">
          <el-table-column prop="id" label="ID" width="90" />
          <el-table-column label="Имя" min-width="160">
            <template #default="scope">{{ scope.row.name || '—' }}</template>
          </el-table-column>
          <el-table-column prop="email" label="Email" min-width="160" />
        </el-table>
        <p v-else class="detail-note">У публикации нет связанных авторов.</p>
        <p class="detail-note">
          У публикации нет валидного материала — она не видна на сайте.
          Каскадное удаление сначала удалит всех авторов, затем саму публикацию.
        </p>
      </template>
      <template #footer>
        <el-button @click="publicationDialogVisible = false">Закрыть</el-button>
        <el-button type="danger" :loading="activePublication && activePublication._deleting" @click="deletePublication(activePublication)">Удалить публикацию</el-button>
      </template>
    </el-dialog>

    <!-- Детали автора -->
    <el-dialog v-model="authorDialogVisible" title="Детали автора" width="600px">
      <template v-if="activeAuthor">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID">{{ activeAuthor.id }}</el-descriptions-item>
          <el-descriptions-item label="Имя">{{ fullName(activeAuthor) }}</el-descriptions-item>
          <el-descriptions-item label="Email">{{ activeAuthor.email || '—' }}</el-descriptions-item>
          <el-descriptions-item label="ID публикации">{{ activeAuthor.publicationId || '— (нет)' }}</el-descriptions-item>
          <el-descriptions-item label="ID материала">{{ activeAuthor.submissionId || '— (нет)' }}</el-descriptions-item>
        </el-descriptions>
        <p class="detail-note">
          <template v-if="!activeAuthor.publicationId">
            У автора не указана публикация — связь критично нарушена, автор не привязан ни к одной публикации.
          </template>
          <template v-else-if="!activeAuthor.publicationValid">
            Указана публикация (ID {{ activeAuthor.publicationId }}), но она невалидна (отсутствует или не связана с материалом) — автор не виден на сайте.
          </template>
          <template v-else>
            Автор связан с валидной публикацией, но попал в список по другим причинам.
          </template>
        </p>
      </template>
      <template #footer>
        <el-button @click="authorDialogVisible = false">Закрыть</el-button>
        <el-button type="danger" :loading="activeAuthor && activeAuthor._deleting" @click="deleteAuthor(activeAuthor)">Удалить автора</el-button>
      </template>
    </el-dialog>

    <!-- Детали материала без выпуска -->
    <el-dialog v-model="articleDialogVisible" title="Детали материала без выпуска" width="600px">
      <template v-if="activeArticle">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID материала">{{ activeArticle.id }}</el-descriptions-item>
          <el-descriptions-item label="Название">{{ activeArticle.title }}</el-descriptions-item>
          <el-descriptions-item label="Статус">{{ getStatusLabel(activeArticle.status) }}</el-descriptions-item>
          <el-descriptions-item label="Всего публикаций">{{ activeArticle.publicationsCount }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="detail-subtitle">Публикации ({{ activeArticle.publications.length }})</h4>
        <el-table :data="activeArticle.publications" size="small" class="detail-table">
          <el-table-column prop="id" label="ID публикации" width="140" />
          <el-table-column label="Статус" width="160">
            <template #default="scope">
              <el-tag size="small" :type="getStatusType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="ID выпуска" min-width="160">
            <template #default="scope">{{ scope.row.issueId || '— (нет, критично)' }}</template>
          </el-table-column>
        </el-table>
        <p class="detail-note">
          У материала есть публикация(и), но ни одна из них не привязана к выпуску — материал
          не виден в журнале. Это критично: статья готова, но «потеряна» без выпуска.
        </p>
      </template>
      <template #footer>
        <el-button @click="articleDialogVisible = false">Закрыть</el-button>
        <el-button type="danger" :loading="activeArticle && activeArticle._deleting" @click="deleteArticleWithoutIssue(activeArticle)">Удалить материал</el-button>
      </template>
    </el-dialog>

    <!-- Детали выпуска без журнала -->
    <el-dialog v-model="issueDialogVisible" title="Детали выпуска без журнала" width="600px">
      <template v-if="activeIssue">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID выпуска">{{ activeIssue.id }}</el-descriptions-item>
          <el-descriptions-item label="Название">{{ activeIssue.title }}</el-descriptions-item>
          <el-descriptions-item label="Идентификация">{{ activeIssue.identification || '—' }}</el-descriptions-item>
          <el-descriptions-item label="ID журнала">{{ activeIssue.journalId || '— (нет, критично)' }}</el-descriptions-item>
        </el-descriptions>
        <p class="detail-note">
          Выпуск не привязан ни к одному журналу (или к чужому) — он не отображается
          на сайте и недоступен для назначения статей.
        </p>
      </template>
      <template #footer>
        <el-button @click="issueDialogVisible = false">Закрыть</el-button>
        <el-button type="danger" :loading="activeIssue && activeIssue._deleting" @click="deleteIssueWithoutJournal(activeIssue)">Удалить выпуск</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { Search } from '@element-plus/icons-vue'
import { getTableCheckData, deleteSubmissionCascade, deletePublicationCascade, deleteContributor, deleteIssue } from '@/services/ojs'

function cleanField(v) {
  if (!v) return ''
  return (v.ru || v.en || v || '').toString()
}

export default {
  name: 'TablesCheckPage',
  components: {
    Search
  },
  data() {
    return {
      loading: false,
      searched: false,
      submissions: [],
      publications: [],
      authors: [],
      articlesWithoutIssue: [],
      issuesWithoutJournal: [],
      submissionDialogVisible: false,
      publicationDialogVisible: false,
      authorDialogVisible: false,
      articleDialogVisible: false,
      issueDialogVisible: false,
      activeSubmission: null,
      activePublication: null,
      activeAuthor: null,
      activeArticle: null,
      activeIssue: null
    }
  },
  methods: {
    getStatusLabel(status) {
      var labels = {
        'submission': 'Поступила',
        'review': 'На рецензии',
        'copyediting': 'Редактирование',
        'production': 'В производстве',
        'scheduled': 'Запланирована',
        'published': 'Опубликована',
        'declined': 'Отклонена'
      }
      return labels[status] || status || 'Неизвестно'
    },
    getStatusType(status) {
      var types = {
        'submission': 'info',
        'review': 'warning',
        'copyediting': 'warning',
        'production': '',
        'scheduled': 'success',
        'published': 'success',
        'declined': 'danger'
      }
      return types[status] || 'info'
    },
    getStageLabel(stageId) {
      var labels = {
        1: 'Подача',
        2: 'Рецензирование',
        3: 'Редактирование',
        4: 'Производство',
        5: 'Опубликована'
      }
      return stageId ? (labels[stageId] || ('этап ' + stageId)) : '—'
    },
    formatDate(value) {
      if (!value) return '—'
      try {
        var d = new Date(value)
        if (isNaN(d.getTime())) return value
        var pad = function (n) { return n < 10 ? '0' + n : '' + n }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      } catch (e) {
        return value
      }
    },
    fullName(row) {
      var n = (cleanField(row.givenName) + ' ' + cleanField(row.familyName)).trim()
      return n || row.email || '(без имени)'
    },
    runCheck() {
      var self = this
      this.loading = true
      this.searched = false
      this.submissions = []
      this.publications = []
      this.authors = []
      this.articlesWithoutIssue = []
      this.issuesWithoutJournal = []

      getTableCheckData()
        .then(function (data) {
          self.submissions = data.submissionsWithoutPublication
          self.publications = data.publicationsWithoutSubmission
          self.authors = data.authorsWithoutPublication
          self.articlesWithoutIssue = data.articlesWithoutIssue
          self.issuesWithoutJournal = data.issuesWithoutJournal
          self.searched = true
        })
        .catch(function (error) {
          self.$message && self.$message.error(error.message || 'Не удалось выполнить проверку')
        })
        .finally(function () {
          self.loading = false
        })
    },
    openSubmissionDetail(row) {
      this.activeSubmission = row
      this.submissionDialogVisible = true
    },
    openPublicationDetail(row) {
      this.activePublication = row
      this.publicationDialogVisible = true
    },
    openAuthorDetail(row) {
      this.activeAuthor = row
      this.authorDialogVisible = true
    },
    openArticleDetail(row) {
      this.activeArticle = row
      this.articleDialogVisible = true
    },
    openIssueDetail(row) {
      this.activeIssue = row
      this.issueDialogVisible = true
    },
    onRowClick(type, row) {
      if (!row) return
      if (type === 'submission') this.openSubmissionDetail(row)
      else if (type === 'publication') this.openPublicationDetail(row)
      else if (type === 'author') this.openAuthorDetail(row)
      else if (type === 'article') this.openArticleDetail(row)
      else if (type === 'issue') this.openIssueDetail(row)
    },
    deleteSubmission(row) {
      if (!row) return
      var self = this
      var idx = this.submissions.indexOf(row)
      if (idx !== -1) this.submissions[idx]._deleting = true
      deleteSubmissionCascade(row.id)
        .then(function () {
          self.$message && self.$message.success('Материал удалён')
          self.submissionDialogVisible = false
          self.runCheck()
        })
        .catch(function (error) {
          if (idx !== -1) self.submissions[idx]._deleting = false
          self.$message && self.$message.error(error.message || 'Не удалось удалить материал')
        })
    },
    deletePublication(row) {
      if (!row || !row.submissionId) {
        this.$message && this.$message.error('Неизвестен родительский материал — удаление невозможно')
        return
      }
      var self = this
      var idx = this.publications.indexOf(row)
      if (idx !== -1) this.publications[idx]._deleting = true
      deletePublicationCascade(row.submissionId, row.id, row._contributors)
        .then(function () {
          self.$message && self.$message.success('Публикация и авторы удалены')
          self.publicationDialogVisible = false
          self.runCheck()
        })
        .catch(function (error) {
          if (idx !== -1) self.publications[idx]._deleting = false
          self.$message && self.$message.error(error.message || 'Не удалось удалить публикацию')
        })
    },
    deleteAuthor(row) {
      if (!row || !row.publicationId || !row.submissionId) {
        this.$message && this.$message.error('Неизвестны материал/публикация — удаление невозможно')
        return
      }
      var self = this
      var idx = this.authors.indexOf(row)
      if (idx !== -1) this.authors[idx]._deleting = true
      deleteContributor(row.submissionId, row.publicationId, row.id)
        .then(function () {
          self.$message && self.$message.success('Автор удалён')
          self.runCheck()
        })
        .catch(function (error) {
          if (idx !== -1) self.authors[idx]._deleting = false
          self.$message && self.$message.error(error.message || 'Не удалось удалить автора')
        })
    },
    deleteArticleWithoutIssue(row) {
      if (!row) return
      var self = this
      var idx = this.articlesWithoutIssue.indexOf(row)
      if (idx !== -1) this.articlesWithoutIssue[idx]._deleting = true
      deleteSubmissionCascade(row.id)
        .then(function () {
          self.$message && self.$message.success('Материал и публикация удалены')
          self.runCheck()
        })
        .catch(function (error) {
          if (idx !== -1) self.articlesWithoutIssue[idx]._deleting = false
          self.$message && self.$message.error(error.message || 'Не удалось удалить материал')
        })
    },
    deleteIssueWithoutJournal(row) {
      if (!row) return
      var self = this
      var idx = this.issuesWithoutJournal.indexOf(row)
      if (idx !== -1) this.issuesWithoutJournal[idx]._deleting = true
      deleteIssue(row.id)
        .then(function () {
          self.$message && self.$message.success('Выпуск удалён')
          self.runCheck()
        })
        .catch(function (error) {
          if (idx !== -1) self.issuesWithoutJournal[idx]._deleting = false
          self.$message && self.$message.error(error.message || 'Не удалось удалить выпуск')
        })
    }
  }
}
</script>

<style scoped lang="scss">
.tables-check-page {
  width: 100%;
  padding: 0 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.info-alert {
  margin-bottom: 16px;
}

.section-block {
  margin-bottom: 24px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-table {
  margin-top: 4px;
}

.all-clean {
  margin-top: 16px;
}

.detail-subtitle {
  margin: 16px 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
}

.detail-table {
  margin-bottom: 8px;
}

.detail-note {
  margin: 12px 0 0;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
}
</style>