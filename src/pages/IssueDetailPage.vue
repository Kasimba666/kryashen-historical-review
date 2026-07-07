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
                <el-tag v-if="issue.datePublished" type="success">{{ issue.datePublished }}</el-tag>
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

        <!-- Статьи (если есть) -->
        <div v-if="issue && issue.articles && issue.articles.length > 0" class="articles-section">
          <h2 class="section-title">Статьи</h2>
          <el-card
            v-for="article in issue.articles"
            :key="article.id"
            class="article-card"
            shadow="hover"
          >
            <div class="article-info">
              <h3 class="article-title">{{ getLocalized(article.title) }}</h3>
              <p v-if="article.authors" class="article-authors">{{ article.authors }}</p>
              <p v-if="article.pages" class="article-pages">Стр. {{ article.pages }}</p>
            </div>
          </el-card>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<script>
import { ArrowLeft, Document, Download } from '@element-plus/icons-vue'
import { getIssueDetail } from '@/services/ojs'

export default {
  name: 'IssueDetailPage',
  components: {
    ArrowLeft,
    Document,
    Download
  },
  data() {
    return {
      issue: null,
      loading: true
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
    loadIssue() {
      var id = this.$route.params.id
      this.loading = true
      getIssueDetail(id)
        .then(function (data) {
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
</style>