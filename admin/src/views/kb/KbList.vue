<template>
  <div class="kb-list">
    <div class="header">
      <h2>知识库管理</h2>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建知识库
      </el-button>
    </div>

    <div class="filters">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索知识库名称或标识"
        style="width: 300px;"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="statusFilter" placeholder="状态筛选" style="width: 150px;" @change="handleSearch">
        <el-option label="全部" value="" />
        <el-option label="启用" :value="true" />
        <el-option label="禁用" :value="false" />
      </el-select>
      <el-button @click="handleSearch">搜索</el-button>
    </div>

    <div class="kb-grid" v-loading="loading">
      <el-card v-for="kb in kbList" :key="kb.kbId" class="kb-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="kb-name">{{ kb.kbName }}</span>
            <el-tag :type="kb.status ? 'success' : 'danger'" size="small">
              {{ kb.status ? '启用' : '禁用' }}
            </el-tag>
          </div>
        </template>
        
        <div class="card-content">
          <div class="info-item">
            <span class="label">标识：</span>
            <span class="value">{{ kb.kbCode }}</span>
          </div>
          <div class="info-item">
            <span class="label">描述：</span>
            <span class="value">{{ kb.description || '暂无描述' }}</span>
          </div>
          <div class="info-item">
            <span class="label">文档数：</span>
            <span class="value">{{ kb.documentCount || 0 }}</span>
          </div>
          <div class="info-item">
            <span class="label">切片数：</span>
            <span class="value">{{ kb.chunkCount || 0 }}</span>
          </div>
        </div>

        <template #footer>
          <div class="card-footer">
            <el-button text @click="handleView(kb)">查看</el-button>
            <el-button text @click="handleEdit(kb)">编辑</el-button>
            <el-button text type="danger" @click="handleDelete(kb)">删除</el-button>
          </div>
        </template>
      </el-card>
    </div>

    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24, 48, 96]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="知识库名称" prop="kbName">
          <el-input v-model="formData.kbName" placeholder="请输入知识库名称" />
        </el-form-item>
        <el-form-item label="知识库标识" prop="kbCode">
          <el-input v-model="formData.kbCode" placeholder="请输入知识库标识" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="向量模型" prop="embeddingModel">
          <el-select 
            v-model="formData.embeddingModel" 
            placeholder="请选择向量模型" 
            style="width: 100%"
            :disabled="embeddingModels.length === 0"
          >
            <el-option
              v-for="model in embeddingModels"
              :key="model.id"
              :label="model.name"
              :value="model.code"
            >
              <span style="float: left">{{ model.name }}</span>
              <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
                {{ model.provider }}
              </span>
            </el-option>
          </el-select>
          <div v-if="embeddingModels.length === 0" style="color: var(--el-text-color-secondary); font-size: 12px; margin-top: 4px">
            暂无可用的向量模型，请先在「模型配置」中添加向量模型
          </div>
        </el-form-item>
        <el-form-item label="切片大小" prop="chunkSize">
          <el-input-number v-model="formData.chunkSize" :min="100" :max="2000" />
        </el-form-item>
        <el-form-item label="切片重叠" prop="chunkOverlap">
          <el-input-number v-model="formData.chunkOverlap" :min="0" :max="500" />
        </el-form-item>
        <el-form-item label="相似度阈值" prop="similarityThresh">
          <el-input-number v-model="formData.similarityThresh" :min="0" :max="1" :step="0.1" :precision="1" />
        </el-form-item>
        <el-form-item label="召回条数" prop="topN">
          <el-input-number v-model="formData.topN" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { kbApi, modelApi } from '@/api'
import type { KbInfo } from '@/api/kb'
import type { Model } from '@/api/model'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const kbList = ref<KbInfo[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)
const searchKeyword = ref('')
const statusFilter = ref<boolean | ''>('')

const dialogVisible = ref(false)
const dialogTitle = ref('创建知识库')
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const currentKbId = ref('')
const embeddingModels = ref<Model[]>([])

const formData = reactive({
  kbName: '',
  kbCode: '',
  embeddingModel: '',
  chunkSize: 500,
  chunkOverlap: 100,
  similarityThresh: 0.7,
  topN: 5,
  description: ''
})

const rules: FormRules = {
  kbName: [{ required: true, message: '请输入知识库名称', trigger: 'blur' }],
  kbCode: [{ required: true, message: '请输入知识库标识', trigger: 'blur' }],
  embeddingModel: [{ required: true, message: '请选择向量模型', trigger: 'change' }]
}

const fetchEmbeddingModels = async () => {
  try {
    const response = await modelApi.getList()
    const allModels = response.data.data.list || []
    embeddingModels.value = allModels.filter((model: Model) => {
      if (!model.status) return false
      const isEmbeddingType = model.type === 'embedding'
      const hasEmbeddingTag = model.tags && model.tags.includes('embedding')
      return isEmbeddingType || hasEmbeddingTag
    })
  } catch (error: any) {
    console.error('获取模型列表失败:', error)
  }
}

const fetchKbList = async () => {
  loading.value = true
  try {
    const response = await kbApi.getList({
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value,
      status: statusFilter.value === '' ? undefined : statusFilter.value
    })
    kbList.value = response.data.data.list
    total.value = response.data.data.total
  } catch (error: any) {
    ElMessage.error(error.message || '获取知识库列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchKbList()
}

const handleSizeChange = () => {
  currentPage.value = 1
  fetchKbList()
}

const handlePageChange = () => {
  fetchKbList()
}

const handleCreate = () => {
  dialogTitle.value = '创建知识库'
  isEdit.value = false
  currentKbId.value = ''
  Object.assign(formData, {
    kbName: '',
    kbCode: '',
    embeddingModel: 'doubao-embedding-v1',
    chunkSize: 500,
    chunkOverlap: 100,
    similarityThresh: 0.7,
    topN: 5,
    description: ''
  })
  dialogVisible.value = true
}

const handleView = (kb: KbInfo) => {
  router.push(`/kb/detail/${kb.kbId}`)
}

const handleEdit = (kb: KbInfo) => {
  dialogTitle.value = '编辑知识库'
  isEdit.value = true
  currentKbId.value = kb.kbId
  Object.assign(formData, {
    kbName: kb.kbName,
    kbCode: kb.kbCode,
    embeddingModel: kb.embeddingModel,
    chunkSize: kb.chunkSize,
    chunkOverlap: kb.chunkOverlap,
    similarityThresh: kb.similarityThresh,
    topN: kb.topN,
    description: kb.description
  })
  dialogVisible.value = true
}

const handleDelete = async (kb: KbInfo) => {
  try {
    await ElMessageBox.confirm('确定要删除该知识库吗？删除后无法恢复。', '提示', {
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
    
    await kbApi.delete(user.id, kb.kbId)
    ElMessage.success('删除成功')
    fetchKbList()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        const userStr = localStorage.getItem('admin_user')
        const user = userStr ? JSON.parse(userStr) : null
        
        if (!user?.id) {
          ElMessage.error('用户信息获取失败，请重新登录')
          return
        }
        
        if (isEdit.value) {
          await kbApi.update({
            uid: user.id,
            kbId: currentKbId.value,
            ...formData
          })
          ElMessage.success('更新成功')
        } else {
          await kbApi.create({
            uid: user.id,
            ...formData
          })
          ElMessage.success('创建成功')
        }
        dialogVisible.value = false
        fetchKbList()
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(() => {
  fetchKbList()
  fetchEmbeddingModels()
})
</script>

<style scoped lang="scss">
.kb-list {
  padding: 20px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
  }

  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .kb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    min-height: 400px;
  }

  .kb-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .kb-name {
        font-size: 16px;
        font-weight: 600;
      }
    }

    .card-content {
      .info-item {
        display: flex;
        margin-bottom: 8px;
        font-size: 14px;

        .label {
          color: #909399;
          min-width: 70px;
        }

        .value {
          color: #303133;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .card-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }

  .pagination {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
}
</style>
