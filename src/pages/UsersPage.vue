<template>
  <div class="users-page">
    <div class="page-header">
      <h1 class="page-title">Управление пользователями</h1>
    </div>

    <el-alert
      title="Данные пользователей и роли управляются в админке OJS. Здесь можно только просматривать пользователей и назначать им дополнительные роли."
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
    />

    <el-skeleton :loading="loading" animated :count="5">
      <template #default>
        <el-table :data="users" stripe style="width: 100%">
          <el-table-column prop="userName" label="Имя пользователя" min-width="150" />
          <el-table-column prop="email" label="Email" min-width="200" />
          <el-table-column label="Фамилия" min-width="120">
            <template #default="scope">
              {{ getFieldName(scope.row.familyName) }}
            </template>
          </el-table-column>
          <el-table-column label="Имя" min-width="120">
            <template #default="scope">
              {{ getFieldName(scope.row.givenName) }}
            </template>
          </el-table-column>
          <el-table-column label="Роли" min-width="220">
            <template #default="scope">
              <el-tag 
                v-for="role in getUserRoles(scope.row)" 
                :key="role.roleId"
                size="small" 
                :type="getRoleTagType(role.roleId)"
                style="margin-right: 4px; margin-bottom: 4px;"
              >
                {{ getRoleName(role.roleId) }}
              </el-tag>
              <span v-if="getUserRoles(scope.row).length === 0" class="no-roles">Нет ролей</span>
            </template>
          </el-table-column>
          <el-table-column label="Действия" width="120">
            <template #default="scope">
              <el-button 
                size="small"
                @click="openAddRoleDialog(scope.row)"
                :disabled="scope.row.userName === 'ojs'"
                :title="scope.row.userName === 'ojs' ? 'Пользователю ojs нельзя назначать роли' : 'Назначить роль'"
              >
                <el-icon><Plus /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-skeleton>

    <!-- Диалог назначения роли -->
    <el-dialog v-model="dialogVisible" title="Назначить роль" width="400px">
      <el-form label-width="100px">
        <el-form-item label="Пользователь">
          <span class="dialog-user-name">{{ dialogUser?.userName || dialogUser?.email }}</span>
        </el-form-item>
        <el-form-item label="Роль">
          <el-select v-model="selectedRoleId" placeholder="Выберите роль" style="width: 100%;">
            <el-option 
              v-for="role in availableRolesForUser" 
              :key="role.id" 
              :label="role.label" 
              :value="role.id"
            />
          </el-select>
          <div v-if="availableRolesForUser.length === 0" class="no-available-roles">
            Пользователь уже имеет все доступные роли
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">Отмена</el-button>
        <el-button 
          type="primary" 
          @click="assignRole"
          :disabled="!selectedRoleId || assigning"
          :loading="assigning"
        >
          Назначить
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { Plus } from '@element-plus/icons-vue'
import { getUsers, addUserToGroup, getContexts } from '@/services/ojs'
import { useAuth } from '@/composables/useAuth'

// Все доступные роли (только те, что знает наша система)
var KNOWN_ROLE_IDS = [16, 17, 4096, 65536, 1048576]

var ROLE_NAMES = {
  16: 'Journal Manager',
  17: 'Editor',
  4096: 'Reviewer',
  65536: 'Author',
  1048576: 'Reader'
}

var ROLE_LABELS = {
  16: 'Journal Manager (админ)',
  17: 'Editor (редактор)',
  4096: 'Reviewer (рецензент)',
  65536: 'Author (автор)',
  1048576: 'Reader (читатель)'
}

var ALL_ROLES = [
  { id: 16, label: ROLE_LABELS[16] },
  { id: 17, label: ROLE_LABELS[17] },
  { id: 4096, label: ROLE_LABELS[4096] },
  { id: 65536, label: ROLE_LABELS[65536] },
  { id: 1048576, label: ROLE_LABELS[1048576] }
]

// ID контекста журнала (загружается динамически)
var CONTEXT_ID = null

export default {
  name: 'UsersPage',
  components: {
    Plus
  },
  data() {
    return {
      users: [],
      loading: false,
      dialogVisible: false,
      dialogUser: null,
      selectedRoleId: null,
      assigning: false
    }
  },
  computed: {
    // Доступные роли для выбранного пользователя (те, которых у него ещё нет)
    availableRolesForUser: function () {
      if (!this.dialogUser || !this.dialogUser.groups) return ALL_ROLES
      // Учитываем только известные роли для определения доступных
      var existingRoleIds = []
      this.dialogUser.groups.forEach(function (g) {
        if (KNOWN_ROLE_IDS.indexOf(g.roleId) !== -1 && existingRoleIds.indexOf(g.roleId) === -1) {
          existingRoleIds.push(g.roleId)
        }
      })
      return ALL_ROLES.filter(function (r) {
        return existingRoleIds.indexOf(r.id) === -1
      })
    }
  },
  mounted() {
    this.loadContextId()
    this.loadUsers()
  },
  methods: {
    loadUsers() {
      this.loading = true
      getUsers()
        .then(function(data) {
          this.users = data
        }.bind(this))
        .catch(function(error) {
          this.$message && this.$message.error('Не удалось загрузить пользователей')
        }.bind(this))
        .finally(function() {
          this.loading = false
        }.bind(this))
    },
    
    getFieldName(field) {
      if (!field) return ' '
      if (typeof field === 'string') return field
      if (typeof field === 'object') {
        return field.en || field.ru || field.default || Object.values(field)[0] || ' '
      }
      return ' '
    },
    
    getUserRoles(user) {
      if (!user.groups || user.groups.length === 0) return []
      // Дедуплицируем по roleId и отфильтровываем неизвестные роли
      var seen = {}
      return user.groups
        .filter(function(group) {
          // Пропускаем только известные роли
          return KNOWN_ROLE_IDS.indexOf(group.roleId) !== -1
        })
        .filter(function(group) {
          // Дедупликация по roleId
          if (seen[group.roleId]) return false
          seen[group.roleId] = true
          return true
        })
        .map(function(group) {
          return { roleId: group.roleId, groupId: group.id }
        })
    },
    
    getRoleName(roleId) {
      return ROLE_NAMES[roleId] || 'Unknown'
    },
    
    getRoleTagType(roleId) {
      if (roleId === 16) return 'danger'
      if (roleId === 17) return 'warning'
      if (roleId === 4096) return 'info'
      return 'success'
    },
    
    loadContextId() {
      getContexts()
        .then(function(data) {
          var items = data.items || data
          if (items && items.length > 0) {
            CONTEXT_ID = items[0].id
          }
        }.bind(this))
        .catch(function(error) {
        })
    },
    
    openAddRoleDialog(user) {
      this.dialogUser = user
      this.selectedRoleId = null
      this.dialogVisible = true
    },
    
    assignRole() {
      if (!this.selectedRoleId || !this.dialogUser || !CONTEXT_ID) return
      
      this.assigning = true
      var self = this
      
      addUserToGroup(this.dialogUser.id, CONTEXT_ID, this.selectedRoleId)
        .then(function() {
          self.$message && self.$message.success('Роль назначена')
          self.dialogVisible = false
          self.selectedRoleId = null
          self.dialogUser = null
          self.loadUsers()
        })
        .catch(function(error) {
          self.$message && self.$message.error(error.message)
        })
        .finally(function() {
          self.assigning = false
        })
    }
  }
}
</script>

<style scoped lang="scss">
.users-page {
  width: 100%;
  padding: 0 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.no-roles {
  font-size: 0.85rem;
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.dialog-user-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.no-available-roles {
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>