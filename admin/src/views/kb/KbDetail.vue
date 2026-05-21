<template>
  <div class="kb-detail-page" v-loading="loading">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="handleBack" text class="back-btn">
          <el-icon><ArrowLeft /></el-icon>
          {{ $t('knowledge.actions.backToList') }}
        </el-button>
        <div class="title-group">
          <h1 class="page-title">{{ kbInfo?.kbName || $t('knowledge.detail.title') }}</h1>
          <el-tag
            v-if="kbInfo"
            :type="kbInfo.status ? 'success' : 'danger'"
            size="small"
            class="status-tag"
            effect="dark"
            round
          >
            {{ kbInfo.status ? $t('knowledge.detail.enabledStatus') : $t('knowledge.detail.disabledStatus') }}
          </el-tag>
        </div>
      </div>
    </div>

    <template v-if="kbInfo">
      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('knowledge.detail.basicInfo') }}</span>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item :label="$t('knowledge.detail.kbName')">
            {{ kbInfo.kbName }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.detail.kbCode')">
            <el-tag effect="plain" round>{{ kbInfo.kbCode }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.detail.createTime')">
            {{ formatDate(kbInfo.createdTime) }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.list.description')" :span="3">
            {{ kbInfo.description || $t('knowledge.list.noDescription') }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('knowledge.detail.retrievalConfig') }}</span>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item :label="$t('knowledge.list.retrievalMethod')">
            <el-tag effect="plain" round>
              {{
                kbInfo.retrievalMethod === 'bm25'
                  ? $t('knowledge.list.bm25Retrieval')
                  : $t('knowledge.list.vectorRetrieval')
              }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="kbInfo.retrievalMethod !== 'bm25'"
            :label="$t('knowledge.list.vectorModel')">
            {{ kbInfo.embeddingModel }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.detail.chunkSize')">
            {{ kbInfo.chunkSize }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.detail.chunkOverlap')">
            {{ kbInfo.chunkOverlap }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.detail.similarityThreshold')">
            {{ kbInfo.similarityThresh }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('knowledge.detail.topN')">
            {{ kbInfo.topN }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-header__title">{{ $t('knowledge.detail.documentList') }}</span>
            <el-upload :show-file-list="false" :before-upload="handleUpload" accept=".pdf,.doc,.docx,.txt,.md">
              <el-button type="primary" size="small">
                <el-icon><Upload /></el-icon>
                {{ $t('knowledge.actions.upload') }}
              </el-button>
            </el-upload>
          </div>
        </template>

        <el-table :data="documentList" style="width: 100%">
          <el-table-column prop="fileName" :label="$t('knowledge.detail.fileName')" min-width="180" />
          <el-table-column prop="fileType" :label="$t('knowledge.detail.fileType')" width="80" />
          <el-table-column prop="fileSize" :label="$t('knowledge.detail.fileSize')" width="120">
            <template #default="{ row }">
              {{ formatFileSize(row.fileSize) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" :label="$t('knowledge.detail.status')" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalChunks" :label="$t('knowledge.detail.chunksCount')" width="80" />
          <el-table-column :label="$t('knowledge.detail.operations')" width="100">
            <template #default="{ row }">
              <el-button text type="danger" @click="handleDeleteDocument(row)">
                {{ $t('knowledge.actions.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
          />
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Upload } from '@element-plus/icons-vue'
import { kbApi, documentApi } from '@/api'
import type { KbInfo } from '@/api/kb'
import type { DocumentInfo } from '@/api/document'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const kbInfo = ref<KbInfo | null>(null)
const documentList = ref<DocumentInfo[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

const kbId = route.params.id as string

const fetchKbDetail = async () => {
  loading.value = true
  try {
    const response = await kbApi.getDetail(kbId)
    kbInfo.value = response.data.data
  } catch (error: any) {
    ElMessage.error(error.message || t('knowledge.messages.fetchDetailFailed'))
  } finally {
    loading.value = false
  }
}

const fetchDocumentList = async () => {
  try {
    const response = await documentApi.getList({
      kbId,
      pageNum: currentPage.value,
      pageSize: pageSize.value
    })
    documentList.value = response.data.data.list
    total.value = response.data.data.total
  } catch (error: any) {
    ElMessage.error(error.message || t('knowledge.messages.fetchDocumentListFailed'))
  }
}

const handleBack = () => {
  router.push('/kb/list')
}

const handleUpload = async (file: File) => {
  try {
    const userStr = localStorage.getItem('admin_user')
    const user = userStr ? JSON.parse(userStr) : null

    if (!user?.id) {
      ElMessage.error(t('knowledge.messages.getUserInfoFailed'))
      return false
    }

    await documentApi.upload(user.id, kbId, file)
    ElMessage.success(t('knowledge.messages.uploadSuccess'))
    fetchDocumentList()
    fetchKbDetail()
  } catch (error: any) {
    ElMessage.error(error.message || t('knowledge.messages.uploadFailed'))
  }
  return false
}

const handleDeleteDocument = async (doc: DocumentInfo) => {
  try {
    await ElMessageBox.confirm(t('knowledge.messages.deleteDocumentConfirm'), t('knowledge.messages.deleteConfirmTitle'), {
      confirmButtonText: t('knowledge.actions.confirm'),
      cancelButtonText: t('knowledge.actions.cancel'),
      type: 'warning'
    })

    const userStr = localStorage.getItem('admin_user')
    const user = userStr ? JSON.parse(userStr) : null

    if (!user?.id) {
      ElMessage.error(t('knowledge.messages.getUserInfoFailed'))
      return
    }

    await documentApi.delete(user.id, kbId, doc.docId)
    ElMessage.success(t('knowledge.messages.deleteSuccess'))
    fetchDocumentList()
    fetchKbDetail()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || t('knowledge.messages.deleteFailed'))
    }
  }
}

watch(currentPage, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    fetchDocumentList()
  }
})

const formatDate = (date?: string) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

const getStatusType = (status: number) => {
  const types: Record<number, any> = {
    0: 'warning',
    1: 'success',
    2: 'danger',
    3: 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status: number) => {
  const statusMap: Record<number, string> = {
    0: t('knowledge.document.status.parsing'),
    1: t('knowledge.document.status.normal'),
    2: t('knowledge.document.status.failed'),
    3: t('knowledge.document.status.disabled')
  }
  return statusMap[status] || t('knowledge.document.status.unknown')
}

onMounted(() => {
  fetchKbDetail()
  fetchDocumentList()
})
</script>

<style scoped lang="scss">
.kb-detail-page {
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  font-weight: 500;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: #1e1b4b;
}

.status-tag {
  font-size: 12px;
}

.detail-card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.detail-card :deep(.el-card__header) {
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 12px 12px 0 0;
}

.detail-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header__title {
  font-size: 16px;
  font-weight: 600;
  color: #1e1b4b;
}

.detail-card :deep(.el-descriptions__label) {
  font-weight: 500;
  color: #6b7280;
}

.detail-card :deep(.el-descriptions__content) {
  color: #1e1b4b;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
