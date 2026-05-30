<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>{{ $t('user.platformTitle') }}</h1>
        <p>{{ $t('user.loginPrompt') }}</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            :placeholder="$t('user.pleaseInputUsername')"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            :placeholder="$t('user.pleaseInputPassword')"
            prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-button"
            @click="handleLogin"
          >
            {{ $t('user.login') }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="login-footer">
        <p>{{ $t('user.defaultAccount') }}</p>
        <p>{{ $t('user.changePasswordPrompt') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { clearCachedToken } from '@/utils/request'
import { adminApi } from '@/api/admin'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const router = useRouter()
const loginFormRef = ref<FormInstance>()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules: FormRules = {
  username: [
    { required: true, message: t('user.pleaseInputUsername'), trigger: 'blur' }
  ],
  password: [
    { required: true, message: t('user.pleaseInputPassword'), trigger: 'blur' },
    { min: 6, message: t('user.passwordMinLength'), trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const { data } = await adminApi.login({
          username: loginForm.username,
          password: loginForm.password,
        })
        const { accessToken, refreshToken, admin } = data.data
        
        localStorage.setItem('admin_token', accessToken)
        localStorage.setItem('admin_refresh_token', refreshToken)
        localStorage.setItem('admin_user', JSON.stringify(admin))

        clearCachedToken()

        ElMessage.success(t('user.loginSuccess'))
        router.push('/')
      } catch (error) {
        console.error('登录失败:', error)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped lang="scss">
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f0f2f5;
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
  
  h1 {
    font-size: 24px;
    color: #333;
    margin-bottom: 10px;
  }
  
  p {
    color: #666;
    font-size: 14px;
  }
}

.login-form {
  .login-button {
    width: 100%;
  }
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  
  p {
    color: #999;
    font-size: 12px;
    margin: 5px 0;
  }
}
</style>
