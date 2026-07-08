<template>
  <div class="journal-page">
    <div class="page-header">
      <h2 class="section-title">Выпуски</h2>
      <el-button v-if="canManageIssues" type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        Создать выпуск
      </el-button>
    </div>

    <el-skeleton :loading="loading" animated :count="5">
      <template #default>
        <el-empty v-if="!loading && issues.length === 0" description="Нет выпусков" />

        <div v-else class="issues-list">
          <el-card
            v-for="issue in issues"
            :key="issue.id"
            class="issue-card"
            shadow="hover"
          >
            <div class="issue-card-content">
              <div v-if="issue.coverImageUrl && issue.coverImageUrl.length > 0" class="issue-cover">
                <el-image :src="issue.coverImageUrl[0]" fit="contain" />
              </div>
              <div class="issue-details" @click="goToIssue(issue.id)">
                <h3 class="issue-title">{{ getLocalized(issue.title) }}</h3>
                <p v-if="getLocalized(issue.description)" class="issue-description" v-html="getLocalized(issue.description)"></p>
                <div class="issue-meta">
                  <el-tag v-if="issue.volume" size="small" type="info">Том {{ issue.volume }}</el-tag>
                  <el-tag v-if="issue.number" size="small" type="info">№ {{ issue.number }}</el-tag>
                  <el-tag v-if="issue.year" size="small" type="info">{{ issue.year }}</el-tag>
                  <el-tag v-if="issue.published" size="small" type="success">Опубликован</el-tag>
                  <el-tag v-if="!issue.published" size="small" type="warning">Черновик</el-tag>
                </div>
                <p v-if="issue.identification" class="issue-identification">{{ issue.identification }}</p>
              </div>
              <div v-if="canManageIssues" class="issue-actions" @click.stop>
                <el-button
                  size="small"
                  @click="openEditDialog(issue)"
                  title="Редактировать"
                >
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  @click="confirmDelete(issue)"
                  title="Удалить"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </template>
    </el-skeleton>

    <!-- Диалог создания/редактирования выпуска -->
    <el-dialog v-model="dialogVisible" :title="editingIssue ? 'Редактировать выпуск' : 'Создать выпуск'" width="600px">
      <el-form label-width="120px" :model="form" :rules="formRules" ref="formRef">
        <el-form-item label="Название (RU)" prop="titleRu">
          <el-input v-model="form.titleRu" placeholder="Название на русском" />
        </el-form-item>
        <el-form-item label="Название (EN)" prop="titleEn">
          <el-input v-model="form.titleEn" placeholder="Название на английском" />
        </el-form-item>
        <el-form-item label="Описание (RU)">
          <el-input v-model="form.descriptionRu" type="textarea" :rows="3" placeholder="Описание на русском" />
        </el-form-item>
        <el-form-item label="Описание (EN)">
          <el-input v-model="form.descriptionEn" type="textarea" :rows="3" placeholder="Описание на английском" />
        </el-form-item>
        <el-form-item label="Том">
          <el-input-number v-model="form.volume" :min="0" :step="1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="Номер">
          <el-input-number v-model="form.number" :min="0" :step="1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="Год">
          <el-input-number v-model="form.year" :min="1900" :max="2100" :step="1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="Опубликовать">
          <el-switch v-model="form.published" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="Дата публикации">
          <el-date-picker
            v-model="form.datePublished"
            type="date"
            placeholder="Выберите дату"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="Доступен">
          <el-switch v-model="form.openAccess" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">Отмена</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ editingIssue ? 'Сохранить' : 'Создать' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Диалог подтверждения удаления -->
    <el-dialog v-model="deleteDialogVisible" title="Подтверждение удаления" width="400px">
      <p>Вы уверены, что хотите удалить выпуск <strong>{{ deletingIssue ? getLocalized(deletingIssue.title) : '' }}</strong>?</p>
      <p style="color: var(--el-text-color-secondary); font-size: 0.9rem; margin-top: 8px;">
        Это действие нельзя отменить.
      </p>

      <template #footer>
        <el-button @click="deleteDialogVisible = false">Отмена</el-button>
        <el-button type="danger" @click="deleteIssue" :loading="deleting">
          Удалить
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ArrowRight, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { getIssues, createIssue, updateIssue, deleteIssue } from '@/services/ojs'
import { useAuth } from '@/composables/useAuth'
import { ROLES } from '@/config/constants'

export default {
  name: 'JournalPage',
  components: {
    ArrowRight,
    Plus,
    Edit,
    Delete
  },
  data() {
    return {
      issues: [],
      loading: true,
      dialogVisible: false,
      editingIssue: null,
      submitting: false,
      deleteDialogVisible: false,
      deletingIssue: null,
      deleting: false,
      form: {
        titleRu: '',
        titleEn: '',
        descriptionRu: '',
        descriptionEn: '',
        volume: 0,
        number: 0,
        year: new Date().getFullYear(),
        published: 0,
        datePublished: '',
        openAccess: 0
      },
      formRules: {
        titleRu: [
          { required: true, message: 'Введите название на русском', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    canManageIssues: function () {
      var auth = useAuth()
      return auth.isAdmin() || auth.hasRole(ROLES.SUBSCRIPTION_MANAGER)
    }
  },
  mounted() {
    this.loadIssues()
  },
  methods: {
    getLocalized: function (obj) {
      if (!obj) return ''
      return obj.ru || obj.en || ''
    },
    loadIssues() {
      this.loading = true
      getIssues()
        .then(function (data) {
          this.issues = data
        }.bind(this))
        .catch(function (error) {
          console.error(error)
          this.issues = []
        }.bind(this))
        .finally(function () {
          this.loading = false
        }.bind(this))
    },
    goToIssue(id) {
      this.$router.push('/issues/' + id)
    },
    openCreateDialog() {
      this.editingIssue = null
      this.resetForm()
      this.dialogVisible = true
    },
    openEditDialog(issue) {
      this.editingIssue = issue
      
      var vol = issue.volume
      var num = issue.number
      var yr = issue.year
      
      this.form = {
        titleRu: this.getLocalized(issue.title),
        titleEn: issue.title && issue.title.en || '',
        descriptionRu: this.getLocalized(issue.description),
        descriptionEn: issue.description && issue.description.en || '',
        volume: (vol !== null && vol !== undefined) ? Number(vol) : 0,
        number: (num !== null && num !== undefined) ? Number(num) : 0,
        year: (yr !== null && yr !== undefined) ? Number(yr) : new Date().getFullYear(),
        published: issue.datePublished ? 1 : 0,
        datePublished: issue.datePublished || '',
        openAccess: issue.accessStatus || 0
      }

      this.dialogVisible = true
    },
    resetForm() {
      this.form = {
        titleRu: '',
        titleEn: '',
        descriptionRu: '',
        descriptionEn: '',
        volume: 0,
        number: 0,
        year: new Date().getFullYear(),
        published: 0,
        datePublished: '',
        openAccess: 0
      }
    },
    submitForm() {
      var self = this
      this.$refs.formRef.validate(function (valid) {
        if (!valid) return
        self.submitting = true

        var issueData = {}

        if (self.form.titleRu) issueData.title = (issueData.title || {})
        if (self.form.titleRu) issueData.title.ru = self.form.titleRu
        if (self.form.titleEn) issueData.title.en = self.form.titleEn

        if (self.form.descriptionRu || self.form.descriptionEn) issueData.description = {}
        if (self.form.descriptionRu) issueData.description.ru = self.form.descriptionRu
        if (self.form.descriptionEn) issueData.description.en = self.form.descriptionEn

        if (self.form.volume) issueData.volume = self.form.volume
        if (self.form.number) issueData.number = self.form.number
        if (self.form.year) issueData.year = self.form.year
        if (self.form.openAccess === 1) issueData.accessStatus = 1

        if (self.form.published && self.form.datePublished) {
          issueData.datePublished = self.form.datePublished
        }

        var promise = self.editingIssue ? updateIssue(self.editingIssue.id, issueData) : createIssue(issueData)

        promise
          .then(function () {
            self.$message && self.$message.success(self.editingIssue ? 'Выпуск обновлен' : 'Выпуск создан')
            self.dialogVisible = false
            self.loadIssues()
          })
          .catch(function (error) {
            console.error('Ошибка сохранения выпуска', error)
            self.$message && self.$message.error(error.message || 'Не удалось сохранить выпуск')
          })
          .finally(function () {
            self.submitting = false
          })
      }.bind(this))
    },
    confirmDelete(issue) {
      this.deletingIssue = issue
      this.deleteDialogVisible = true
    },
    deleteIssue() {
      if (!this.deletingIssue) return

      this.deleting = true
      var self = this
      var issueId = this.deletingIssue.id

      deleteIssue(issueId)
        .then(function () {
          self.$message && self.$message.success('Выпуск удален')
          self.deleteDialogVisible = false
          self.deletingIssue = null
          self.loadIssues()
        })
        .catch(function (error) {
          console.error('Ошибка удаления выпуска', error)
          self.$message && self.$message.error(error.message || 'Не удалось удалить выпуск')
        })
        .finally(function () {
          self.deleting = false
        })
    }
  }
}
</script>

<style scoped lang="scss">
.journal-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-card {
  transition: transform 0.1s;

  &:hover {
    transform: translateX(4px);
  }
}

.issue-card-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.issue-details {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.issue-cover {
  flex-shrink: 0;
  width: 80px;
  height: 110px;
  overflow: hidden;
  border-radius: 4px;

  :deep(.el-image) {
    width: 100%;
    height: 100%;
  }
}

.issue-details {
  flex: 1;
  min-width: 0;
}

.issue-title {
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 500;
}

.issue-description {
  margin: 4px 0;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.issue-meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.issue-identification {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--el-text-color-placeholder);
}

.issue-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.issue-arrow {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--el-text-color-placeholder);
}
</style>