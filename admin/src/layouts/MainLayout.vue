<template>
  <el-container class="main-container">
    <el-header class="layouts-header">
      <Logo :isCollapsed="isCollapsed" />
      <div class="header-actions">
        <el-button @click="showHelp = true" class="help-btn" text>
          <el-icon><QuestionFilled /></el-icon>
          使用帮助
        </el-button>
        
        <el-divider direction="vertical" />
        
        <el-dropdown @command="handleCommand" class="user-dropdown">
          <div class="user-info">
            <el-avatar :size="32" class="user-avatar">
              {{ userInfo?.nickname?.charAt(0) || userInfo?.username?.charAt(0) || 'A' }}
            </el-avatar>
            <div class="user-details">
              <div class="user-name">{{ userInfo?.nickname || userInfo?.username || '管理员' }}</div>
              <div class="user-role">{{ getRoleName(userInfo?.role) }}</div>
            </div>
            <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon>
                个人信息
              </el-dropdown-item>
              <el-dropdown-item command="password">
                <el-icon><Lock /></el-icon>
                修改密码
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
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
            <template #title>{{ r.meta?.title }}</template>
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

    <el-dialog v-model="showHelp" title="📖 使用帮助" width="700px">
      <el-alert type="info" :closable="false" class="help-section">
        <template #title>
          <strong>🚀 快速开始</strong>
        </template>
        <ol class="help-list">
          <li><strong>添加模型</strong>：在「模型管理」中添加你的AI模型（如Ollama本地模型）</li>
          <li><strong>创建技能</strong>：在「技能管理」中定义智能体可以使用的工具</li>
          <li><strong>创建智能体</strong>：在「智能体」中创建具有特定能力的AI助手</li>
        </ol>
      </el-alert>

      <el-alert type="warning" :closable="false" class="help-section">
        <template #title>
          <strong>🔧 Ollama本地模型配置</strong>
        </template>
        <ul class="help-list">
          <li>API地址：<code>http://localhost:11434/api/chat</code></li>
          <li>模型标识：<code>llama3</code>、<code>qwen2</code> 等</li>
          <li>API密钥：留空</li>
        </ul>
      </el-alert>

      <el-alert type="success" :closable="false" class="help-section">
        <template #title>
          <strong>📡 API调用方式</strong>
        </template>
        <p>所有API请求需要在Header中携带API Key：</p>
        <pre class="code-block">x-api-key: AI-SVC-2026-MCP-KEY-666</pre>
      </el-alert>
    </el-dialog>

    <el-dialog v-model="showPasswordDialog" title="修改密码" width="500px">
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="请输入原密码"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="handleChangePassword">
          确定
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
import { QuestionFilled, ArrowDown, User, Lock, SwitchButton } from '@element-plus/icons-vue'
import Logo from './components/Logo.vue'
import { userApi, type AdminUser } from '@/api/user'
import { clearCachedToken } from '@/utils/request'

const router = useRouter()
const route = useRoute()

const showHelp = ref(false)
const showPasswordDialog = ref(false)
const isCollapsed = ref(false)
const userInfo = ref<AdminUser | null>(null)
const passwordFormRef = ref<FormInstance>()
const passwordLoading = ref(false)

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
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules: FormRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const getRoleName = (role?: string) => {
  const roleMap: Record<string, string> = {
    admin: '超级管理员',
    ops: '运维管理员',
    read: '只读用户'
  }
  return roleMap[role || ''] || '管理员'
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
      ElMessage.info('个人信息功能开发中')
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
        
        ElMessage.success('密码修改成功，请重新登录')
        showPasswordDialog.value = false
        
        setTimeout(() => {
          userApi.logout()
          clearCachedToken()
          router.push('/login')
        }, 1500)
      } catch (error) {
        console.error('修改密码失败:', error)
      } finally {
        passwordLoading.value = false
      }
    }
  })
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    userApi.logout()
    clearCachedToken()
    ElMessage.success('退出成功')
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

onMounted(() => {
  loadUserInfo()
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

      .help-btn {
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

.help-section {
  margin-bottom: 16px;
}

.help-list {
  margin: 8px 0 0 20px;
  line-height: 1.8;
}

.code-block {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  margin-top: 8px;
  font-family: 'Courier New', monospace;
  overflow-x: auto;
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
