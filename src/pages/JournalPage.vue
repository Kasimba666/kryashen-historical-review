<template>
  <div class="journal-page">
    <h2 class="section-title">Выпуски</h2>

    <el-skeleton :loading="loading" animated :count="5">
      <template #default>
        <el-empty v-if="!loading && issues.length === 0" description="Нет выпусков" />

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
import { getIssues } from '@/services/ojs'

export default {
  name: 'JournalPage',
  components: {
    ArrowRight
  },
  data() {
    return {
      issues: [],
      loading: true
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
    }
  }
}
</script>

<style scoped lang="scss">
.journal-page {
  max-width: 900px;
  margin: 0 auto;
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
