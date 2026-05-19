<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(val: boolean) => emit('update:visible', val)"
    title="导入标准技能"
    width="720px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- 步骤条 -->
    <el-steps :active="step" align-center style="margin-bottom: 24px;">
      <el-step title="上传文件" />
      <el-step title="预览确认" />
      <el-step title="安全扫描" />
      <el-step title="完成导入" />
    </el-steps>

    <!-- Step 0: 上传 -->
    <div v-if="step === 0" class="step-content">
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".zip"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          <p>拖拽 .zip 文件到此处或<em>点击上传</em></p>
          <p class="upload-hint">支持 Agent Skills 标准格式的技能压缩包，导入到文件系统</p>
        </div>
      </el-upload>

      <el-divider />

      <el-form label-width="100px" size="default">
        <el-form-item label="目标应用">
          <AppSelector v-model="targetAppCode" placeholder="不选则为公开技能" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="覆盖已有">
          <el-switch v-model="overwrite" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px;">若技能已存在则覆盖</span>
        </el-form-item>
      </el-form>
    </div>

    <!-- Step 1: 预览 -->
    <div v-if="step === 1" class="step-content">
      <div v-if="previewLoading" class="loading-box">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>正在解析 SKILL.md...</p>
      </div>
      <div v-else-if="previewData" class="preview-box">
        <SkillMdPreview
          :frontmatter="previewData.frontmatter"
          :body="previewData.body"
          :raw-content="previewData.rawContent"
        />
      </div>
      <el-empty v-else description="无法解析 SKILL.md" />
    </div>

    <!-- Step 2: 安全扫描结果 -->
    <div v-if="step === 2" class="step-content">
      <div v-if="scanLoading" class="loading-box">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>正在进行安全扫描...</p>
      </div>
      <div v-else-if="scanResult" class="scan-result">
        <div class="scan-summary">
          <el-row :gutter="12">
            <el-col :span="6">
              <div class="stat-card" :class="scanResult.critical > 0 ? 'stat-critical' : 'stat-ok'">
                <div class="stat-num">{{ scanResult.critical }}</div>
                <div class="stat-label">严重</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" :class="scanResult.high > 0 ? 'stat-high' : 'stat-ok'">
                <div class="stat-num">{{ scanResult.high }}</div>
                <div class="stat-label">高危</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card" :class="scanResult.medium > 0 ? 'stat-medium' : 'stat-ok'">
                <div class="stat-num">{{ scanResult.medium }}</div>
                <div class="stat-label">中危</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card stat-ok">
                <div class="stat-num">{{ scanResult.low }}</div>
                <div class="stat-label">低危</div>
              </div>
            </el-col>
          </el-row>
        </div>

        <el-alert
          :type="scanResult.passed ? 'success' : 'error'"
          :title="scanResult.passed ? '安全扫描通过' : '安全扫描未通过'"
          :description="scanResult.summary"
          :closable="false"
          show-icon
          style="margin-bottom: 12px;"
        />

        <div v-if="scanResult.issues.length > 0" class="issues-list">
          <h4>发现 {{ scanResult.issues.length }} 个问题</h4>
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
        <p>正在导入...</p>
      </div>
      <div v-else-if="importResult" class="import-result">
        <el-result
          :icon="importResult.success ? 'success' : 'error'"
          :title="importResult.success ? '导入成功' : '导入失败'"
          :sub-title="`技能: ${importResult.skillName}（文件系统）`"
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
        <el-button @click="handleClose">取消</el-button>
        <el-button v-if="step > 0" @click="step--" :disabled="importLoading">上一步</el-button>
        <el-button
          v-if="step === 0"
          type="primary"
          @click="handlePreview"
          :disabled="!uploadFile"
        >
          下一步：预览
        </el-button>
        <el-button
          v-if="step === 1"
          type="primary"
          @click="handleScan"
        >
          下一步：安全扫描
        </el-button>
        <el-button
          v-if="step === 2 && scanResult?.passed !== false"
          type="primary"
          @click="handleImport"
          :loading="importLoading"
        >
          确认导入
        </el-button>
        <el-button
          v-if="step === 3 && importResult?.success"
          type="primary"
          @click="handleClose"
        >
          完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Loading } from '@element-plus/icons-vue'
import { type SecurityScanResult, type ImportResult } from '@/api/skill'
import { useSkillStore } from '@/stores'
import SkillMdPreview from './SkillMdPreview.vue'
import AppSelector from '@/components/AppSelector.vue'
import type { UploadFile } from 'element-plus'

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

const step = ref(0)
const uploadFile = ref<File | null>(null)
const uploadRef = ref()

const previewLoading = ref(false)
const previewData = ref<{ frontmatter: Record<string, unknown>; body: string; rawContent: string } | null>(null)

const scanLoading = ref(false)
const scanResult = ref<SecurityScanResult | null>(null)

const importLoading = ref(false)
const importResult = ref<ImportResult | null>(null)

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
    ElMessage.warning('请先上传技能文件')
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
      summary: '点击"确认导入"后，服务端将自动执行：提示注入检测、危险代码模式扫描、文件类型白名单验证、依赖安装行为检测、硬编码凭证检测',
      passed: true,
    }
    ElMessage.info('请点击"确认导入"提交到服务端进行完整安全扫描')
  } catch (error: any) {
    ElMessage.error('扫描失败')
  } finally {
    scanLoading.value = false
  }
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
</style>
