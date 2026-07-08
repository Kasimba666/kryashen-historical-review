<template>
  <div class="users-page">
    <div class="page-header">
      <h1 class="page-title">Управление пользователями</h1>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        Добавить пользователя
      </el-button>
    </div>

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
          <el-table-column label="Аффилиация" min-width="150">
            <template #default="scope">
              {{ getFieldName(scope.row.affiliation) }}
            </template>
          </el-table-column>
          <el-table-column label="Роль" min-width="200">
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
            </template>
          </el-table-column>
          <el-table-column label="Действия" width="150">
            <template #default="scope">
              <el-button 
                size="small" 
                @click="openEditDialog(scope.row)"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="handleDelete(scope.row.id)"
                :disabled="scope.row.userName === 'ojs'"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-skeleton>

    <!-- Диалог добавления/редактирования -->
    <el-dialog v-model="dialogVisible" :title="isEditMode ? 'Редактировать пользователя' : 'Добавить пользователя'">
      <el-form :model="userForm" label-width="100px">
        <el-form-item label="Имя пользователя" required>
          <el-input v-model="userForm.userName" :disabled="isEditMode && userForm.userName === 'ojs'" />
        </el-form-item>
        <el-form-item label="Email" required>
          <el-input v-model="userForm.email" type="email" :disabled="isEditMode && userForm.userName === 'ojs'" />
        </el-form-item>
        <el-form-item label="Пароль" :required="!isEditMode">
          <el-input v-model="userForm.password" type="password" />
        </el-form-item>
        <el-form-item label="Фамилия">
          <el-input v-model="userForm.familyName" />
        </el-form-item>
        <el-form-item label="Имя">
          <el-input v-model="userForm.givenName" />
        </el-form-item>
        <el-form-item label="Аффилиация">
          <el-input v-model="userForm.affiliation" />
        </el-form-item>
        <el-form-item label="Роль" v-if="!isEditMode || userForm.userName !== 'ojs'">
          <el-select v-model="userForm.roleId" placeholder="Выберите роль">
            <el-option label="Journal Manager (админ)" :value="16" />
            <el-option label="Editor (редактор)" :value="17" />
            <el-option label="Reviewer (рецензент)" :value="4096" />
            <el-option label="Author (автор)" :value="65536" />
            <el-option label="Reader (читатель)" :value="1048576" />
          </el-select>
        </el-form-item>
        <el-alert 
          v-if="isEditMode && userForm.userName === 'ojs'" 
          title="Пользователь ojs имеет наивысший уровень доступа и его права изменить нельзя" 
          type="info" 
          :closable="false"
        />
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">Отмена</el-button>
        <el-button type="primary" @click="saveUser">Сохранить</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { getUsers, createUser, updateUser, deleteUser, addUserToGroup, removeUserFromGroup, getContexts } from '@/services/ojs'
import { useAuth } from '@/composables/useAuth'

// Словарь ролей
var ROLE_NAMES = {
  16: 'Journal Manager',
  17: 'Editor',
  4096: 'Reviewer',
  65536: 'Author',
  1048576: 'Reader'
}

// ID контекста журнала (загружается динамически)
var CONTEXT_ID = null

export default {
  name: 'UsersPage',
  components: {
    Plus,
    Edit,
    Delete
  },
  data() {
    return {
      users: [],
      loading: false,
      dialogVisible: false,
      isEditMode: false,
      userForm: {
        id: null,
        userName: '',
        email: '',
        password: '',
        familyName: '',
        givenName: '',
        affiliation: '',
        roleId: 65536
      }
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
          this.users = data.map(function(user) {
            if (user.groups && user.groups.length > 0) {
              user.roleId = user.groups[0].roleId
              user.groupId = user.groups[0].id
            }
            return user
          })
        }.bind(this))
        .catch(function(error) {
          console.error('Ошибка загрузки пользователей', error)
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
        // Приоритет: en > ru > первый доступный
        return field.en || field.ru || field.default || Object.values(field)[0] || ' '
      }
      return ' '
    },
    
    getUserRoles(user) {
      if (!user.groups || user.groups.length === 0) return []
      return user.groups.map(function(group) {
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
    
    openCreateDialog() {
      this.isEditMode = false
      this.resetForm()
      this.dialogVisible = true
    },
    
    openEditDialog(user) {
      this.isEditMode = true
      this.userForm = {
        id: user.id,
        userName: user.userName || '',
        email: user.email || '',
        password: '',
        familyName: this.getFieldName(user.familyName),
        givenName: this.getFieldName(user.givenName),
        affiliation: this.getFieldName(user.affiliation),
        roleId: user.roleId || 65536,
        groupId: user.groupId
      }
      this.dialogVisible = true
    },
    
    saveUser() {
      if (this.isEditMode) {
        this.updateUser()
      } else {
        this.createUser()
      }
    },
    
    createUser() {
      var self = this
      var userData = {
        userName: this.userForm.userName,
        email: this.userForm.email,
        password: this.userForm.password,
        familyName: this.userForm.familyName,
        givenName: this.userForm.givenName,
        affiliation: this.userForm.affiliation
      }
      
      createUser(userData)
        .then(function(response) {
          // После создания назначаем роль
          return addUserToGroup(response.id, CONTEXT_ID, self.userForm.roleId)
        })
        .then(function() {
          self.$message && self.$message.success('Пользователь создан')
          self.loadUsers()
          self.dialogVisible = false
          self.resetForm()
        })
        .catch(function(error) {
          console.error('Ошибка создания пользователя', error)
          self.$message && self.$message.error(error.message)
        })
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
          console.error('Ошибка загрузки контекста журнала', error)
        })
    },

    updateUser() {
      var self = this
      var updateData = {
        userName: this.userForm.userName,
        email: this.userForm.email,
        familyName: this.userForm.familyName,
        givenName: this.userForm.givenName,
        affiliation: this.userForm.affiliation
      }
      
      if (this.userForm.password) {
        updateData.password = this.userForm.password
      }
      
      var oldGroupId = self.userForm.groupId
      var newRoleId = self.userForm.roleId
      
      updateUser(this.userForm.id, updateData)
        .then(function() {
          // Обновляем роль если изменилась
          if (newRoleId && oldGroupId && CONTEXT_ID) {
            return removeUserFromGroup(self.userForm.id, oldGroupId)
              .then(function() {
                return addUserToGroup(self.userForm.id, CONTEXT_ID, newRoleId)
              })
          }
        })
        .then(function() {
          self.$message && self.$message.success('Пользователь обновлён')
          self.loadUsers()
          self.dialogVisible = false
          self.resetForm()
        })
        .catch(function(error) {
          console.error('Ошибка обновления пользователя', error)
          self.$message && self.$message.error(error.message)
        })
    },
    
    handleDelete(id) {
      var self = this
      this.$confirm && this.$confirm('Вы уверены?', 'Удаление пользователя', {
        type: 'warning'
      })
        .then(function() {
          return deleteUser(id)
        })
        .then(function() {
          self.$message && self.$message.success('Пользователь удалён')
          self.loadUsers()
        })
        .catch(function(error) {
          if (error !== 'cancel') {
            console.error('Ошибка удаления пользователя', error)
            self.$message && self.$message.error(error.message)
          }
        })
    },
    
    resetForm() {
      this.isEditMode = false
      this.userForm = {
        id: null,
        userName: '',
        email: '',
        password: '',
        familyName: '',
        givenName: '',
        affiliation: '',
        roleId: 65536,
        groupId: null
      }
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
</style>