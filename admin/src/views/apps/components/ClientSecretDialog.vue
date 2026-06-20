<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
    @close="handleClose"
  >
    <div class="secret-result">
      <!-- 安全提示 -->
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="security-tip"
      >
        <template #title>
          {{ $t('app.secretSecurityTip') }}
        </template>
      </el-alert>

      <!-- 凭证信息卡片 -->
      <div class="credential-card">
        <!-- 客户端 ID -->
        <div class="credential-item">
          <div class="credential-label">
            <el-icon><Key /></el-icon>
            <span>{{ $t('app.clientId') }}</span>
          </div>
          <div class="credential-value">
            <code class="credential-code">{{ clientId }}</code>
            <el-button
              link
              type="primary"
              size="small"
              class="copy-btn"
              @click="handleCopy(clientId, 'clientId')"
            >
              <el-icon class="copy-icon" :class="{ copied: copiedField === 'clientId' }">
                <Check v-if="copiedField === 'clientId'" />
                <CopyDocument v-else />
              </el-icon>
              {{ copiedField === 'clientId' ? $t('app.copied') : $t('app.copy') }}
            </el-button>
          </div>
        </div>

        <el-divider class="credential-divider" />

        <!-- 客户端密钥 -->
        <div class="credential-item">
          <div class="credential-label">
            <el-icon><Lock /></el-icon>
            <span>{{ $t('app.clientSecret') }}</span>
          </div>
          <div class="credential-value">
            <code class="credential-code secret-code">{{ clientSecret }}</code>
            <el-button
              link
              type="primary"
              size="small"
              class="copy-btn"
              @click="handleCopy(clientSecret, 'clientSecret')"
            >
              <el-icon class="copy-icon" :class="{ copied: copiedField === 'clientSecret' }">
                <Check v-if="copiedField === 'clientSecret'" />
                <CopyDocument v-else />
              </el-icon>
              {{ copiedField === 'clientSecret' ? $t('app.copied') : $t('app.copy') }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 一键复制全部 -->
      <el-button
        type="primary"
        plain
        class="copy-all-btn"
        @click="handleCopyAll"
      >
        <el-icon><DocumentCopy /></el-icon>
        {{ $t('app.copyAll') }}
      </el-button>
    </div>

    <template #footer>
      <el-button type="primary" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Key, Lock, CopyDocument, Check, DocumentCopy } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: boolean
  clientId: string
  clientSecret: string
  title?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
})

const emits = defineEmits<Emits>()

/** 弹窗可见状态 */
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emits('update:modelValue', value),
})

/** 当前已复制的字段标识 */
const copiedField = ref<string>('')

/** 复制状态重置定时器 */
let copyTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 复制文本到剪贴板
 * @param text 待复制文本
 * @param field 字段标识
 */
const handleCopy = async (text: string, field: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    ElMessage.success(t('app.copiedToClipboard'))

    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedField.value = ''
    }, 2000)
  } catch (error) {
    ElMessage.error(t('app.copyFailed'))
  }
}

/**
 * 一键复制全部凭证
 */
const handleCopyAll = async () => {
  const text = `${t('app.clientId')}: ${props.clientId}\n${t('app.clientSecret')}: ${props.clientSecret}`
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = 'all'
    ElMessage.success(t('app.copiedToClipboard'))

    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedField.value = ''
    }, 2000)
  } catch (error) {
    ElMessage.error(t('app.copyFailed'))
  }
}

/**
 * 关闭弹窗
 */
const handleClose = () => {
  copiedField.value = ''
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
  emits('close')
}

/**
 * 确认按钮
 */
const handleConfirm = () => {
  emits('confirm')
  visible.value = false
}

watch(visible, (newVisible) => {
  if (!newVisible) {
    handleClose()
  }
})
</script>

<style scoped>
.secret-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.security-tip {
  margin: 0;
}

.credential-card {
  background: linear-gradient(135deg, #f6f9ff 0%, #fef6ff 100%);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.credential-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.credential-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.credential-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.credential-label .el-icon {
  font-size: 14px;
  color: #909399;
}

.credential-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 12px;
}

.credential-code {
  flex: 1;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  color: #303133;
  word-break: break-all;
  line-height: 1.6;
}

.secret-code {
  color: #000;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.copy-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.copy-icon {
  font-size: 14px;
  transition: color 0.2s ease;
}

.copy-icon.copied {
  color: #67c23a;
}

.credential-divider {
  margin: 16px 0;
}

.copy-all-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.copy-all-btn .el-icon {
  font-size: 16px;
}
</style>
