<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <el-icon :size="24"><User /></el-icon>
          <span>Вход в систему</span>
        </div>
      </template>

      <el-alert
        v-if="errorMsg"
        :title="errorMsg"
        type="error"
        show-icon
        :closable="true"
        @close="errorMsg = ''"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="Имя пользователя или email" prop="username">
          <el-input
            v-model="form.username"
            placeholder="Введите имя пользователя или адрес почты"
            :disabled="loading"
            autocomplete="username"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Пароль" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="Ваш пароль"
            :disabled="loading"
            autocomplete="current-password"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <div class="form-actions">
          <el-form-item>
            <el-button
              type="primary"
              native-type="submit"
              :loading="loading"
              class="login-button"
            >
              {{ loading ? 'Вход...' : 'Войти' }}
            </el-button>
          </el-form-item>
          <div class="form-links">
            <el-button type="primary" link @click="goToRegister">
              Регистрация
            </el-button>
            <el-button type="primary" link @click="showForgotPassword">
              Забыли пароль?
            </el-button>
          </div>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { User, Lock } from '@element-plus/icons-vue'
import { useAuth } from '@/composables/useAuth'
import { login as ojsLogin, findUserByLogin } from '@/services/ojs'

export default {
  name: 'LoginPage',
  components: {
    User,
    Lock
  },
  data() {
    return {
      form: {
        username: '',
        password: ''
      },
      rules: {
        username: [
          { required: true, message: 'Введите имя пользователя или адрес почты', trigger: 'blur' }
        ],
        password: [
          { required: true, message: 'Введите пароль', trigger: 'blur' }
        ]
      },
      loading: false,
      errorMsg: ''
    }
  },
  methods: {
    handleLogin() {
      this.$refs.formRef.validate(function (valid) {
        if (!valid) return

        this.loading = true
        this.errorMsg = ''

        // 1. Вход через OJS сессию
        ojsLogin(this.form.username, this.form.password)
          .then(function () {
            // 2. Найти пользователя по username или email
            return findUserByLogin(this.form.username)
          }.bind(this))
          .then(function (user) {
            // 3. Сохранить сессию в localStorage
            var auth = useAuth()
            auth.login({
              username: user.userName,
              fullName: user.fullName,
              email: user.email,
              preferredPublicName: user.preferredPublicName,
              groups: user.groups || []
            })

            this.$message.success('Добро пожаловать, ' + auth.getDisplayName() + '!')
            this.$router.push('/')
          }.bind(this))
          .catch(function (error) {
            this.errorMsg = error.message || 'Произошла ошибка при входе. Попробуйте позже.'
          }.bind(this))
          .finally(function () {
            this.loading = false
          }.bind(this))
      }.bind(this))
    },
    goToRegister() {
      // TODO: Добавить страницу регистрации или ссылку на OJS
      this.$message.info('Регистрация временно недоступна')
    },
    showForgotPassword() {
      // TODO: Добавить страницу восстановления пароля или ссылку на OJS
      this.$message.info('Функция восстановления пароля временно недоступна')
    }
  }
}
</script>

<style scoped lang="scss">
.login-page {
  max-width: 420px;
  margin: 60px auto 0;
}

.login-card {
  :deep(.el-card__header) {
    padding: 16px 20px;
  }
}

.login-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-button {
  width: 100%;
}

.form-links {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}
</style>