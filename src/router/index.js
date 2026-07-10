import { createRouter, createWebHistory } from 'vue-router'
import JournalPage from '@/pages/JournalPage.vue'
import IssueDetailPage from '@/pages/IssueDetailPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import UsersPage from '@/pages/UsersPage.vue'
import AboutPage from '@/pages/AboutPage.vue'
import TablesCheckPage from '@/pages/TablesCheckPage.vue'
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
      path: '/about',
      name: 'about',
      component: AboutPage
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
    },
    {
      path: '/users',
      name: 'users',
      component: UsersPage,
      meta: { 
        requiresAuth: true,
        roles: [16, 17] // Journal Manager (16) или Editor (17)
      }
    },
    {
      path: '/tables-check',
      name: 'tables-check',
      component: TablesCheckPage,
      meta: { 
        requiresAuth: true,
        siteAdminOnly: true // только администратор сайта (ojs)
      }
    }
  ],
})

// Применяем middleware авторизации
router.beforeEach(authMiddleware)

export default router