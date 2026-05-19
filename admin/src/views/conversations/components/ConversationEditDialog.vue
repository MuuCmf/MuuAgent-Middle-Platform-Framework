<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? $t('conversation.editConversation') : $t('conversation.createConversation')"
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
      <el-form-item :label="$t('conversation.conversationType')" prop="conversationType">
        <el-select
          v-model="formData.conversationType"
          :placeholder="$t('conversation.pleaseSelectConversationType')"
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

      <el-form-item :label="$t('conversation.targetId')" prop="targetId">
        <el-input
          v-model="formData.targetId"
          :placeholder="$t('conversation.pleaseInputTargetId')"
          :disabled="isEdit"
        />
      </el-form-item>

      <el-form-item :label="$t('conversation.conversationTitle')" prop="title">
        <el-input
          v-model="formData.title"
          :placeholder="$t('conversation.pleaseInputConversationTitle')"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="$t('conversation.conversationStatus')" prop="status" v-if="isEdit">
        <el-select v-model="formData.status" :placeholder="$t('conversation.pleaseSelectConversationStatus')" style="width: 100%">
          <el-option
            v-for="option in conversationStatusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('conversation.userId')" prop="uid">
        <el-input
          v-model="formData.uid"
          :placeholder="$t('conversation.pleaseInputUserId')"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          {{ $t('common.confirm') }}
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const conversationTypeOptions = [
  { label: t('conversation.agentConversation'), value: 'AGENT' as const },
  { label: t('conversation.modelConversation'), value: 'MODEL' as const },
  { label: t('conversation.kbConversation'), value: 'KB_RAG' as const },
]

const conversationStatusOptions = [
  { label: t('conversation.active'), value: 'active' as const },
  { label: t('conversation.archived'), value: 'archived' as const },
  { label: t('conversation.deleted'), value: 'deleted' as const },
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
    { required: true, message: t('conversation.pleaseSelectConversationType'), trigger: 'change' },
  ],
  targetId: [
    { required: true, message: t('conversation.pleaseInputTargetId'), trigger: 'blur' },
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
      ElMessage.success(t('conversation.updateSuccess'))
    } else {
      const createData: CreateConversationParams = {
        conversationType: formData.value.conversationType,
        targetId: formData.value.targetId,
        title: formData.value.title || undefined,
        uid: formData.value.uid || undefined,
      }
      await conversationStore.createConversation(createData)
      ElMessage.success(t('conversation.createSuccess'))
    }

    emits('success')
    handleClose()
  } catch (error) {
    ElMessage.error(isEdit.value ? t('conversation.updateFailed') : t('conversation.createFailed'))
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
