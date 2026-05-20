<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">技能管理</h1>
      <p class="page-description">管理 Agent Skills 标准格式技能，实现三层缓存架构</p>
    </div>

    <div class="help-tip">
      <div class="help-tip-title">技能管理说明</div>
      <ul>
        <li><strong>三层缓存架构</strong>：L1元数据(Redis 30分钟) → L2描述符(内存 5分钟) → L3参考文档(Redis 1小时)</li>
        <li><strong>数据来源</strong>：Database优先查询，文件系统作为回源</li>
        <li><strong>同步机制</strong>：扫描文件系统后自动同步到数据库，清除缓存生效</li>
        <li><strong>Agent Skills V1.0</strong>：所有技能以 SKILL.md + scripts/ + references/ 目录结构存储</li>
      </ul>
    </div>

    <!-- 缓存统计信息 -->
    <div class="card" v-if="skillStats?.cacheConfig">
      <div class="card-title">缓存架构</div>
      <div class="cache-stats">
        <div class="stat-item">
          <div class="stat-label">L1 技能元数据</div>
          <div class="stat-value">{{ skillStats.cacheConfig.l1TtlMinutes }}分钟</div>
          <div class="stat-desc">Redis缓存</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">L2 技能描述符</div>
          <div class="stat-value">{{ skillStats.cacheConfig.l2TtlMinutes }}分钟</div>
          <div class="stat-desc">内存LRU缓存</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">L3 参考文档</div>
          <div class="stat-value">{{ skillStats.cacheConfig.l3TtlMinutes }}分钟</div>
          <div class="stat-desc">Redis缓存</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">L2 最大容量</div>
          <div class="stat-value">{{ skillStats.cacheConfig.l2MaxSize }}</div>
          <div class="stat-desc">条</div>
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
            导入技能
          </el-button>
          <el-button @click="handleSync" :loading="syncing">
            <el-icon>
              <Refresh />
            </el-icon>
            同步数据库
          </el-button>
          <el-button @click="handleScan" :loading="scanning">
            <el-icon>
              <Refresh />
            </el-icon>
            扫描
          </el-button>
          <el-button @click="handleRefreshIndex">
            <el-icon>
              <RefreshRight />
            </el-icon>
            刷新索引
          </el-button>
          <el-button @click="handleClearCache">
            <el-icon>
              <Delete />
            </el-icon>
            清除缓存
          </el-button>
        </el-space>
      </div>

      <el-table :data="standardSkills" stripe v-loading="scanning">
        <el-table-column prop="name" label="名称" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="handlePreviewSkillMd(row.name)">{{ row.name }}</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200">
          <template #default="{ row }">
            {{ row.description?.substring(0, 80) }}{{ row.description?.length > 80 ? '...' : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="90">
          <template #default="{ row }">
            <el-tag :type="row.source === 'database' ? 'success' : 'warning'" size="small">
              {{ row.source === 'database' ? '数据库' : '文件系统' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hasScripts" label="脚本" width="70">
          <template #default="{ row }">
            <el-tag :type="row.hasScripts ? 'warning' : 'info'" size="small">
              {{ row.hasScripts ? '有' : '无' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hasReferences" label="参考文档" width="90">
          <template #default="{ row }">
            <el-tag :type="row.hasReferences ? 'warning' : 'info'" size="small">
              {{ row.hasReferences ? '有' : '无' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hasAssets" label="资源" width="70">
          <template #default="{ row }">
            <el-tag :type="row.hasAssets ? 'warning' : 'info'" size="small">
              {{ row.hasAssets ? '有' : '无' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" label="所属应用" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" size="small" type="warning">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999; font-size: 12px;">公开</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" label="公开" width="70">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handlePreviewSkillMd(row.name)">查看详情</el-button>
            <el-button size="small" type="danger" link @click="handleClearSkillCache(row.name)">清除缓存</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="standardSkills.length === 0 && !scanning" description="暂无标准技能，点击扫描发现或导入新技能" />
    </div>

    <!-- 技能导入对话框 -->
    <SkillImportDialog v-model:visible="importDialogVisible" @imported="handleImported" />

    <!-- SKILL.md 预览抽屉 -->
    <el-drawer v-model="previewDialogVisible" title="SKILL.md 预览" direction="rtl" size="50%" :destroy-on-close="true">
      <div class="preview-drawer-content">
        <SkillMdPreview v-if="previewSkillData" :frontmatter="previewSkillData.frontmatter"
          :body="previewSkillData.body" :raw-content="previewSkillData.rawContent" />
        <el-empty v-else description="加载中..." />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight, Upload, Delete } from '@element-plus/icons-vue'
import { useSkillStore } from '@/stores'
import { skillApi } from '@/api/skill'
import SkillImportDialog from './components/SkillImportDialog.vue'
import SkillMdPreview from './components/SkillMdPreview.vue'

const skillStore = useSkillStore()

const filterAppCode = ref('')
const { scanning, syncing, loadStandardSkills, scanSkills, refreshIndex, syncToDatabase, invalidateSkillCache, confirmClearAllCache, loadSkillStats } = skillStore

// 计算属性：标准技能列表
const standardSkills = computed(() => skillStore.standardSkills)
// 计算属性：技能统计信息
const skillStats = computed(() => skillStore.skillStats)

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
    ElMessage.error('加载 SKILL.md 失败: ' + (error.response?.data?.message || error.message))
    previewDialogVisible.value = false
  }
}

const handleImported = () => {
  loadStandardSkills(filterAppCode.value)
}

onMounted(() => {
  loadStandardSkills(filterAppCode.value)
  loadSkillStats()
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
</style>