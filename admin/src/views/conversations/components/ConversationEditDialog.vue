<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑会话' : '新建会话'"
    width="600px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
      v-loading="loading"
    >
      <el-form-item label="会话类型" prop="conversationType">
        <el-select
          v-model="formData.conversationType"
          placeholder="请选择会话类型"
          :disabled="isEdit"
          style="width: 100%"
        >
          <el-option
            v-for="option in conversationTypeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="目标ID" prop="targetId">
        <el-input
          v-model="formData.targetId"
          placeholder="请输入目标ID（智能体ID/模型代码/知识库ID）"
          :disabled="isEdit"
        />
      </el-form-item>

      <el-form-item label="会话标题" prop="title">
        <el-input
          v-model="formData.title"
          placeholder="请输入会话标题（可选）"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="会话状态" prop="status" v-if="isEdit">
        <el-select v-model="formData.status" placeholder="请选择会话状态" style="width: 100%">
          <el-option
            v-for="option in conversationStatusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="用户ID" prop="uid">
        <el-input
          v-model="formData.uid"
          placeholder="请输入用户ID（可选）"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useConversationStore } from '@/stores/conversation'
import {
  Conversation,
  ConversationType,
  ConversationStatus,
  CreateConversationParams,
  UpdateConversationParams,
} from '@/api/conversation'

const conversationTypeOptions = [
  { label: '智能体对话', value: 'AGENT' as const },
  { label: '模型对话', value: 'MODEL' as const },
  { label: '知识库对话', value: 'KB_RAG' as const },
]

const conversationStatusOptions = [
  { label: '活跃', value: 'active' as const },
  { label: '已归档', value: 'archived' as const },
  { label: '已删除', value: 'deleted' as const },
]

interface Props {
  modelValue: boolean
  conversation?: Conversation | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const conversationStore = useConversationStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emits('update:modelValue', value),
})

const isEdit = computed(() => !!props.conversation)

const formData = ref<{
  conversationType: ConversationType
  targetId: string
  title: string
  status: ConversationStatus
  uid: string
}>({
  conversationType: 'AGENT' as ConversationType,
  targetId: '',
  title: '',
  status: 'active' as ConversationStatus,
  uid: '',
})

const rules: FormRules = {
  conversationType: [
    { required: true, message: '请选择会话类型', trigger: 'change' },
  ],
  targetId: [
    { required: true, message: '请输入目标ID', trigger: 'blur' },
  ],
}

const resetForm = () => {
  formData.value = {
    conversationType: 'AGENT' as ConversationType,
    targetId: '',
    title: '',
    status: 'active' as ConversationStatus,
    uid: '',
  }
  formRef.value?.clearValidate()
}

watch(
  () => props.conversation,
  (newConversation) => {
    if (newConversation) {
      formData.value = {
        conversationType: newConversation.conversationType,
        targetId: newConversation.targetId,
        title: newConversation.title || '',
        status: newConversation.status,
        uid: newConversation.uid || '',
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

const handleClose = () => {
  dialogVisible.value = false
  resetForm()
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    if (isEdit.value && props.conversation) {
      const updateData: UpdateConversationParams = {
        title: formData.value.title || undefined,
        status: formData.value.status,
      }
      await conversationStore.updateConversation(props.conversation.id, updateData)
      ElMessage.success('更新成功')
    } else {
      const createData: CreateConversationParams = {
        conversationType: formData.value.conversationType,
        targetId: formData.value.targetId,
        title: formData.value.title || undefined,
        uid: formData.value.uid || undefined,
      }
      await conversationStore.createConversation(createData)
      ElMessage.success('创建成功')
    }

    emits('success')
    handleClose()
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '创建失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
