<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ $t('knowledge.title') }}</h1>
      <p class="page-description">{{ $t('knowledge.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">{{ $t('knowledge.helpTip.title') }}</div>
      <ul>
        <li><strong>{{ $t('knowledge.list.identifier') }}</strong>：{{ $t('knowledge.helpTip.knowledgeBase') }}</li>
        <li><strong>{{ $t('knowledge.list.vectorModel') }}</strong>：{{ $t('knowledge.helpTip.vectorModel') }}</li>
        <li><strong>{{ $t('knowledge.detail.chunkSize') }}</strong>：{{ $t('knowledge.helpTip.chunkSize') }}</li>
        <li><strong>{{ $t('knowledge.detail.similarityThreshold') }}</strong>：{{ $t('knowledge.helpTip.similarityThreshold') }}</li>
        <li><strong>{{ $t('knowledge.detail.topN') }}</strong>：{{ $t('knowledge.helpTip.topN') }}</li>
      </ul>
    </div>

    <div class="card">

      <div class="filters">
        <el-button type="primary" @click="handleCreate">
          <el-icon>
            <Plus />
          </el-icon>
          {{ $t('knowledge.actions.create') }}
        </el-button>
        <el-input v-model="searchKeyword" :placeholder="$t('knowledge.filter.placeholder')" style="width: 300px;"
          @keyup.enter="handleSearch">
          <template #prefix>
            <el-icon>
              <Search />
            </el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" :placeholder="$t('knowledge.filter.statusFilter')" style="width: 150px;"
          @change="handleSearch">
          <el-option :label="$t('knowledge.filter.all')" value="" />
          <el-option :label="$t('knowledge.filter.enabled')" :value="true" />
          <el-option :label="$t('knowledge.filter.disabled')" :value="false" />
        </el-select>
        <el-button @click="handleSearch">
          <el-icon>
            <Search />
          </el-icon>
          {{ $t('knowledge.actions.search') }}
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
                {{ kb.status ? $t('knowledge.filter.enabled') : $t('knowledge.filter.disabled') }}
              </el-tag>
            </div>
          </template>

          <div class="card-content">
            <div class="info-item">
              <span class="label">{{ $t('knowledge.list.identifier') }}：</span>
              <el-tag type="info" size="small">{{ kb.kbCode }}</el-tag>
            </div>
            <div class="info-item">
              <span class="label">{{ $t('knowledge.list.appCode') }}：</span>
              <el-tag v-if="kb.appCode" type="warning" size="small">{{ kb.appCode }}</el-tag>
              <span v-else class="value">{{ $t('knowledge.filter.global') }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ $t('knowledge.list.visibility') }}：</span>
              <el-tag :type="kb.isPublic ? 'success' : 'info'" size="small">
                {{ kb.isPublic ? $t('knowledge.filter.public') : $t('knowledge.filter.private') }}
              </el-tag>
            </div>
            <div class="info-item" v-if="kb.description">
              <span class="label">{{ $t('knowledge.list.description') }}：</span>
              <span class="value">{{ kb.description }}</span>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="label">{{ $t('knowledge.list.documentCount') }}：</span>
                <span class="value number">{{ kb.documentCount || 0 }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ $t('knowledge.list.chunkCount') }}：</span>
                <span class="value number">{{ kb.chunkCount || 0 }}</span>
              </div>
            </div>
            <div class="info-item" v-if="kb.retrievalMethod !== 'bm25'">
              <span class="label">{{ $t('knowledge.list.vectorModel') }}：</span>
              <span class="value">{{ kb.embeddingModel }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ $t('knowledge.list.retrievalMethod') }}：</span>
              <span class="value">{{
                kb.retrievalMethod === 'bm25' ? $t('knowledge.list.bm25Retrieval') : $t('knowledge.list.vectorRetrieval')
              }}</span>
            </div>
          </div>

          <template #footer>
            <div class="card-footer">
              <el-button size="small" @click="handleView(kb)">
                <el-icon>
                  <View />
                </el-icon>
                {{ $t('knowledge.actions.manage') }}
              </el-button>
              <el-button size="small" @click="handleEdit(kb)">
                <el-icon>
                  <Edit />
                </el-icon>
                {{ $t('knowledge.actions.edit') }}
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(kb)">
                <el-icon>
                  <Delete />
                </el-icon>
                {{ $t('knowledge.actions.delete') }}
              </el-button>
            </div>
          </template>
        </el-card>
      </div>

      <div class="pagination">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
          :page-sizes="[12, 24, 48, 96]" :total="total"
          layout="total, sizes, prev, pager, next, jumper" />
      </div>
    </div>

    <KbEditDrawer v-model:visible="dialogVisible" :edit-data="editData" @success="fetchKbList" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, FolderOpened, View, Edit, Delete } from '@element-plus/icons-vue'
import { kbApi } from '@/api'
import type { KbInfo } from '@/api/kb'
import KbEditDrawer from './components/KbEditDrawer.vue'

const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const kbList = ref<KbInfo[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)
const searchKeyword = ref('')
const statusFilter = ref<boolean | ''>('')

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
    ElMessage.error(error.message || t('knowledge.messages.fetchListFailed'))
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
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
    await ElMessageBox.confirm(t('knowledge.messages.deleteConfirm'), t('knowledge.messages.deleteConfirmTitle'), {
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

    await kbApi.delete(user.id, kb.kbId)
    ElMessage.success(t('knowledge.messages.deleteSuccess'))
    fetchKbList()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || t('knowledge.messages.deleteFailed'))
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
