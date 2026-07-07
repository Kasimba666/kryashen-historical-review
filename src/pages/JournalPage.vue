<template>
  <div class="journal-page">
    <el-skeleton :loading="loading" animated :count="3">
      <template #default>
        <el-card v-if="journal" class="journal-card">
          <template #header>
            <div class="journal-header">
              <div class="journal-info">
                <h1 class="journal-name">{{ journalName }}</h1>
                <p v-if="journalDescription" class="journal-description" v-html="journalDescription"></p>
                <div class="journal-meta">
                  <el-tag v-if="journal.acronym" size="small" type="info">{{ journal.acronym.ru || journal.acronym.en }}</el-tag>
                  <el-tag v-if="journal.url" size="small" type="success" @click="openUrl(journal.url)">Сайт журнала</el-tag>
                </div>
              </div>
            </div>
          </template>
        </el-card>
      </template>
    </el-skeleton>

    <h2 class="section-title">Выпуски</h2>

    <el-skeleton :loading="issuesLoading" animated :count="5">
      <template #default>
        <el-empty v-if="!issuesLoading && issues.length === 0" description="Нет выпусков" />

        <div v-else class="issues-list">
          <el-card
            v-for="issue in issues"
            :key="issue.id"
            class="issue-card"
            shadow="hover"
            @click="goToIssue(issue.id)"
          >
            <div class="issue-card-content">
              <div v-if="issue.coverImageUrl && issue.coverImageUrl.length > 0" class="issue-cover">
                <el-image :src="issue.coverImageUrl[0]" fit="contain" />
              </div>
              <div class="issue-details">
                <h3 class="issue-title">{{ getLocalized(issue.title) }}</h3>
                <p v-if="getLocalized(issue.description)" class="issue-description" v-html="getLocalized(issue.description)"></p>
                <div class="issue-meta">
                  <el-tag v-if="issue.volume" size="small" type="info">Том {{ issue.volume }}</el-tag>
                  <el-tag v-if="issue.number" size="small" type="info">№ {{ issue.number }}</el-tag>
                  <el-tag v-if="issue.year" size="small" type="info">{{ issue.year }}</el-tag>
                  <el-tag v-if="issue.datePublished" size="small" type="success">{{ issue.datePublished }}</el-tag>
                </div>
                <p v-if="issue.identification" class="issue-identification">{{ issue.identification }}</p>
              </div>
              <el-icon class="issue-arrow"><ArrowRight /></el-icon>
            </div>
          </el-card>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<script>
import { ArrowRight } from '@element-plus/icons-vue'
import { getJournalInfo, getIssues } from '@/services/ojs'

export default {
  name: 'JournalPage',
  components: {
    ArrowRight
  },
  data() {
    return {
      journal: null,
      issues: [],
      loading: true,
      issuesLoading: true
    }
  },
  computed: {
    journalName: function () {
      if (!this.journal) return ''
      return this.journal.name && this.journal.name.ru
        ? this.journal.name.ru
        : (this.journal.name && this.journal.name.en ? this.journal.name.en : '')
    },
    journalDescription: function () {
      if (!this.journal) return ''
      return this.journal.description && this.journal.description.ru
        ? this.journal.description.ru
        : (this.journal.description && this.journal.description.en ? this.journal.description.en : '')
    }
  },
  mounted() {
    this.loadJournal()
    this.loadIssues()
  },
  methods: {
    getLocalized: function (obj) {
      if (!obj) return ''
      return obj.ru || obj.en || ''
    },
    openUrl: function (url) {
      window.open(url, '_blank')
    },
    loadJournal() {
      this.loading = true
      getJournalInfo()
        .then(function (data) {
          this.journal = data
        }.bind(this))
        .catch(function (error) {
          console.error(error)
          this.journal = null
        }.bind(this))
        .finally(function () {
          this.loading = false
        }.bind(this))
    },
    loadIssues() {
      this.issuesLoading = true
      getIssues()
        .then(function (data) {
          this.issues = data
        }.bind(this))
        .catch(function (error) {
          console.error(error)
          this.issues = []
        }.bind(this))
        .finally(function () {
          this.issuesLoading = false
        }.bind(this))
    },
    goToIssue(id) {
      this.$router.push('/issues/' + id)
    }
  }
}
</script>

<style scoped lang="scss">
.journal-page {
  max-width: 900px;
  margin: 0 auto;
}

.journal-card {
  margin-bottom: 24px;
}

.journal-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.journal-info {
  flex: 1;
}

.journal-name {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.journal-description {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.journal-meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 16px;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-card {
  cursor: pointer;
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

.issue-arrow {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--el-text-color-placeholder);
}
</style>