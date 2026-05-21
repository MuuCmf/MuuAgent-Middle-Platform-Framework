<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(val: boolean) => emit('update:visible', val)"
    :title="t('skill.importDialog.title')"
    width="720px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- 步骤条 -->
    <el-steps :active="step" align-center style="margin-bottom: 24px;">
      <el-step :title="t('skill.importDialog.steps.upload')" />
      <el-step :title="t('skill.importDialog.steps.preview')" />
      <el-step :title="t('skill.importDialog.steps.securityScan')" />
      <el-step :title="t('skill.importDialog.steps.complete')" />
    </el-steps>

    <!-- Step 0: 上传 -->
    <div v-if="step === 0" class="step-content">
      <!-- 安全警告提示 -->
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px;"
      >
        <template #title>
          <strong>{{ t('skill.importDialog.securityWarning.title') }}</strong>
        </template>
        <template #default>
          <ul style="margin: 8px 0 0; padding-left: 20px;">
            <li>{{ t('skill.importDialog.securityWarning.risk1') }}</li>
            <li>{{ t('skill.importDialog.securityWarning.risk2') }}</li>
            <li>{{ t('skill.importDialog.securityWarning.risk3') }}</li>
          </ul>
          <p style="margin-top: 8px; color: #f56c6c; font-weight: 500;">{{ t('skill.importDialog.securityWarning.recommendation') }}</p>
        </template>
      </el-alert>

      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".zip"
        :before-upload="handleBeforeUpload"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        :exceed="handleExceed"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text" v-html="t('skill.importDialog.upload.dragText')"></div>
        <p class="upload-hint">{{ t('skill.importDialog.upload.hint') }}</p>
      </el-upload>

      <!-- 文件大小限制提示 -->
      <div v-if="uploadFile && fileSizeWarning" style="margin-top: 12px;">
        <el-alert
          :type="fileSizeWarning.type"
          :title="fileSizeWarning.title"
          :description="fileSizeWarning.description"
          :closable="false"
          show-icon
        />
      </div>

      <el-divider />

      <el-form label-width="100px" size="default">
        <el-form-item :label="t('skill.importDialog.form.targetApp')">
          <AppSelector v-model="targetAppCode" :placeholder="t('skill.importDialog.form.targetAppPlaceholder')" style="width: 100%;" />
        </el-form-item>
        <el-form-item :label="t('skill.importDialog.form.overwrite')">
          <el-switch v-model="overwrite" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px;">{{ t('skill.importDialog.form.overwriteHint') }}</span>
          <!-- 覆盖模式警告 -->
          <el-icon
            v-if="overwrite"
            :size="16"
            color="#f56c6c"
            style="margin-left: 4px; vertical-align: middle;"
            @click="showOverwriteWarning = true"
          >
            <WarningFilled />
          </el-icon>
        </el-form-item>
      </el-form>

      <!-- 覆盖模式警告弹窗 -->
      <el-dialog
        v-model="showOverwriteWarning"
        :title="t('skill.importDialog.overwriteWarning.title')"
        width="500px"
        append-to-body
      >
        <el-alert
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        >
          <template #title>
            {{ t('skill.importDialog.overwriteWarning.alertTitle') }}
          </template>
        </el-alert>
        <div style="line-height: 1.6; color: #606266;">
          <p><strong>{{ t('skill.importDialog.overwriteWarning.impact') }}:</strong></p>
          <ul style="padding-left: 20px; margin: 8px 0;">
            <li>{{ t('skill.importDialog.overwriteWarning.impact1') }}</li>
            <li>{{ t('skill.importDialog.overwriteWarning.impact2') }}</li>
            <li>{{ t('skill.importDialog.overwriteWarning.impact3') }}</li>
          </ul>
          <p style="margin-top: 12px; color: #f56c6c;"><strong>{{ t('skill.importDialog.overwriteWarning.cannotUndo') }}</strong></p>
        </div>
        <template #footer>
          <el-button @click="overwrite = false; showOverwriteWarning = false">
            {{ t('skill.importDialog.overwriteWarning.disableOverwrite') }}
          </el-button>
          <el-button type="danger" @click="showOverwriteWarning = false">
            {{ t('skill.importDialog.overwriteWarning.confirmRisk') }}
          </el-button>
        </template>
      </el-dialog>
    </div>

    <!-- Step 1: 预览 -->
    <div v-if="step === 1" class="step-content">
      <div v-if="previewLoading" class="loading-box">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>{{ t('skill.importDialog.preview.loading') }}</p>
      </div>
      <div v-else-if="previewData" class="preview-box">
        <SkillMdPreview
          :frontmatter="previewData.frontmatter"
          :body="previewData.body"
          :raw-content="previewData.rawContent"
        />
      </div>
      <el-empty v-else :description="t('skill.importDialog.preview.failed')" />
    </div>

    <!-- Step 2: 安全扫描结果 -->
    <div v-if="step === 2" class="step-content">
      <div v-if="scanLoading" class="loading-box">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>{{ t('skill.importDialog.securityScan.loading') }}</p>
      </div>
      <div v-else-if="scanResult" class="scan-result">
        <div class="scan-summary">
          <el-row :gutter="12">
            <el-col :span="6">
              <div class="stat-card" :class="scanResult.critical > 0 ? 'stat-critical' : 'stat-ok'">
                <div class="stat-num">{{ scanResult.critical }}</div>
                <div class="stat-label">{{ t('skill.importDialog.securityScan.critical') }}</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" :class="scanResult.high > 0 ? 'stat-high' : 'stat-ok'">
                <div class="stat-num">{{ scanResult.high }}</div>
                <div class="stat-label">{{ t('skill.importDialog.securityScan.high') }}</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" :class="scanResult.medium > 0 ? 'stat-medium' : 'stat-ok'">
                <div class="stat-num">{{ scanResult.medium }}</div>
                <div class="stat-label">{{ t('skill.importDialog.securityScan.medium') }}</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card stat-ok">
                <div class="stat-num">{{ scanResult.low }}</div>
                <div class="stat-label">{{ t('skill.importDialog.securityScan.low') }}</div>
              </div>
            </el-col>
          </el-row>
        </div>

        <el-alert
          :type="scanResult.passed ? 'success' : 'error'"
          :title="scanResult.passed ? t('skill.importDialog.securityScan.passed') : t('skill.importDialog.securityScan.notPassed')"
          :description="scanResult.summary"
          :closable="false"
          show-icon
          style="margin-bottom: 12px;"
        />

        <!-- 安全风险详情警告 -->
        <el-alert
          v-if="scanResult.critical > 0 || scanResult.high > 0"
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom: 12px;"
        >
          <template #title>
            {{ t('skill.importDialog.securityWarning.scanRiskAlert') }}
          </template>
          <template #default>
            <p>{{ t('skill.importDialog.securityWarning.riskDetail', { critical: scanResult.critical, high: scanResult.high }) }}</p>
          </template>
        </el-alert>

        <!-- 导入风险评估 -->
        <div v-if="scanResult" class="risk-assessment">
          <h4>{{ t('skill.importDialog.securityWarning.assessmentTitle') }}</h4>
          <div class="risk-items">
            <div class="risk-item" :class="{ 'risk-danger': scanResult.critical > 0 }">
              <el-icon v-if="scanResult.critical > 0" color="#f56c6c"><CircleCloseFilled /></el-icon>
              <el-icon v-else color="#67c23a"><CircleCheckFilled /></el-icon>
              <span>{{ t('skill.importDialog.securityWarning.assessCritical') }}: {{ scanResult.critical }}</span>
            </div>
            <div class="risk-item" :class="{ 'risk-warning': scanResult.high > 0 }">
              <el-icon v-if="scanResult.high > 0" color="#e6a23c"><WarningFilled /></el-icon>
              <el-icon v-else color="#67c23a"><CircleCheckFilled /></el-icon>
              <span>{{ t('skill.importDialog.securityWarning.assessHigh') }}: {{ scanResult.high }}</span>
            </div>
            <div class="risk-item">
              <el-icon color="#909399"><InfoFilled /></el-icon>
              <span>{{ t('skill.importDialog.securityWarning.assessMedium') }}: {{ scanResult.medium }}</span>
            </div>
            <div class="risk-item">
              <el-icon color="#909399"><InfoFilled /></el-icon>
              <span>{{ t('skill.importDialog.securityWarning.assessLow') }}: {{ scanResult.low }}</span>
            </div>
          </div>
          <div v-if="scanResult.critical > 0 || scanResult.high > 0" class="final-warning">
            <p>⚠️ {{ t('skill.importDialog.securityWarning.finalWarning') }}</p>
          </div>
        </div>

        <div v-if="scanResult.issues.length > 0" class="issues-list">
          <h4>{{ t('skill.importDialog.securityScan.issuesFound', { count: scanResult.issues.length }) }}</h4>
          <div
            v-for="(issue, idx) in scanResult.issues"
            :key="idx"
            class="issue-item"
            :class="`issue-${issue.level}`"
          >
            <el-tag
              :type="issueLevelTag(issue.level)"
              size="small"
              effect="dark"
            >
              {{ issue.level.toUpperCase() }}
            </el-tag>
            <span class="issue-type">{{ issue.type }}</span>
            <span class="issue-file">{{ issue.file }}</span>
            <span v-if="issue.line" class="issue-line">L{{ issue.line }}</span>
            <p class="issue-detail">{{ issue.detail }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3: 完成 -->
    <div v-if="step === 3" class="step-content">
      <div v-if="importLoading" class="loading-box">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>{{ t('skill.importDialog.result.importing') }}</p>
      </div>
      <div v-else-if="importResult" class="import-result">
        <el-result
          :icon="importResult.success ? 'success' : 'error'"
          :title="importResult.success ? t('skill.importDialog.result.success') : t('skill.importDialog.result.failed')"
          :sub-title="t('skill.importDialog.result.skillInfo', { name: importResult.skillName })"
        >
          <template v-if="importResult.warnings.length > 0" #extra>
            <el-alert
              type="warning"
              :closable="false"
              show-icon
            >
              <template #title>
                <ul style="margin: 0; padding-left: 16px;">
                  <li v-for="(w, i) in importResult.warnings" :key="i">{{ w }}</li>
                </ul>
              </template>
            </el-alert>
          </template>
        </el-result>
      </div>
    </div>

    <template #footer>
      <div style="text-align: right;">
        <el-button @click="handleClose">{{ t('skill.importDialog.footer.cancel') }}</el-button>
        <el-button v-if="step > 0" @click="step--" :disabled="importLoading">{{ t('skill.importDialog.footer.prevStep') }}</el-button>
        <el-button
          v-if="step === 0"
          type="primary"
          @click="handlePreview"
          :disabled="!uploadFile"
        >
          {{ t('skill.importDialog.footer.nextPreview') }}
        </el-button>
        <el-button
          v-if="step === 1"
          type="primary"
          @click="handleScan"
        >
          {{ t('skill.importDialog.footer.nextSecurityScan') }}
        </el-button>
        <el-button
          v-if="step === 2 && scanResult?.passed !== false"
          type="primary"
          @click="handleImportWithConfirm"
          :loading="importLoading"
          :disabled="hasCriticalOrHighRisk && !riskConfirmed"
        >
          {{ hasCriticalOrHighRisk && !riskConfirmed ? t('skill.importDialog.footer.confirmRiskFirst') : t('skill.importDialog.footer.confirmImport') }}
        </el-button>
        <el-button
          v-if="step === 3 && importResult?.success"
          type="primary"
          @click="handleClose"
        >
          {{ t('skill.importDialog.footer.complete') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Loading, WarningFilled, CircleCloseFilled, CircleCheckFilled, InfoFilled } from '@element-plus/icons-vue'
import { type SecurityScanResult, type ImportResult } from '@/api/skill'
import { useSkillStore } from '@/stores'
import SkillMdPreview from './SkillMdPreview.vue'
import AppSelector from '@/components/AppSelector.vue'
import type { UploadFile } from 'element-plus'

const { t } = useI18n()

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'imported'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const skillStore = useSkillStore()

const targetAppCode = ref('')
const overwrite = ref(false)
const showOverwriteWarning = ref(false)
const riskConfirmed = ref(false)

const step = ref(0)
const uploadFile = ref<File | null>(null)
const uploadRef = ref()

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const previewLoading = ref(false)
const previewData = ref<{ frontmatter: Record<string, unknown>; body: string; rawContent: string } | null>(null)

const scanLoading = ref(false)
const scanResult = ref<SecurityScanResult | null>(null)

const importLoading = ref(false)
const importResult = ref<ImportResult | null>(null)

/**
 * 计算是否存在严重或高危风险
 * @returns {boolean} 是否存在高风险
 */
const hasCriticalOrHighRisk = computed(() => {
  if (!scanResult.value) return false
  return scanResult.value.critical > 0 || scanResult.value.high > 0
})

/**
 * 文件大小警告信息
 * @returns {Object|null} 警告对象或null
 */
const fileSizeWarning = computed(() => {
  if (!uploadFile.value) return null
  const size = uploadFile.value.size
  const sizeMB = size / (1024 * 1024)

  if (size > MAX_FILE_SIZE) {
    return {
      type: 'error' as const,
      title: t('skill.importDialog.securityWarning.fileTooLarge'),
      description: t('skill.importDialog.securityWarning.fileSizeLimit', { size: MAX_FILE_SIZE / (1024 * 1024) }),
    }
  }

  if (sizeMB > 10) {
    return {
      type: 'warning' as const,
      title: t('skill.importDialog.securityWarning.largeFile'),
      description: t('skill.importDialog.securityWarning.largeFileHint', { size: sizeMB.toFixed(2) }),
    }
  }

  return null
})

/**
 * 上传前文件验证
 * @param file 上传的文件
 * @returns {boolean} 是否允许上传
 */
const handleBeforeUpload = (file: File): boolean => {
  const isZip = file.name.endsWith('.zip')
  const isValidSize = file.size <= MAX_FILE_SIZE

  if (!isZip) {
    ElMessage.error(t('skill.importDialog.securityWarning.onlyZipAllowed'))
    return false
  }

  if (!isValidSize) {
    ElMessage.error(t('skill.importDialog.securityWarning.fileSizeExceeded', { size: MAX_FILE_SIZE / (1024 * 1024) }))
    return false
  }

  return true
}

/**
 * 处理文件超出限制
 */
const handleExceed = () => {
  ElMessage.warning(t('skill.importDialog.securityWarning.exceedLimit'))
}

const handleFileChange = (file: UploadFile) => {
  uploadFile.value = file.raw || null
}

const handleFileRemove = () => {
  uploadFile.value = null
  step.value = 0
  previewData.value = null
  scanResult.value = null
  importResult.value = null
}

const handlePreview = async () => {
  if (!uploadFile.value) {
    ElMessage.warning(t('skill.importDialog.messages.uploadFirst'))
    return
  }
  step.value = 1
  previewLoading.value = true
  try {
    previewData.value = {
      frontmatter: { name: uploadFile.value.name.replace('.zip', ''), description: '(预览将在服务端解析)' },
      body: '文件上传后将在服务端完成 SKILL.md 解析和安全扫描。\n\n请在下一步查看扫描结果。',
      rawContent: `文件: ${uploadFile.value.name}\n大小: ${formatFileSize(uploadFile.value.size)}`,
    }
  } catch {
    previewData.value = null
  } finally {
    previewLoading.value = false
  }
}

const handleScan = async () => {
  if (!uploadFile.value) return
  step.value = 2
  scanLoading.value = true
  try {
    scanResult.value = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      issues: [],
      summary: t('skill.importDialog.securityScan.scanInfo'),
      passed: true,
    }
    ElMessage.info(t('skill.importDialog.securityScan.submitScan'))
  } catch (error: any) {
    ElMessage.error(t('skill.importDialog.securityScan.scanFailed'))
  } finally {
    scanLoading.value = false
  }
}

const handleImportWithConfirm = async () => {
  if (!uploadFile.value) return

  // 如果存在严重或高危风险，需要二次确认
  if (hasCriticalOrHighRisk.value && !riskConfirmed.value) {
    try {
      await ElMessageBox.confirm(
        t('skill.importDialog.securityWarning.riskConfirmMessage'),
        t('skill.importDialog.securityWarning.riskConfirmTitle'),
        {
          confirmButtonText: t('skill.importDialog.securityWarning.acceptRisk'),
          cancelButtonText: t('skill.importDialog.footer.cancel'),
          type: 'warning',
          distinguishCancelAndClose: true,
        }
      )
      riskConfirmed.value = true
    } catch {
      return
    }
  }

  // 执行导入
  await handleImport()
}

const handleImport = async () => {
  if (!uploadFile.value) return
  step.value = 3
  importLoading.value = true
  try {
    const result = await skillStore.importSkill(uploadFile.value, {
      appCode: targetAppCode.value || undefined,
      isPublic: targetAppCode.value ? false : true,
      overwrite: overwrite.value,
    })
    if (result) {
      importResult.value = result
      scanResult.value = result.securityScan
      if (result.success) {
        emit('imported')
      }
    }
  } finally {
    importLoading.value = false
  }
}

const handleClose = () => {
  step.value = 0
  uploadFile.value = null
  previewData.value = null
  scanResult.value = null
  importResult.value = null
  showOverwriteWarning.value = false
  riskConfirmed.value = false
  emit('update:visible', false)
}

const issueLevelTag = (level: string) => {
  const map: Record<string, string> = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' }
  return map[level] || 'info'
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style lang="scss" scoped>
.step-content {
  min-height: 280px;
}

.upload-area {
  width: 100%;

  .upload-icon {
    font-size: 48px;
    color: #409eff;
  }

  .upload-text {
    p {
      margin: 8px 0 0;
      font-size: 14px;
      color: #606266;
    }
    em {
      color: #409eff;
      font-style: normal;
    }
    .upload-hint {
      font-size: 12px;
      color: #999;
    }
  }
}

.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;

  p {
    margin-top: 12px;
  }
}

.preview-box {
  max-height: 55vh;
  overflow-y: auto;
}

.scan-result {
  .scan-summary {
    margin-bottom: 16px;
  }

  .stat-card {
    text-align: center;
    padding: 12px 8px;
    border-radius: 8px;
    background: #f0f9eb;
    border: 1px solid #e1f3d8;

    .stat-num {
      font-size: 28px;
      font-weight: 700;
    }
    .stat-label {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }

    &.stat-critical { background: #fef0f0; border-color: #fde2e2; .stat-num { color: #f56c6c; } }
    &.stat-high { background: #fdf6ec; border-color: #faecd8; .stat-num { color: #e6a23c; } }
    &.stat-medium { background: #ecf5ff; border-color: #d9ecff; .stat-num { color: #409eff; } }
    &.stat-ok { .stat-num { color: #67c23a; } }
  }

  .issues-list {
    h4 {
      font-size: 14px;
      margin: 0 0 8px;
    }

    .issue-item {
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 6px;
      border-left: 3px solid #909399;

      &.issue-critical { background: #fef0f0; border-left-color: #f56c6c; }
      &.issue-high { background: #fdf6ec; border-left-color: #e6a23c; }
      &.issue-medium { background: #ecf5ff; border-left-color: #409eff; }
      &.issue-low { background: #f5f7fa; border-left-color: #c0c4cc; }

      .issue-type {
        margin: 0 8px;
        font-weight: 500;
        font-size: 13px;
      }
      .issue-file {
        color: #909399;
        font-family: monospace;
        font-size: 12px;
      }
      .issue-line {
        margin-left: 4px;
        color: #c0c4cc;
        font-size: 12px;
      }
      .issue-detail {
        margin: 4px 0 0;
        font-size: 12px;
        color: #606266;
      }
    }
  }
}

.import-result {
  padding: 20px 0;
}

/**
 * 安全风险评估样式
 */
.risk-assessment {
  margin: 16px 0;
  padding: 16px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #e4e7ed;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .risk-items {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 12px;
  }

  .risk-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: white;
    border-radius: 6px;
    font-size: 13px;
    color: #606266;
    border: 1px solid #ebeef5;
    transition: all 0.3s ease;

    &.risk-danger {
      background: #fef0f0;
      border-color: #fde2e2;
      color: #f56c6c;
      font-weight: 500;
    }

    &.risk-warning {
      background: #fdf6ec;
      border-color: #faecd8;
      color: #e6a23c;
      font-weight: 500;
    }

    .el-icon {
      flex-shrink: 0;
    }
  }

  .final-warning {
    padding: 12px;
    background: #fef0f0;
    border-left: 4px solid #f56c6c;
    border-radius: 4px;
    margin-top: 12px;

    p {
      margin: 0;
      color: #f56c6c;
      font-size: 13px;
      line-height: 1.6;
      font-weight: 500;
    }
  }
}
</style>
