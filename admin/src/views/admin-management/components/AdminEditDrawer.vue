<template>
  <el-drawer
    v-model="visible"
    :title="mode === 'create' ? $t('admin.createAdminTitle') : $t('admin.editAdminTitle')"
    direction="rtl"
    size="500px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      label-position="top"
    >
      <el-form-item :label="$t('admin.username')" prop="username">
        <el-input
          v-model="form.username"
          :placeholder="$t('admin.pleaseInputUsername')"
          :disabled="mode === 'edit'"
        />
      </el-form-item>

      <el-form-item v-if="mode === 'create'" :label="$t('admin.password')" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          :placeholder="$t('admin.pleaseInputPassword')"
          show-password
        />
      </el-form-item>

      <el-form-item :label="$t('admin.nickname')" prop="nickname">
        <el-input v-model="form.nickname" :placeholder="$t('admin.pleaseInputNickname')" />
      </el-form-item>

      <el-form-item :label="$t('admin.email')" prop="email">
        <el-input v-model="form.email" :placeholder="$t('admin.pleaseInputEmail')" />
      </el-form-item>

      <el-form-item :label="$t('admin.phone')" prop="phone">
        <el-input v-model="form.phone" :placeholder="$t('admin.pleaseInputPhone')" />
      </el-form-item>

      <el-form-item :label="$t('admin.role')" prop="role">
        <el-select v-model="form.role" :placeholder="$t('admin.pleaseSelectRole')" style="width: 100%">
          <el-option :label="$t('admin.roleAdmin')" value="admin" />
          <el-option :label="$t('admin.roleOps')" value="ops" />
          <el-option :label="$t('admin.roleRead')" value="read" />
        </el-select>
        <div class="role-description">
          <span v-if="form.role === 'admin'">{{ $t('admin.roleAdminDesc') }}</span>
          <span v-else-if="form.role === 'ops'">{{ $t('admin.roleOpsDesc') }}</span>
          <span v-else-if="form.role === 'read'">{{ $t('admin.roleReadDesc') }}</span>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'create' ? $t('admin.create') : $t('common.save') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { adminApi, type AdminUser, type CreateAdminForm, type UpdateAdminForm } from '@/api/admin'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: boolean
  admin: AdminUser | null
  mode: 'create' | 'edit'
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive<{
  username: string
  password: string
  nickname: string
  email: string
  phone: string
  role: string
}>({
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  role: 'ops',
})

const rules = computed<FormRules>(() => ({
  username: [
    { required: true, message: t('admin.pleaseInputUsername'), trigger: 'blur' },
    { min: 3, max: 30, message: t('admin.usernameLength'), trigger: 'blur' },
  ],
  password: props.mode === 'create'
    ? [
        { required: true, message: t('admin.pleaseInputPassword'), trigger: 'blur' },
        { min: 6, message: t('admin.passwordMinLength'), trigger: 'blur' },
      ]
    : [],
  email: [
    { type: 'email', message: t('admin.emailFormat'), trigger: 'blur' },
  ],
  role: [
    { required: true, message: t('admin.pleaseSelectRole'), trigger: 'change' },
  ],
}))

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.admin && props.mode === 'edit') {
        Object.assign(form, {
          username: props.admin.username,
          password: '',
          nickname: props.admin.nickname || '',
          email: props.admin.email || '',
          phone: props.admin.phone || '',
          role: props.admin.role,
        })
      } else {
        resetForm()
      }
    }
  }
)

const resetForm = () => {
  Object.assign(form, {
    username: '',
    password: '',
    nickname: '',
    email: '',
    phone: '',
    role: 'ops',
  })
  formRef.value?.clearValidate()
}

const handleClose = () => {
  visible.value = false
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    if (props.mode === 'create') {
      const data: CreateAdminForm = {
        username: form.username,
        password: form.password,
        nickname: form.nickname || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role,
      }
      await adminApi.create(data)
      ElMessage.success(t('common.createSuccess'))
    } else if (props.admin) {
      const data: UpdateAdminForm = {
        nickname: form.nickname || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role,
      }
      await adminApi.update(props.admin.id, data)
      ElMessage.success(t('common.updateSuccess'))
    }

    emit('success')
    handleClose()
  } catch (error) {
    console.error('提交失败:', error)
    if (props.mode === 'create') {
      ElMessage.error(t('common.createFailed'))
    } else {
      ElMessage.error(t('common.updateFailed'))
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.role-description {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
</style>
