<template>
  <el-dialog :model-value="modelValue" :title="$t('app.resetSecretTitle')" width="520px" :close-on-click-modal="false"
    @update:model-value="handleVisibleChange" @closed="handleClosed">
    <!-- 阶段一：确认重置 -->
    <div v-if="stage === 'confirm'">
      <el-alert type="warning" :closable="false" show-icon class="reset-alert">
        <template #title>{{ $t('app.resetAffectTip') }}</template>
      </el-alert>

      <div class="app-info">
        <span class="app-info-label">{{ $t('app.appName') }}</span>
        <span class="app-info-value">{{ app?.name }}</span>
        <span class="app-info-code">{{ app?.code }}</span>
      </div>
    </div>

    <!-- 阶段二：展示新密钥（仅此一次） -->
    <div v-else>
      <el-alert type="warning" :closable="false" show-icon class="reset-alert">
        <template #title>{{ $t('app.secretSecurityTip') }}</template>
      </el-alert>

      <div class="key-item">
        <span class="key-label">{{ $t('app.newApiKey') }}</span>
        <div class="key-value-row">
          <code class="key-value">{{ resultData.apiKey }}</code>
          <el-button link type="primary" @click="copyToClipboard(resultData.apiKey)">
            {{ $t('app.copy') }}
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="stage === 'confirm'">
        <el-button @click="handleVisibleChange(false)">{{ $t('common.cancel') }}</el-button>
        <el-button type="warning" :loading="submitting" @click="handleConfirm">
          {{ $t('app.resetSecret') }}
        </el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="handleVisibleChange(false)">{{ $t('app.saved') }}</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { appApi, type App, type ResetSecretResponse } from '../../../api/app'

const props = defineProps<{
  modelValue: boolean
  app: App | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const { t } = useI18n()

const stage = ref<'confirm' | 'result'>('confirm')
const submitting = ref(false)
const resultData = ref<ResetSecretResponse>({ id: '', apiKey: '' })

/**
 * 处理对话框显隐
 * @param value 是否可见
 */
const handleVisibleChange = (value: boolean) => {
  emit('update:modelValue', value)
}

/**
 * 对话框关闭后重置内部状态
 */
const handleClosed = () => {
  stage.value = 'confirm'
  submitting.value = false
  resultData.value = { id: '', apiKey: '' }
}

/**
 * 确认重置密钥
 */
const handleConfirm = async () => {
  if (!props.app) return
  submitting.value = true
  try {
    const { data } = await appApi.resetSecret(props.app.id)
    resultData.value = data.data
    stage.value = 'result'
    emit('success')
  } catch (error) {
    console.error('重置密钥失败:', error)
    ElMessage.error(t('app.resetSecretFailed'))
  } finally {
    submitting.value = false
  }
}

/**
 * 复制密钥到剪贴板
 * @param text 要复制的文本
 */
const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
  ElMessage.success(t('app.copiedToClipboard'))
}
</script>

<style scoped lang="scss">
.reset-alert {
  margin-bottom: 16px;
}

.app-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;

  .app-info-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .app-info-value {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .app-info-code {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}

.key-item {
  padding: 12px 16px;
  margin-bottom: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  .key-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .key-value-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .key-value {
      flex: 1;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      color: var(--el-text-color-primary);
      word-break: break-all;
    }
  }
}
</style>
