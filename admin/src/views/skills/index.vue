<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('skill.title') }}</h1>
      <p class="page-description">{{ t('skill.description') }}</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">{{ t('skill.helpTip.title') }}</div>
      <ul>
        <li><strong>{{ t('skill.helpTip.cacheArchitecture') }}</strong>：{{ t('skill.helpTip.cacheArchitectureDesc') }}</li>
        <li><strong>{{ t('skill.helpTip.dataSource') }}</strong>：{{ t('skill.helpTip.dataSourceDesc') }}</li>
        <li><strong>{{ t('skill.helpTip.syncMechanism') }}</strong>：{{ t('skill.helpTip.syncMechanismDesc') }}</li>
        <li><strong>{{ t('skill.helpTip.agentSkillsV1') }}</strong>：{{ t('skill.helpTip.agentSkillsV1Desc') }}</li>
      </ul>
    </div>

    <!-- 缓存统计信息 -->
    <div class="card" v-if="skillStats?.cacheConfig">
      <div class="card-title">{{ t('skill.cache.title') }}</div>
      <div class="cache-stats">
        <div class="stat-item">
          <div class="stat-label">{{ t('skill.cache.l1Metadata') }}</div>
          <div class="stat-value">{{ t('skill.cache.minutes', { value: skillStats.cacheConfig.l1TtlMinutes }) }}</div>
          <div class="stat-desc">{{ t('skill.cache.redisCache') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('skill.cache.l2Descriptor') }}</div>
          <div class="stat-value">{{ t('skill.cache.minutes', { value: skillStats.cacheConfig.l2TtlMinutes }) }}</div>
          <div class="stat-desc">{{ t('skill.cache.memoryLRU') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('skill.cache.l3Reference') }}</div>
          <div class="stat-value">{{ t('skill.cache.minutes', { value: skillStats.cacheConfig.l3TtlMinutes }) }}</div>
          <div class="stat-desc">{{ t('skill.cache.redisCache') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('skill.cache.l2MaxCapacity') }}</div>
          <div class="stat-value">{{ skillStats.cacheConfig.l2MaxSize }}</div>
          <div class="stat-desc">{{ t('skill.cache.unit') }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="filesystem-header">
        <el-space>
          <el-button type="primary" @click="importDialogVisible = true">
            <el-icon>
              <Upload />
            </el-icon>
            {{ t('skill.actions.importSkill') }}
          </el-button>
          <el-button @click="handleSync" :loading="syncing">
            <el-icon>
              <Refresh />
            </el-icon>
            {{ t('skill.actions.syncDatabase') }}
          </el-button>
          <el-button @click="handleScan" :loading="scanning">
            <el-icon>
              <Refresh />
            </el-icon>
            {{ t('skill.actions.scan') }}
          </el-button>
          <el-button @click="handleRefreshIndex">
            <el-icon>
              <RefreshRight />
            </el-icon>
            {{ t('skill.actions.refreshIndex') }}
          </el-button>
          <el-button @click="handleClearCache">
            <el-icon>
              <Delete />
            </el-icon>
            {{ t('skill.actions.clearCache') }}
          </el-button>
        </el-space>
      </div>

      <!-- 搜索和排序 -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('skill.search.placeholder')"
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">
              <el-icon><Search /></el-icon>
            </el-button>
          </template>
        </el-input>

        <el-space>
          <el-select
            v-model="localSortBy"
            :placeholder="t('skill.search.sortField')"
            class="sort-select"
            @change="handleSortChange"
          >
            <el-option :label="t('skill.search.sortFieldOptions.name')" value="name" />
            <el-option :label="t('skill.search.sortFieldOptions.description')" value="description" />
            <el-option :label="t('skill.search.sortFieldOptions.source')" value="source" />
            <el-option :label="t('skill.search.sortFieldOptions.appCode')" value="appCode" />
          </el-select>
          <el-select
            v-model="localSortOrder"
            :placeholder="t('skill.search.sortOrder')"
            class="sort-select"
            @change="handleSortChange"
          >
            <el-option :label="t('skill.search.sortOrderOptions.asc')" value="asc" />
            <el-option :label="t('skill.search.sortOrderOptions.desc')" value="desc" />
          </el-select>
        </el-space>
      </div>

      <el-table :data="filteredSkills" stripe v-loading="scanning">
        <el-table-column prop="name" :label="t('skill.table.name')" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="handlePreviewSkillMd(row.name)">{{ row.name }}</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="t('skill.table.description')" min-width="200">
          <template #default="{ row }">
            {{ row.description?.substring(0, 80) }}{{ row.description?.length > 80 ? '...' : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="source" :label="t('skill.table.source')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.source === 'database' ? 'success' : 'warning'" size="small">
              {{ row.source === 'database' ? t('skill.table.sourceTags.database') : t('skill.table.sourceTags.filesystem') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hasScripts" :label="t('skill.table.script')" width="70">
          <template #default="{ row }">
            <el-tag :type="row.hasScripts ? 'warning' : 'info'" size="small">
              {{ row.hasScripts ? t('skill.table.hasTags.yes') : t('skill.table.hasTags.no') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hasReferences" :label="t('skill.table.references')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.hasReferences ? 'warning' : 'info'" size="small">
              {{ row.hasReferences ? t('skill.table.hasTags.yes') : t('skill.table.hasTags.no') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hasAssets" :label="t('skill.table.assets')" width="70">
          <template #default="{ row }">
            <el-tag :type="row.hasAssets ? 'warning' : 'info'" size="small">
              {{ row.hasAssets ? t('skill.table.hasTags.yes') : t('skill.table.hasTags.no') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" :label="t('skill.table.appCode')" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" size="small" type="warning">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999; font-size: 12px;">{{ t('skill.table.hasTags.publicTag') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" :label="t('skill.table.isPublic')" width="70">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? t('skill.table.hasTags.publicYes') : t('skill.table.hasTags.publicNo') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('skill.table.operation')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handlePreviewSkillMd(row.name)">{{ t('skill.table.viewDetail') }}</el-button>
            <el-button size="small" type="danger" link @click="handleClearSkillCache(row.name)">{{ t('skill.table.clearSkillCache') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页组件 -->
      <div class="pagination-container">
        <span class="pagination-info">{{ t('skill.pagination.total', { total }) }}</span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>

      <el-empty v-if="filteredSkills.length === 0 && !scanning" :description="t('skill.empty')" />
    </div>

    <!-- 技能导入对话框 -->
    <SkillImportDialog v-model:visible="importDialogVisible" @imported="handleImported" />

    <!-- SKILL.md 预览抽屉 -->
    <el-drawer v-model="previewDialogVisible" :title="t('skill.preview.drawerTitle')" direction="rtl" size="50%" :destroy-on-close="true">
      <div class="preview-drawer-content">
        <SkillMdPreview v-if="previewSkillData" :frontmatter="previewSkillData.frontmatter"
          :body="previewSkillData.body" :raw-content="previewSkillData.rawContent" />
        <el-empty v-else :description="t('skill.preview.loading')" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight, Upload, Delete, Search } from '@element-plus/icons-vue'
import { useSkillStore } from '@/stores'
import { skillApi, type StandardSkill } from '@/api/skill'
import SkillImportDialog from './components/SkillImportDialog.vue'
import SkillMdPreview from './components/SkillMdPreview.vue'

const { t } = useI18n()
const skillStore = useSkillStore()
const { 
  scanning, 
  syncing,
  currentPage,
  pageSize,
  total,
} = storeToRefs(skillStore)

const {
  loadStandardSkills, 
  scanSkills, 
  refreshIndex, 
  syncToDatabase, 
  invalidateSkillCache, 
  confirmClearAllCache, 
  loadSkillStats,
} = skillStore

const filterAppCode = ref('')

// 搜索关键词
const searchKeyword = ref('')

// 本地排序字段（用于绑定到select）
const localSortBy = ref<string>('name')
const localSortOrder = ref<'asc' | 'desc'>('asc')

// 计算属性：标准技能列表
const standardSkills = computed(() => skillStore.standardSkills)
// 计算属性：技能统计信息
const skillStats = computed(() => skillStore.skillStats)

// 本地搜索过滤
const filteredSkills = computed(() => {
  if (!searchKeyword.value) {
    return standardSkills.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return standardSkills.value.filter(
    (skill: StandardSkill) =>
      skill.name.toLowerCase().includes(keyword) ||
      (skill.description && skill.description.toLowerCase().includes(keyword))
  )
})

const importDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const previewSkillData = ref<{ frontmatter: Record<string, unknown>; body: string; rawContent: string } | null>(null)

// 处理扫描点击事件
const handleScan = async () => {
  await scanSkills()
}

// 处理刷新索引点击事件
const handleRefreshIndex = async () => {
  await refreshIndex()
}

// 处理同步点击事件
const handleSync = async () => {
  await syncToDatabase()
}

// 处理清除缓存点击事件
const handleClearCache = async () => {
  await confirmClearAllCache()
}

// 处理清除技能缓存点击事件
const handleClearSkillCache = async (name: string) => {
  await invalidateSkillCache(name)
}

const handlePreviewSkillMd = async (name: string) => {
  previewDialogVisible.value = true
  previewSkillData.value = null
  try {
    const res = await skillApi.getSkillMdPreview(name)
    const data = res.data?.data
    if (data) {
      previewSkillData.value = {
        frontmatter: data.frontmatter || {},
        body: data.body || '',
        rawContent: data.rawContent || '',
      }
    }
  } catch (error: any) {
    ElMessage.error(t('skill.preview.loadFailed', { error: error.response?.data?.message || error.message }))
    previewDialogVisible.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  loadStandardSkills(filterAppCode.value, currentPage.value, pageSize.value, localSortBy.value, localSortOrder.value)
}

// 排序变化处理
const handleSortChange = () => {
  currentPage.value = 1
  loadStandardSkills(filterAppCode.value, currentPage.value, pageSize.value, localSortBy.value, localSortOrder.value)
}

// 页码变化处理
const handlePageChange = (page: number) => {
  loadStandardSkills(filterAppCode.value, page, pageSize.value, localSortBy.value, localSortOrder.value)
}

// 每页大小变化处理
const handlePageSizeChange = (size: number) => {
  currentPage.value = 1
  loadStandardSkills(filterAppCode.value, currentPage.value, size, localSortBy.value, localSortOrder.value)
}

const handleImported = () => {
  currentPage.value = 1
  loadStandardSkills(filterAppCode.value, currentPage.value, pageSize.value, localSortBy.value, localSortOrder.value)
}

onMounted(() => {
  localSortBy.value = skillStore.sortBy
  localSortOrder.value = skillStore.sortOrder
  loadStandardSkills(filterAppCode.value)
  loadSkillStats()
})

// 监听排序字段变化
watch(() => skillStore.sortBy, (newVal) => {
  localSortBy.value = newVal
})

watch(() => skillStore.sortOrder, (newVal) => {
  localSortOrder.value = newVal
})
</script>

<style lang="scss" scoped>
.filesystem-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .filesystem-tip {
    font-size: 13px;
    color: #606266;
  }
}

.preview-drawer-content {
  height: 100%;
  overflow-y: auto;
  padding: 0 16px;
}

.cache-stats {
  display: flex;
  gap: 24px;
  padding: 16px 0;

  .stat-item {
    flex: 1;
    text-align: center;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;

    .stat-label {
      font-size: 12px;
      color: #909399;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }

    .stat-desc {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
  }
}

.search-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;

  .search-input {
    width: 300px;
  }

  .sort-select {
    width: 120px;
  }
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;

  .pagination-info {
    font-size: 13px;
    color: #606266;
  }
}
</style>