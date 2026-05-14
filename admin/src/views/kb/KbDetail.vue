<template>
  <div class="kb-detail" v-loading="loading">
    <div class="header">
      <el-button @click="handleBack">
        <el-icon>
          <ArrowLeft />
        </el-icon>
        返回
      </el-button>
      <h2>{{ kbInfo?.kbName || '知识库详情' }}</h2>

    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="info-card">
          <template #header>
            <span>基本信息</span>
          </template>
          <div class="info-item">
            <span class="label">知识库名称：</span>
            <span class="value">{{ kbInfo?.kbName }}</span>
          </div>
          <div class="info-item">
            <span class="label">知识库标识：</span>
            <span class="value">{{ kbInfo?.kbCode }}</span>
          </div>
          <div class="info-item">
            <span class="label">状态：</span>
            <el-tag :type="kbInfo?.status ? 'success' : 'danger'" size="small">
              {{ kbInfo?.status ? '启用' : '禁用' }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="label">描述：</span>
            <span class="value">{{ kbInfo?.description || '暂无描述' }}</span>
          </div>
          <div class="info-item">
            <span class="label">创建时间：</span>
            <span class="value">{{ formatDate(kbInfo?.createdTime) }}</span>
          </div>
        </el-card>

        <el-card class="config-card">
          <template #header>
            <span>配置参数</span>
          </template>
          <div class="info-item">
            <span class="label">检索方式：</span>
            <span class="value">{{ kbInfo?.retrievalMethod === 'bm25' ? 'BM25检索' : '向量检索' }}</span>
          </div>
          <div class="info-item" v-if="kbInfo?.retrievalMethod !== 'bm25'">
            <span class="label">向量模型：</span>
            <span class="value">{{ kbInfo?.embeddingModel }}</span>
          </div>
          <div class="info-item">
            <span class="label">切片大小：</span>
            <span class="value">{{ kbInfo?.chunkSize }}</span>
          </div>
          <div class="info-item">
            <span class="label">切片重叠：</span>
            <span class="value">{{ kbInfo?.chunkOverlap }}</span>
          </div>
          <div class="info-item">
            <span class="label">相似度阈值：</span>
            <span class="value">{{ kbInfo?.similarityThresh }}</span>
          </div>
          <div class="info-item">
            <span class="label">召回条数：</span>
            <span class="value">{{ kbInfo?.topN }}</span>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card class="document-card">
          <template #header>
            <div class="card-header">
              <span>文档列表</span>
              <el-upload :show-file-list="false" :before-upload="handleUpload" accept=".pdf,.doc,.docx,.txt,.md">
                <el-button type="primary" size="small">
                  <el-icon>
                    <Upload />
                  </el-icon>
                  上传文档
                </el-button>
              </el-upload>
            </div>
          </template>

          <el-table :data="documentList" style="width: 100%">
            <el-table-column prop="fileName" label="文档名称" />
            <el-table-column prop="fileType" label="类型" width="80" />
            <el-table-column prop="fileSize" label="大小" width="100">
              <template #default="{ row }">
                {{ formatFileSize(row.fileSize) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="totalChunks" label="切片数" width="80" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button text type="danger" @click="handleDeleteDocument(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total"
              layout="total, prev, pager, next" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Upload } from '@element-plus/icons-vue'
import { kbApi, documentApi } from '@/api'
import type { KbInfo } from '@/api/kb'
import type { DocumentInfo } from '@/api/document'

const route = useRoute()
const router = useRouter()

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
    ElMessage.error(error.message || '获取知识库详情失败')
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
    ElMessage.error(error.message || '获取文档列表失败')
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
      ElMessage.error('用户信息获取失败，请重新登录')
      return false
    }

    await documentApi.upload(user.id, kbId, file)
    ElMessage.success('文档上传成功')
    fetchDocumentList()
    fetchKbDetail()
  } catch (error: any) {
    ElMessage.error(error.message || '文档上传失败')
  }
  return false
}

const handleDeleteDocument = async (doc: DocumentInfo) => {
  try {
    await ElMessageBox.confirm('确定要删除该文档吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const userStr = localStorage.getItem('admin_user')
    const user = userStr ? JSON.parse(userStr) : null

    if (!user?.id) {
      ElMessage.error('用户信息获取失败，请重新登录')
      return
    }

    await documentApi.delete(user.id, kbId, doc.docId)
    ElMessage.success('删除成功')
    fetchDocumentList()
    fetchKbDetail()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
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
  const texts: Record<number, string> = {
    0: '解析中',
    1: '正常',
    2: '失败',
    3: '禁用'
  }
  return texts[status] || '未知'
}

onMounted(() => {
  fetchKbDetail()
  fetchDocumentList()
})
</script>

<style scoped lang="scss">
.kb-detail {
  
  .header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    gap: 20px;

    h2 {
      flex: 1;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 12px;
    }
  }

  .info-card,
  .config-card {
    margin-bottom: 20px;

    .info-item {
      display: flex;
      margin-bottom: 12px;
      font-size: 14px;

      .label {
        color: #909399;
        min-width: 100px;
      }

      .value {
        color: #303133;
        flex: 1;
      }
    }
  }

  .document-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pagination {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }
  }
}
</style>
