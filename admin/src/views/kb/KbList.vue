<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">📚 知识库管理</h1>
      <p class="page-description">创建和管理知识库，为智能体提供知识检索能力</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>知识库列表</span>
        <el-tag type="info" size="small">{{ total }} 个</el-tag>
        <AppSelector
          v-if="isSuperAdmin"
          v-model="filterAppCode"
          placeholder="筛选应用"
          style="margin-left: 16px;"
          @change="handleAppFilterChange"
        />
      </div>

      <div class="help-tip">
        <div class="help-tip-title">💡 知识库说明</div>
        <ul>
          <li><strong>知识库</strong>：存储文档数据，支持向量检索，为智能体提供知识支持</li>
          <li><strong>向量模型</strong>：将文本转换为向量表示，用于语义相似度计算</li>
          <li><strong>切片大小</strong>：文档切分的块大小，影响检索精度和效率</li>
          <li><strong>相似度阈值</strong>：检索结果的最低相似度要求，范围 0-1</li>
          <li><strong>召回条数</strong>：每次检索返回的最大文档片段数量</li>
        </ul>
      </div>

      <div class="filters">
        <el-input v-model="searchKeyword" placeholder="搜索知识库名称或标识" style="width: 300px;" @keyup.enter="handleSearch">
          <template #prefix>
            <el-icon>
              <Search />
            </el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态筛选" style="width: 150px;" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
        <el-button @click="handleSearch">
          <el-icon>
            <Search />
          </el-icon>
          搜索
        </el-button>
        <el-button type="primary" @click="handleCreate">
          <el-icon>
            <Plus />
          </el-icon>
          创建知识库
        </el-button>
      </div>

      <div class="kb-grid" v-loading="loading">
        <el-card v-for="kb in kbList" :key="kb.kbId" class="kb-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <el-icon class="kb-icon">
                  <FolderOpened />
                </el-icon>
                <span class="kb-name">{{ kb.kbName }}</span>
              </div>
              <el-tag :type="kb.status ? 'success' : 'danger'" size="small">
                {{ kb.status ? '启用' : '禁用' }}
              </el-tag>
            </div>
          </template>

          <div class="card-content">
            <div class="info-item">
              <span class="label">标识：</span>
              <el-tag type="info" size="small">{{ kb.kbCode }}</el-tag>
            </div>
            <div class="info-item" v-if="isSuperAdmin">
              <span class="label">所属应用：</span>
              <el-tag v-if="kb.appCode" type="warning" size="small">{{ kb.appCode }}</el-tag>
              <span v-else class="value">全局</span>
            </div>
            <div class="info-item">
              <span class="label">公开状态：</span>
              <el-tag :type="kb.isPublic ? 'success' : 'info'" size="small">
                {{ kb.isPublic ? '公开' : '私有' }}
              </el-tag>
            </div>
            <div class="info-item" v-if="kb.description">
              <span class="label">描述：</span>
              <span class="value">{{ kb.description }}</span>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="label">文档数：</span>
                <span class="value number">{{ kb.documentCount || 0 }}</span>
              </div>
              <div class="info-item">
                <span class="label">切片数：</span>
                <span class="value number">{{ kb.chunkCount || 0 }}</span>
              </div>
            </div>
            <div class="info-item" v-if="kb.retrievalMethod !== 'bm25'">
              <span class="label">向量模型：</span>
              <span class="value">{{ kb.embeddingModel }}</span>
            </div>
            <div class="info-item">
              <span class="label">检索方式：</span>
              <span class="value">{{ kb.retrievalMethod === 'bm25' ? 'BM25检索' : '向量检索' }}</span>
            </div>
          </div>

          <template #footer>
            <div class="card-footer">
              <el-button size="small" @click="handleView(kb)">
                <el-icon>
                  <View />
                </el-icon>
                查看
              </el-button>
              <el-button size="small" @click="handleEdit(kb)">
                <el-icon>
                  <Edit />
                </el-icon>
                编辑
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(kb)">
                <el-icon>
                  <Delete />
                </el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-card>
      </div>

      <div class="pagination">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[12, 24, 48, 96]"
          :total="total" layout="total, sizes, prev, pager, next, jumper" />
      </div>
    </div>

    <KbEditDialog v-model:visible="dialogVisible" :edit-data="editData" @success="fetchKbList" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, FolderOpened, View, Edit, Delete } from '@element-plus/icons-vue'
import { kbApi } from '@/api'
import type { KbInfo } from '@/api/kb'
import { useUserStore } from '@/stores/user'
import KbEditDialog from './components/KbEditDialog.vue'
import AppSelector from '@/components/AppSelector.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const kbList = ref<KbInfo[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)
const searchKeyword = ref('')
const statusFilter = ref<boolean | ''>('')
const filterAppCode = ref('')

const isSuperAdmin = computed(() => userStore.isSuperAdmin)

const dialogVisible = ref(false)
const editData = ref<KbInfo | null>(null)

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

const handleAppFilterChange = () => {
  currentPage.value = 1
  fetchKbList()
}

watch(pageSize, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    currentPage.value = 1
    fetchKbList()
  }
})

watch(currentPage, (newVal, oldVal) => {
  if (newVal !== oldVal && oldVal !== undefined) {
    fetchKbList()
  }
})

const handleCreate = () => {
  editData.value = null
  dialogVisible.value = true
}

const handleView = (kb: KbInfo) => {
  router.push(`/kb/detail/${kb.kbId}`)
}

const handleEdit = (kb: KbInfo) => {
  editData.value = kb
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

onMounted(() => {
  fetchKbList()
})
</script>

<style scoped lang="scss">
.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  min-height: 400px;
  margin-bottom: 20px;
}

.kb-card {
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;

      .kb-icon {
        font-size: 20px;
        color: #409eff;
        flex-shrink: 0;
      }

      .kb-name {
        font-size: 16px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .card-content {
    .info-item {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      font-size: 14px;

      .label {
        color: #909399;
        min-width: 70px;
        flex-shrink: 0;
      }

      .value {
        color: #303133;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.number {
          font-weight: 600;
          color: #409eff;
        }
      }
    }

    .info-row {
      display: flex;
      gap: 20px;
      margin-bottom: 12px;

      .info-item {
        flex: 1;
        margin-bottom: 0;
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
</style>
