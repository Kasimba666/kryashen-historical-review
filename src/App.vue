<template>
  <div class="app-container">
    <el-container>
      <el-header class="app-header" height="48px">
        <div class="header-content">
          <div class="header-left">
            <router-link to="/" class="header-logo">
              <el-icon :size="20"><Notebook /></el-icon>
              <span>Кряшенское историческое обозрение</span>
            </router-link>
              <el-menu
                :default-active="currentRoute"
                mode="horizontal"
                :ellipsis="false"
                class="nav-menu"
                @select="handleNavSelect"
              >
                <el-menu-item index="/about">
                  <el-icon :size="14"><InfoFilled /></el-icon>
                  <span>О журнале</span>
                </el-menu-item>
                <el-menu-item index="/">
                  <el-icon :size="14"><Collection /></el-icon>
                  <span>Выпуски</span>
                </el-menu-item>
                <el-sub-menu v-if="isSiteAdmin || canManageUsers" index="management">
                  <template #title>
                    <el-icon :size="14"><Setting /></el-icon>
                    <span>Управление</span>
                  </template>
                  <el-menu-item v-if="isSiteAdmin" index="/tables-check">
                    <el-icon :size="14"><Document /></el-icon>
                    <span>Проверка таблиц</span>
                  </el-menu-item>
                  <el-menu-item v-if="canManageUsers" index="/users">
                    <el-icon :size="14"><UserFilled /></el-icon>
                    <span>Пользователи</span>
                  </el-menu-item>
                </el-sub-menu>
              </el-menu>
          </div>
          <div class="header-actions">
            <template v-if="isAuthenticated">
              <el-dropdown trigger="click" @command="handleDropdownCommand">
                <el-button class="header-btn user-btn" text>
                  <el-icon :size="16"><UserFilled /></el-icon>
                  <span class="user-name">{{ displayName }}</span>
                  <el-icon :size="14"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item disabled class="user-info-item">
                      <div class="dropdown-user-info">
                        <span class="dropdown-username">{{ username }}</span>
                        <span class="dropdown-roles">{{ roleNames }}</span>
                      </div>
                    </el-dropdown-item>
                    <el-dropdown-item divided command="logout">
                      <el-icon :size="14"><SwitchButton /></el-icon>
                      Выйти
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
            <template v-else>
              <el-tooltip content="Войти в систему" placement="bottom">
                <el-button class="header-btn" text @click="goToLogin">
                  <el-icon :size="16"><User /></el-icon>
                  <span class="user-name">Гость</span>
                </el-button>
              </el-tooltip>
            </template>

            <span class="header-divider"></span>

            <el-tooltip :content="isDark ? 'Светлая тема' : 'Тёмная тема'" placement="bottom">
              <el-button class="header-btn theme-toggle" text @click="toggleTheme">
                <el-icon :size="18">
                  <Moon v-if="!isDark" />
                  <Sunny v-else />
                </el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </el-header>
      <el-main :class="['app-main', { 'app-main--wide': isWidePage }]">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script>
import { Notebook, Moon, Sunny, User, UserFilled, SwitchButton, ArrowDown, Setting, InfoFilled, Collection, Document } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { useAuth } from '@/composables/useAuth'

export default {
  name: 'App',
  components: {
    Notebook,
    Moon,
    Sunny,
    User,
    UserFilled,
    SwitchButton,
    ArrowDown,
    Setting,
    InfoFilled,
    Collection,
    Document
  },
  data() {
    return {
      isDark: false,
      isAuthenticated: false,
      isSiteAdmin: false,
      displayName: '',
      username: '',
      roleNames: '',
      canManageUsers: false
    }
  },
  computed: {
    currentRoute: function () {
      return this.$route.path
    },
    isWidePage: function () {
      return this.$route.path === '/users'
    }
  },
  mounted() {
    var theme = useTheme()
    var current = theme.initTheme()
    this.isDark = current === 'dark'
    this.updateAuthState()
  },
  methods: {
    handleNavSelect: function (index) {
      this.$router.push(index)
    },
    updateAuthState: function () {
      var auth = useAuth()
      this.isAuthenticated = auth.isAuthenticated()

      if (this.isAuthenticated) {
        this.displayName = auth.getDisplayName()
        this.username = auth.getUsername()
        var roles = auth.getRoleNames()
        this.roleNames = roles.map(function (r) { return r.name }).join(', ')
        this.canManageUsers = auth.hasRole(16) || auth.hasRole(17)
        this.isSiteAdmin = auth.isSiteAdmin()
      } else {
        this.displayName = ''
        this.username = ''
        this.roleNames = ''
        this.canManageUsers = false
        this.isSiteAdmin = false
      }
    },
    toggleTheme: function () {
      var theme = useTheme()
      var next = theme.toggleTheme()
      this.isDark = next === 'dark'
    },
    goToLogin: function () {
      this.$router.push('/login')
    },
    handleDropdownCommand: function (command) {
      if (command === 'logout') {
        this.handleLogout()
      } else if (command === 'users') {
        this.$router.push('/users')
      }
    },
    handleLogout: function () {
      var auth = useAuth()
      auth.logout()
      this.updateAuthState()
      this.$message.success('Вы вышли из системы')
      if (this.$route.path === '/login') {
        this.$router.push('/')
      }
    }
  },
  watch: {
    '$route': function () {
      this.updateAuthState()
    }
  }
}
</script>

<style lang="scss">
@use '@/styles/main.scss';
</style>

<style scoped lang="scss">
.app-container {
  min-height: 100vh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 900px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 600;
  transition: color 0.15s;
  white-space: nowrap;

  &:hover {
    color: var(--color-primary);
  }
}

.nav-menu {
  border-bottom: none !important;
  height: 48px;
  background: transparent;

  :deep(.el-menu-item) {
    height: 48px;
    line-height: 48px;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    background: transparent !important;

    &:hover {
      color: var(--color-text-primary);
      background: transparent !important;
    }

    &.is-active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
      background: transparent !important;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.header-btn {
  --el-button-bg-color: transparent;
  --el-button-border-color: transparent;
  --el-button-hover-bg-color: var(--color-bg-hover);
  --el-button-hover-border-color: transparent;
  color: var(--color-text-secondary);
  padding: 6px;
  border-radius: 50%;
  transition: color 0.15s, background-color 0.15s;

  &:hover {
    color: var(--color-text-primary);
  }
}

.user-btn {
  border-radius: 6px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-name {
  font-size: 0.85rem;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-divider {
  display: inline-block;
  width: 1px;
  height: 20px;
  background: var(--color-border-lighter);
  margin: 0 4px;
}

.app-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;

  &.app-main--wide {
    max-width: 100%;
  }
}

.dropdown-user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
  max-width: 220px;
}

.dropdown-username {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dropdown-roles {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

:deep(.user-info-item) {
  cursor: default !important;
  opacity: 1 !important;

  &:hover {
    background-color: transparent !important;
  }
}
</style>