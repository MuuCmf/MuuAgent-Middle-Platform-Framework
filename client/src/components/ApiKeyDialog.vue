<template>
  <el-dialog
    v-model="dialogVisible"
    title="模拟透传数据配置"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    align-center
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="API Key" prop="apiKey">
        <el-input
          v-model="form.apiKey"
          type="password"
          show-password
          placeholder="请输入 API Key"
        />
      </el-form-item>
      <el-form-item label="用户 ID" prop="uid">
        <el-input
          v-model="form.uid"
          placeholder="请输入用户 ID"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        确认
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { getApiKey, getUid, setApiKey, setUid } from '../utils/auth'

/**
 * 表单引用
 */
const formRef = ref<FormInstance>()

/**
 * 提交状态
 */
const submitting = ref(false)

/**
 * 弹窗显示状态
 */
const dialogVisible = ref(false)

/**
 * 确认回调
 */
let onConfirmCallback: (() => void) | null = null

/**
 * 表单数据
 */
const form = reactive({
  apiKey: '',
  uid: '',
})

/**
 * 表单校验规则
 */
const rules: FormRules = {
  apiKey: [
    { required: true, message: '请输入 API Key', trigger: 'blur' },
  ],
  uid: [
    { required: true, message: '请输入用户 ID', trigger: 'blur' },
  ],
}

/**
 * 初始化表单数据，从 localStorage 读取已有值
 */
function initForm(): void {
  form.apiKey = getApiKey()
  form.uid = getUid()
}

/**
 * 打开弹窗
 * @param onConfirm 确认后的回调
 */
function open(onConfirm?: () => void): void {
  initForm()
  onConfirmCallback = onConfirm || null
  dialogVisible.value = true
}

/**
 * 提交表单
 */
async function handleSubmit(): Promise<void> {
  if (!formRef.value) return

  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    setApiKey(form.apiKey)
    setUid(form.uid)
    dialogVisible.value = false
    onConfirmCallback?.()
  } finally {
    submitting.value = false
  }
}

defineExpose({ open })

onMounted(() => {
  initForm()
})
</script>
