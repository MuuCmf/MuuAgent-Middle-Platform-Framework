<template>
  <el-drawer
    v-model="visible"
    :title="mode === 'create' ? '新建应用' : '编辑应用'"
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
      <el-form-item label="应用名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入应用名称" />
      </el-form-item>

      <el-form-item label="应用标识" prop="code">
        <el-input
          v-model="form.code"
          placeholder="请输入应用标识（唯一）"
          :disabled="mode === 'edit'"
        />
      </el-form-item>

      <el-divider content-position="left">配额限制</el-divider>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="QPS限制" prop="qpsLimit">
            <el-input-number
              v-model="form.qpsLimit"
              :min="1"
              :max="10000"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="每日调用限制" prop="dailyLimit">
            <el-input-number
              v-model="form.dailyLimit"
              :min="1"
              :max="1000000"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="Token配额（月）" prop="tokenLimit">
        <el-input-number
          v-model="form.tokenLimit"
          :min="1"
          :max="100000000"
          style="width: 100%"
        />
      </el-form-item>

      <el-divider content-position="left">OAuth配置</el-divider>

      <el-form-item label="启用OAuth">
        <el-switch v-model="form.enableOAuth" />
        <div class="form-tip">启用后可绑定OAuth客户端实现第三方授权</div>
      </el-form-item>

      <el-divider content-position="left">状态设置</el-divider>

      <el-form-item label="启用状态">
        <el-switch v-model="form.status" />
      </el-form-item>

      <el-form-item label="过期时间">
        <el-date-picker
          v-model="form.expireAt"
          type="datetime"
          placeholder="选择过期时间"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'create' ? '创建' : '保存' }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { appApi, type App, type AppForm } from '@/api/app'

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
    { required: true, message: '请输入应用名称', trigger: 'blur' },
    { max: 100, message: '应用名称不能超过100个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入应用标识', trigger: 'blur' },
    { max: 50, message: '应用标识不能超过50个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9-_]*$/, message: '应用标识必须以字母开头，只能包含字母、数字、中划线和下划线', trigger: 'blur' },
  ],
  qpsLimit: [
    { required: true, message: '请输入QPS限制', trigger: 'blur' },
  ],
  dailyLimit: [
    { required: true, message: '请输入每日调用限制', trigger: 'blur' },
  ],
  tokenLimit: [
    { required: true, message: '请输入Token配额', trigger: 'blur' },
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
      ElMessage.success('创建成功')
    } else if (props.app) {
      await appApi.update(props.app.id, data)
      ElMessage.success('保存成功')
    }

    emit('success')
    handleClose()
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('操作失败')
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
