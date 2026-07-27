<template>
  <div class="users-page">
    <!-- Search & Actions Bar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchQuery"
          placeholder="Поиск по имени, email или логину..."
          :prefix-icon="Search"
          clearable
          class="search-input"
          @input="handleSearch"
          @clear="handleSearch"
        />
      </div>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="showAddDialog">
          Добавить пользователя
        </el-button>
      </div>
    </div>

    <!-- Users Table -->
    <el-card class="table-card">
      <el-table
        :data="users"
        v-loading="loading"
        stripe
        highlight-current-row
        @row-click="handleRowClick"
        empty-text="Нет пользователей"
      >
        <el-table-column prop="id" label="ID" width="64" align="center" />
        <el-table-column prop="username" label="Логин" width="130">
          <template #default="{ row }">
            <span class="username">{{ row.username }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="Email" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="email">{{ row.email }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="givenName" label="Имя" width="120" show-overflow-tooltip />
        <el-table-column prop="familyName" label="Фамилия" width="130" show-overflow-tooltip />
        <el-table-column prop="affiliation" label="Аффилиация" width="180" show-overflow-tooltip />
        <el-table-column label="Статус" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.enabled ? 'success' : 'danger'"
              :effect="row.enabled ? 'light' : 'plain'"
              size="small"
            >
              {{ row.enabled ? 'Активен' : 'Блок.' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Роли" min-width="200">
          <template #default="{ row }">
            <div class="roles-list">
              <el-tag
                v-for="role in row.roles"
                :key="role"
                :type="getRoleType(role)"
                size="small"
                effect="plain"
              >
                {{ role }}
              </el-tag>
              <span v-if="!row.roles || row.roles.length === 0" class="no-roles">Нет ролей</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Действия" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" :icon="Edit" circle @click.stop="handleEdit(row)" />
            <el-button size="small" type="danger" :icon="Delete" circle @click.stop="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-bar" v-if="totalItems > 0">
        <el-pagination
          v-model:page-size="pageSize"
          :current-page="currentPage"
          :total="totalItems"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          size="small"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px" destroy-on-close>
      <el-form :model="form" :rules="rules" ref="userFormRef" label-position="top" size="small">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Логин" prop="username">
              <el-input v-model="form.username" placeholder="Введите логин" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Email" prop="email">
              <el-input v-model="form.email" placeholder="user@example.com" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Имя" prop="givenName">
              <el-input v-model="form.givenName" placeholder="Введите имя" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Фамилия" prop="familyName">
              <el-input v-model="form.familyName" placeholder="Введите фамилию" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="form.id ? 'Пароль (оставьте пустым, чтобы не менять)' : 'Пароль'" prop="password">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? 'Новый пароль' : 'Введите пароль'" />
        </el-form-item>
        <el-form-item label="Аффилиация" prop="affiliation">
          <el-input v-model="form.affiliation" placeholder="Организация / учреждение" />
        </el-form-item>
        <el-form-item label="Роли" prop="userGroupIds">
          <el-select v-model="form.userGroupIds" multiple style="width: 100%;" placeholder="Выберите роли">
            <el-option v-for="(name, id) in availableRoles" :key="id" :label="name" :value="parseInt(id)" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Отмена</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">
          {{ form.id ? 'Сохранить' : 'Создать' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import { Search, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ojsApi } from '@/services/ojs'

var ROLE_TYPES = {
  'Администратор': 'danger',
  'Главный редактор': 'warning',
  'Управляющий журналом': 'warning',
  'Менеджер': 'warning',
  'Редактор': 'primary',
  'Редактор журнала': 'primary',
  'Рецензент': 'info',
  'Автор': 'success',
  'Секретарь': null
}

export default {
  name: 'UsersPage',
  data() {
    return {
      Search: markRaw(Search),
      Plus: markRaw(Plus),
      Edit: markRaw(Edit),
      Delete: markRaw(Delete),
      users: [],
      loading: false,
      saving: false,
      searchQuery: '',
      currentPage: 1,
      pageSize: 20,
      totalItems: 0,
      dialogVisible: false,
      dialogTitle: '',
      userGroupsMap: {},
      form: {
        id: null,
        username: '',
        email: '',
        givenName: '',
        familyName: '',
        password: '',
        affiliation: '',
        userGroupIds: []
      },
      rules: {
        username: [{ required: true, message: 'Введите логин', trigger: 'blur' }],
        email: [
          { required: true, message: 'Введите email', trigger: 'blur' },
          { type: 'email', message: 'Некорректный email', trigger: 'blur' }
        ],
        givenName: [{ required: true, message: 'Введите имя', trigger: 'blur' }],
        familyName: [{ required: true, message: 'Введите фамилию', trigger: 'blur' }],
        password: []
      },
      searchTimer: null
    }
  },
  computed: {
    availableRoles: function () {
      if (Object.keys(this.userGroupsMap).length > 0) {
        return Object.assign({}, this.userGroupsMap)
      }
      return { 25: 'Автор', 26: 'Рецензент', 16: 'Редактор', 1: 'Администратор', 17: 'Главный редактор', 27: 'Секретарь' }
    }
  },
  mounted() {
    this.loadUserGroupsMap().finally(function () {
      this.loadUsers()
    }.bind(this))
  },
  methods: {
    extractAffiliation: function (affiliation) {
      if (!affiliation) return ''
      if (typeof affiliation === 'string') return affiliation
      if (typeof affiliation === 'object') {
        return affiliation.ru || affiliation.en || ''
      }
      return ''
    },

    extractMultilingual: function (field) {
      if (!field) return ''
      if (typeof field === 'string') return field
      if (typeof field === 'object') {
        return field.ru || field.en || field[Object.keys(field)[0]] || ''
      }
      return ''
    },

    loadUserGroupsMap: function () {
      return ojsApi.getUserGroupsMap()
        .then(function (map) {
          this.userGroupsMap = map || {}
        }.bind(this))
        .catch(function (error) {
          console.warn('Не удалось загрузить справочник групп пользователей:', error.message)
          this.userGroupsMap = {
            25: 'Автор',
            26: 'Рецензент',
            16: 'Редактор',
            17: 'Главный редактор',
            1: 'Администратор',
            27: 'Секретарь'
          }
        }.bind(this))
    },

    getRoleNameById: function (groupId) {
      var numId = typeof groupId === 'string' ? parseInt(groupId, 10) : groupId
      return this.userGroupsMap[numId] || ('Группа ' + groupId)
    },

    getUserRoles: function (userGroupIds) {
      var ids = Array.isArray(userGroupIds) ? userGroupIds : []
      return ids.map(function (id) {
        return this.getRoleNameById(id)
      }.bind(this))
    },

    getRoleType: function (role) {
      return ROLE_TYPES[role] || null
    },

    loadUsers: function () {
      this.loading = true
      var offset = (this.currentPage - 1) * this.pageSize
      ojsApi.getUsersDirect({
        count: this.pageSize,
        offset: offset,
        search: this.searchQuery || undefined
      })
        .then(function (response) {
          var items = Array.isArray(response && response.items) ? response.items : []
          this.totalItems = (response && (response.totalItems || response.total || response.itemsMax)) || items.length

          this.users = items.map(function (u) {
            var userGroupIds = []
            var roles = []

            if (Array.isArray(u.groups) && u.groups.length > 0) {
              userGroupIds = u.groups.map(function (g) { return g.id })
              roles = u.groups.map(function (g) {
                if (typeof g.name === 'object') {
                  return g.name.ru || g.name.en || g.name[Object.keys(g.name)[0]] || ''
                }
                return g.name || ''
              }).filter(Boolean)
            } else if (Array.isArray(u.userGroupIds) && u.userGroupIds.length > 0) {
              userGroupIds = u.userGroupIds
              roles = this.getUserRoles(userGroupIds)
            } else if (Array.isArray(u.roles) && u.roles.length > 0) {
              roles = u.roles.map(function (r) {
                return typeof r === 'string' ? r : (r && (r.name || r.role) || '')
              }).filter(Boolean)
            }

            var contexts = u.contexts
            return {
              id: u.id,
              username: u.username || u.userName || '',
              email: u.email || '',
              givenName: this.extractMultilingual(u.givenName),
              familyName: this.extractMultilingual(u.familyName),
              affiliation: this.extractAffiliation(u.affiliation),
              enabled: u.disabled === undefined ? (u.enabled !== false) : !u.disabled,
              journal: (contexts && contexts[0] && contexts[0].title) || u.journal || '',
              roles: roles,
              userGroupIds: userGroupIds
            }
          }.bind(this))
        }.bind(this))
        .catch(function (error) {
          this.$message.error(error.message || 'Ошибка загрузки пользователей')
        }.bind(this))
        .finally(function () {
          this.loading = false
        }.bind(this))
    },

    handleSearch: function () {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(function () {
        this.currentPage = 1
        this.loadUsers()
      }.bind(this), 300)
    },

    handlePageChange: function (page) {
      this.currentPage = page
      this.loadUsers()
    },

    handleSizeChange: function (size) {
      this.pageSize = size
      this.currentPage = 1
      this.loadUsers()
    },

    showAddDialog: function () {
      this.dialogTitle = 'Добавить пользователя'
      this.form = {
        id: null,
        username: '',
        email: '',
        givenName: '',
        familyName: '',
        password: '',
        affiliation: '',
        userGroupIds: [25]
      }
      this.dialogVisible = true
    },

    handleEdit: function (row) {
      this.dialogTitle = 'Редактировать пользователя'
      this.form = {
        id: row.id,
        username: row.username,
        email: row.email,
        givenName: row.givenName,
        familyName: row.familyName,
        password: '',
        affiliation: this.extractAffiliation(row.affiliation),
        userGroupIds: Array.isArray(row.userGroupIds) ? row.userGroupIds.slice() : []
      }
      this.dialogVisible = true
    },

    handleDelete: function (row) {
      this.$confirm('Вы уверены, что хотите удалить пользователя?', 'Подтверждение', {
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        type: 'warning'
      })
        .then(function () {
          return ojsApi.deleteUser(row.id)
        })
        .then(function () {
          this.$message.success('Пользователь удалён')
          this.loadUsers()
        }.bind(this))
        .catch(function (error) {
          if (error !== 'cancel') {
            this.$message.error(error.message || 'Ошибка удаления пользователя')
          }
        }.bind(this))
    },

    handleSubmit: function () {
      if (!this.form.id && !this.form.password) {
        this.$message.error('Введите пароль')
        return
      }
      this.$refs.userFormRef.validate(function (valid) {
        if (!valid) return
        this.saving = true
        var data = Object.assign({}, this.form)
        var isEdit = !!data.id
        if (isEdit && !data.password) {
          delete data.password
        }
        var formId = data.id
        delete data.id

        var fields = ['givenName', 'familyName']
        fields.forEach(function (field) {
          if (typeof data[field] === 'string') {
            data[field] = { ru: data[field], en: '' }
          }
        })
        if (typeof data.affiliation === 'string') {
          data.affiliation = { ru: data.affiliation, en: '' }
        }

        var promise = isEdit
          ? ojsApi.updateUser(formId, data)
          : ojsApi.createUser(data)

        promise
          .then(function () {
            this.$message.success('Пользователь сохранён')
            this.dialogVisible = false
            this.loadUsers()
          }.bind(this))
          .catch(function (error) {
            this.$message.error(error.message || 'Ошибка сохранения')
          }.bind(this))
          .finally(function () {
            this.saving = false
          }.bind(this))
      }.bind(this))
    },

    handleRowClick: function (row) {
      this.handleEdit(row)
    }
  }
}
</script>

<style scoped lang="scss">
.users-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-xl);
  flex-wrap: wrap;

  .toolbar-left {
    flex: 1;
    min-width: 240px;
    max-width: 400px;
  }

  .toolbar-right {
    display: flex;
    gap: var(--space-sm);
  }
}

.search-input {
  :deep(.el-input__wrapper) {
    border-radius: var(--radius-base) !important;
  }
}

.table-card {
  :deep(.el-card__body) {
    padding: 0 !important;
  }
}

.username {
  font-weight: 600;
  color: var(--color-text-primary);
}

.email {
  color: var(--color-text-secondary);
}

.roles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.no-roles {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-border-light);
}
</style>
