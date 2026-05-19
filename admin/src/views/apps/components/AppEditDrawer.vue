<template>
  <el-drawer
    v-model="visible"
    :title="mode === 'create' ? $t('app.createAppTitle') : $t('app.editAppTitle')"
    direction="rtl"
    size="600px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="top"
    >
      <el-form-item :label="$t('app.appName')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('app.pleaseInputAppName')" />
      </el-form-item>

      <el-form-item :label="$t('app.appCode')" prop="code">
        <el-input
          v-model="form.code"
          :placeholder="$t('app.pleaseInputAppCode')"
          :disabled="mode === 'edit'"
        />
      </el-form-item>

      <el-divider content-position="left">{{ $t('app.quotaLimit') }}</el-divider>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item :label="$t('app.qpsLimitLabel')" prop="qpsLimit">
            <el-input-number
              v-model="form.qpsLimit"
              :min="1"
              :max="10000"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('app.dailyCallLimit')" prop="dailyLimit">
            <el-input-number
              v-model="form.dailyLimit"
              :min="1"
              :max="1000000"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('app.tokenQuotaMonth')" prop="tokenLimit">
        <el-input-number
          v-model="form.tokenLimit"
          :min="1"
          :max="100000000"
          style="width: 100%"
        />
      </el-form-item>

      <el-divider content-position="left">{{ $t('app.oauthConfig') }}</el-divider>

      <el-form-item :label="$t('app.enableOAuth')">
        <el-switch v-model="form.enableOAuth" />
        <div class="form-tip">{{ $t('app.enableOAuthTip') }}</div>
      </el-form-item>

      <el-divider content-position="left">{{ $t('app.statusSetting') }}</el-divider>

      <el-form-item :label="$t('app.enableStatus')">
        <el-switch v-model="form.status" />
      </el-form-item>

      <el-form-item :label="$t('app.expireTime')">
        <el-date-picker
          v-model="form.expireAt"
          type="datetime"
          :placeholder="$t('app.selectExpireTime')"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'create' ? $t('app.create') : $t('app.save') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { appApi, type App, type AppForm } from '@/api/app'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: boolean
  app: App | null
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

const form = reactive<AppForm>({
  name: '',
  code: '',
  qpsLimit: 100,
  dailyLimit: 10000,
  tokenLimit: 1000000,
  enableOAuth: false,
  status: true,
  expireAt: undefined,
})

const rules: FormRules = {
  name: [
    { required: true, message: t('app.appNameRequired'), trigger: 'blur' },
    { max: 100, message: t('app.appNameMaxLength'), trigger: 'blur' },
  ],
  code: [
    { required: true, message: t('app.appCodeRequired'), trigger: 'blur' },
    { max: 50, message: t('app.appCodeMaxLength'), trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9-_]*$/, message: t('app.appCodePattern'), trigger: 'blur' },
  ],
  qpsLimit: [
    { required: true, message: t('app.qpsLimitRequired'), trigger: 'blur' },
  ],
  dailyLimit: [
    { required: true, message: t('app.dailyLimitRequired'), trigger: 'blur' },
  ],
  tokenLimit: [
    { required: true, message: t('app.tokenLimitRequired'), trigger: 'blur' },
  ],
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.app && props.mode === 'edit') {
        Object.assign(form, {
          name: props.app.name,
          code: props.app.code,
          qpsLimit: props.app.qpsLimit,
          dailyLimit: props.app.dailyLimit,
          tokenLimit: props.app.tokenLimit,
          enableOAuth: props.app.enableOAuth,
          status: props.app.status,
          expireAt: props.app.expireAt || undefined,
        })
      } else {
        resetForm()
      }
    }
  }
)

const resetForm = () => {
  Object.assign(form, {
    name: '',
    code: '',
    qpsLimit: 100,
    dailyLimit: 10000,
    tokenLimit: 1000000,
    enableOAuth: false,
    status: true,
    expireAt: undefined,
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
    const data = {
      ...form,
      expireAt: form.expireAt ? new Date(form.expireAt).toISOString() : undefined,
    }

    if (props.mode === 'create') {
      await appApi.create(data)
      ElMessage.success(t('app.createAppSuccess'))
    } else if (props.app) {
      await appApi.update(props.app.id, data)
      ElMessage.success(t('app.updateAppSuccess'))
    }

    emit('success')
    handleClose()
  } catch (error) {
    console.error('提交失败:', error)
    if (props.mode === 'create') {
      ElMessage.error(t('app.createAppFailed'))
    } else {
      ElMessage.error(t('app.updateAppFailed'))
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
