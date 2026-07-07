import { createRouter, createWebHistory } from 'vue-router'
import JournalPage from '@/pages/JournalPage.vue'
import IssueDetailPage from '@/pages/IssueDetailPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import { authMiddleware } from '@/composables/useAuthorization'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'journal',
      component: JournalPage
    },
    {
      path: '/issues/:id',
      name: 'issue-detail',
      component: IssueDetailPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage
    }
  ],
})

// Применяем middleware авторизации
router.beforeEach(authMiddleware)

export default router
