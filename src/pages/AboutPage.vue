<template>
  <div class="about-page">
    <el-skeleton :loading="loading" animated :count="3">
      <template #default>
        <el-card v-if="journal" class="about-card">
          <template #header>
            <div class="about-header">
              <h1 class="about-title">О журнале</h1>
              <el-tag v-if="journal.enabled" size="small" type="success">Активен</el-tag>
              <el-tag v-else size="small" type="danger">Неактивен</el-tag>
            </div>
          </template>

          <div class="about-content">
            <!-- Названия -->
            <div class="info-section">
              <h3 class="info-label">Название</h3>
              <p class="info-value">{{ localized(journal.name) }}</p>
            </div>

            <!-- Описание -->
            <div v-if="localized(journal.description)" class="info-section">
              <h3 class="info-label">Описание</h3>
              <p class="info-value description-text" v-html="localized(journal.description)"></p>
            </div>

            <!-- Аббревиатура -->
            <div v-if="localized(journal.abbreviation)" class="info-section">
              <h3 class="info-label">Аббревиатура</h3>
              <p class="info-value">{{ localized(journal.abbreviation) }}</p>
            </div>

            <!-- Акроним -->
            <div v-if="localized(journal.acronym)" class="info-section">
              <h3 class="info-label">Акроним</h3>
              <p class="info-value">{{ localized(journal.acronym) }}</p>
            </div>

            <!-- Веб-сайт -->
            <div v-if="journal.url" class="info-section">
              <h3 class="info-label">Веб-сайт</h3>
              <el-link type="primary" :href="journal.url" target="_blank">{{ journal.url }}</el-link>
            </div>

            <!-- URL-путь -->
            <div v-if="journal.urlPath" class="info-section">
              <h3 class="info-label">URL-путь</h3>
              <p class="info-value">{{ journal.urlPath }}</p>
            </div>

            <!-- ID журнала -->
            <div class="info-section">
              <h3 class="info-label">ID журнала</h3>
              <p class="info-value">{{ journal.id }}</p>
            </div>

            <!-- Порядковый номер -->
            <div class="info-section">
              <h3 class="info-label">Порядковый номер</h3>
              <p class="info-value">{{ journal.seq }}</p>
            </div>

            <!-- Текущий выпуск -->
            <div v-if="journal.currentIssueId" class="info-section">
              <h3 class="info-label">Текущий выпуск</h3>
              <p class="info-value">#{{ journal.currentIssueId }}</p>
            </div>
          </div>
        </el-card>

        <el-empty v-if="!loading && !journal" description="Информация о журнале недоступна" />
      </template>
    </el-skeleton>
  </div>
</template>

<script>
import { getJournalInfo } from '@/services/ojs'
import { useAuth } from '@/composables/useAuth'

export default {
  name: 'AboutPage',
  data() {
    return {
      journal: null,
      loading: true
    }
  },
  mounted() {
    this.loadJournal()
  },
  methods: {
    loadJournal() {
      this.loading = true
      getJournalInfo()
        .then(function (data) {
          this.journal = data
        }.bind(this))
        .catch(function (error) {
          this.journal = null
        }.bind(this))
        .finally(function () {
          this.loading = false
        }.bind(this))
    },
    localized: function (obj) {
      if (!obj) return ''
      if (typeof obj === 'string') return obj
      return obj.ru || obj.en || ''
    }
  }
}
</script>

<style scoped lang="scss">
.about-page {
  max-width: 900px;
  margin: 0 auto;
}

.about-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.about-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.about-content {
  padding: 4px 0;
}

.info-section {
  margin-bottom: 20px;
}

.info-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 4px;
}

.info-value {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  line-height: 1.5;
}

.description-text {
  font-size: 0.9rem;
  color: var(--color-text-regular);
}
</style>