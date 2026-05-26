<template>
  <el-container class="main-container">
    <el-header class="layouts-header">
      <Logo :isCollapsed="isCollapsed" :version="version" />
      <div class="header-actions">
        <LocaleSwitch />
        
        <el-divider direction="vertical" />
        
        <el-button @click="openClientPage" class="client-btn" text>
          <el-icon><Monitor /></el-icon>
          {{ $t('layout.client') }}
        </el-button>
        
        <el-divider direction="vertical" />
        
        <el-dropdown @command="handleCommand" class="user-dropdown">
          <div class="user-info">
            <el-avatar :size="32" class="user-avatar">
              {{ userInfo?.nickname?.charAt(0) || userInfo?.username?.charAt(0) || 'A' }}
            </el-avatar>
            <div class="user-details">
              <div class="user-name">{{ userInfo?.nickname || userInfo?.username || $t('layout.defaultRole') }}</div>
              <div class="user-role">{{ getRoleName(userInfo?.role) }}</div>
            </div>
            <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>
                {{ $t('layout.profile') }}
              </el-dropdown-item>
              <el-dropdown-item command="password">
                <el-icon><Lock /></el-icon>
                {{ $t('layout.changePassword') }}
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>
                {{ $t('layout.logout') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="mix-container">
      <el-aside class="layouts-aside" :width="isCollapsed ? '59px' : '219px'">
        <div class="aside-toggle" @click="toggleSidebar">
          <el-icon v-if="isCollapsed">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M402.666667 213.333333a42.666667 42.666667 0 0 1 30.293333 72.666667L261.333333 457.6a42.666667 42.666667 0 0 0 0 60.330667l171.733334 171.733333a42.666667 42.666667 0 0 1-60.330667 60.330667L201.130667 518.037333a42.666667 42.666667 0 0 1 0-60.330666L372.864 285.866667A42.666667 42.666667 0 0 1 402.666667 213.333333z m256 0a42.666667 42.666667 0 0 1 30.293333 72.666667L517.333333 457.6a42.666667 42.666667 0 0 0 0 60.330667l171.733334 171.733333a42.666667 42.666667 0 0 1-60.330667 60.330667L457.130667 518.037333a42.666667 42.666667 0 0 1 0-60.330666L628.864 285.866667A42.666667 42.666667 0 0 1 658.666667 213.333333z"/>
            </svg>
          </el-icon>
          <el-icon v-else>
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M621.333333 213.333333a42.666667 42.666667 0 0 1 30.293334 72.666667L479.957333 457.6a42.666667 42.666667 0 0 0 0 60.330667l171.733334 171.733333a42.666667 42.666667 0 0 1-60.330667 60.330667L419.754667 518.037333a42.666667 42.666667 0 0 1 0-60.330666L591.488 285.866667A42.666667 42.666667 0 0 1 621.333333 213.333333z m-256 0a42.666667 42.666667 0 0 1 30.293334 72.666667L223.957333 457.6a42.666667 42.666667 0 0 0 0 60.330667l171.733334 171.733333a42.666667 42.666667 0 0 1-60.330667 60.330667L163.754667 518.037333a42.666667 42.666667 0 0 1 0-60.330666L335.488 285.866667A42.666667 42.666667 0 0 1 365.333333 213.333333z"/>
            </svg>
          </el-icon>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="sidebar-menu"
          @select="handleMenuSelect"
          :collapse="isCollapsed"
        >
          <el-menu-item
            v-for="r in menuRoutes"
            :key="r.path"
            :index="getMenuIndex(r)"
          >
            <el-icon><component :is="r.meta?.icon" /></el-icon>
            <template #title>{{ r.meta?.title ? $t(r.meta.title as string) : '' }}</template>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view v-slot="{ Component, route }">
          <transition name="main" mode="out-in" appear>
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <el-dialog v-model="showPasswordDialog" :title="$t('layout.changePassword')" width="500px">
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item :label="$t('layout.oldPassword')" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            :placeholder="$t('layout.pleaseInputOldPassword')"
            show-password
          />
        </el-form-item>
        
        <el-form-item :label="$t('layout.newPassword')" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            :placeholder="$t('layout.pleaseInputNewPassword')"
            show-password
          />
        </el-form-item>
        
        <el-form-item :label="$t('layout.confirmPassword')" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            :placeholder="$t('layout.pleaseInputConfirmPassword')"
            show-password
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showPasswordDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="handleChangePassword">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Monitor, ArrowDown, User, Lock, SwitchButton } from '@element-plus/icons-vue'
import Logo from './components/Logo.vue'
import LocaleSwitch from '@/components/LocaleSwitch.vue'
import { userApi, type AdminUser } from '@/api/user'
import { clearCachedToken } from '@/utils/request'
import { useI18n } from 'vue-i18n'
import { versionApi } from '@/api/version'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const showPasswordDialog = ref(false)
const isCollapsed = ref(false)
const userInfo = ref<AdminUser | null>(null)
const passwordFormRef = ref<FormInstance>()
const passwordLoading = ref(false)
const version = ref<string>('')

const activeMenu = computed(() => route.path)

const menuRoutes = computed(() => {
  const mainRoute = router.options.routes.find(r => r.path === '/')
  const children = mainRoute?.children || []
  return children.filter(route => !route.meta?.hidden)
})

/**
 * 获取菜单索引
 * @param route 路由对象
 * @returns {string} 菜单索引
 */
const getMenuIndex = (route: any): string => {
  if (typeof route.redirect === 'string') {
    return route.redirect.replace(/^\//, '')
  }
  if (route.redirect && typeof route.redirect === 'object' && route.redirect.name) {
    const targetRoute = router.resolve({ name: route.redirect.name })
    return targetRoute.path.replace(/^\//, '')
  }
  return route.path
}

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (_rule: any, value: any, callback: any) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error(t('layout.passwordMismatch')))
  } else {
    callback()
  }
}

const passwordRules: FormRules = {
  oldPassword: [
    { required: true, message: t('layout.pleaseInputOldPassword'), trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: t('layout.pleaseInputNewPassword'), trigger: 'blur' },
    { min: 6, message: t('layout.passwordMinLength'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('layout.pleaseInputConfirmPassword'), trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const getRoleName = (role?: string) => {
  const roleMap: Record<string, string> = {
    admin: t('layout.roleAdmin'),
    ops: t('layout.roleOps'),
    read: t('layout.roleRead')
  }
  return roleMap[role || ''] || t('layout.defaultRole')
}

const handleMenuSelect = (index: string) => {
  router.push('/' + index)
}

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'profile':
      ElMessage.info(t('layout.featureInDevelopment'))
      break
    case 'password':
      showPasswordDialog.value = true
      break
    case 'logout':
      handleLogout()
      break
  }
}

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordLoading.value = true
      try {
        await userApi.changePassword({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
        
        ElMessage.success(t('layout.passwordChangeSuccess'))
        showPasswordDialog.value = false
        
        setTimeout(() => {
          userApi.logout()
          clearCachedToken()
          router.push('/login')
        }, 1500)
      } catch (error) {
        console.error(t('layout.passwordChangeFailed'), error)
      } finally {
        passwordLoading.value = false
      }
    }
  })
}

/**
 * 打开客户端页面
 */
const openClientPage = () => {
  window.open('/client', '_blank')
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm(
      t('layout.confirmLogout'),
      t('common.tip'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    userApi.logout()
    clearCachedToken()
    ElMessage.success(t('layout.logoutSuccess'))
    router.push('/login')
  } catch (error) {
    // 用户取消
  }
}

const loadUserInfo = () => {
  const storedUser = localStorage.getItem('admin_user')
  if (storedUser) {
    try {
      userInfo.value = JSON.parse(storedUser)
    } catch (error) {
      console.error('解析用户信息失败:', error)
    }
  }
}

/**
 * 加载版本号
 */
const loadVersion = async () => {
  try {
    const versionInfo = await versionApi.getVersion()
    version.value = versionInfo.version
  } catch (error) {
    console.error('获取版本号失败:', error)
  }
}

onMounted(() => {
  loadUserInfo()
  loadVersion()
})
</script>

<style lang="scss" scoped>
.main-container {
  min-width: 1200px;
  background-color: #f2f2f2;

  .layouts-header {
    display: flex;
    height: 50px;
    margin: 0;
    padding: 0;
    background-color: var(--el-color-white);
    border-bottom: 1px solid #eee;
    align-items: stretch;
    justify-content: space-between;
    overflow: hidden;

    .header-actions {
      display: flex;
      align-items: center;
      padding: 0 20px;

      .client-btn {
        margin-right: 10px;
      }

      .el-divider {
        margin: 0 15px;
      }

      .user-dropdown {
        cursor: pointer;
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 10px;
          border-radius: 4px;
          transition: background-color 0.3s;

          &:hover {
            background-color: #f5f7fa;
          }

          .user-avatar {
            background-color: var(--el-color-primary);
            color: white;
            font-weight: bold;
          }

          .user-details {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .user-name {
              font-size: 14px;
              font-weight: 500;
              color: #303133;
            }

            .user-role {
              font-size: 12px;
              color: #909399;
            }
          }

          .dropdown-icon {
            color: #909399;
            transition: transform 0.3s;
          }
        }
      }
    }
  }

  .mix-container {
    height: calc(100vh - 50px);

    .el-main {
      padding: 20px;
      overflow-y: auto;
    }

    .layouts-aside {
      background-color: #fff;
      border-right: 1px solid #EEE;
      overflow: hidden;
      transition: width 0.3s ease;

      .aside-toggle {
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        color: #909399;

        &:hover {
          background-color: #f5f7fa;
          color: var(--el-color-primary);
        }
      }

      .sidebar-menu {
        border-right: none;
        height: calc(100% - 40px);
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #ccc #fff;
      }
    }
  }
}

.main-enter-active,
.main-leave-active {
  transition: opacity 0.3s ease;
}

.main-enter-from,
.main-leave-to {
  opacity: 0;
}
</style>
