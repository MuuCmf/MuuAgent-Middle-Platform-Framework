<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">技能管理</h1>
      <p class="page-description">管理 Agent Skills 标准格式技能，所有技能存储在文件系统中</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>标准技能</span>
        <AppSelector
          v-if="isSuperAdmin"
          v-model="filterAppCode"
          placeholder="筛选应用"
          style="margin-left: 16px;"
          @change="handleAppFilterChange"
        />
      </div>

      <div class="help-tip">
        <div class="help-tip-title">技能管理说明</div>
        <ul>
          <li><strong>Agent Skills V1.0 标准</strong>：所有技能以 SKILL.md + scripts/ + references/ 目录结构存储</li>
          <li><strong>渐进式披露</strong>：L1 索引（名称/描述）→ L2 use_skill 加载指令 → L3 load_reference 加载参考文档</li>
          <li><strong>通用能力工具</strong>：http_request / run_code / db_query / run_script 替代原 DB 技能类型</li>
          <li><strong>脚本执行</strong>：技能可包含 scripts/ 目录下的预置脚本（.js / .py / .sh），经安全审计后可由 Agent 调用</li>
        </ul>
      </div>

      <div class="filesystem-header">
        <span class="filesystem-tip">
          从 skills/standard/ 目录扫描发现
          <el-tag type="success" size="small" style="margin-left: 8px;">{{ standardSkills.length }}</el-tag>
        </span>
        <el-space>
          <el-button @click="handleScan" :loading="scanning">
            <el-icon><Refresh /></el-icon>
            扫描
          </el-button>
          <el-button @click="handleRefreshIndex">
            <el-icon><RefreshRight /></el-icon>
            刷新索引
          </el-button>
          <el-button type="primary" @click="importDialogVisible = true">
            <el-icon><Upload /></el-icon>
            导入技能
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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handlePreviewSkillMd(row.name)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="standardSkills.length === 0 && !scanning" description="暂无标准技能，点击扫描发现或导入新技能" />
    </div>

    <!-- 技能导入对话框 -->
    <SkillImportDialog v-model:visible="importDialogVisible" @imported="handleImported" />

    <!-- SKILL.md 预览抽屉 -->
    <el-drawer
      v-model="previewDialogVisible"
      title="SKILL.md 预览"
      direction="rtl"
      size="50%"
      :destroy-on-close="true"
    >
      <div class="preview-drawer-content">
        <SkillMdPreview
          v-if="previewSkillData"
          :frontmatter="previewSkillData.frontmatter"
          :body="previewSkillData.body"
          :raw-content="previewSkillData.rawContent"
        />
        <el-empty v-else description="加载中..." />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight, Upload } from '@element-plus/icons-vue'
import { useSkillStore, useUserStore } from '@/stores'
import { skillApi } from '@/api/skill'
import SkillImportDialog from './components/SkillImportDialog.vue'
import SkillMdPreview from './components/SkillMdPreview.vue'
import AppSelector from '@/components/AppSelector.vue'

const skillStore = useSkillStore()
const userStore = useUserStore()

const isSuperAdmin = computed(() => userStore.isSuperAdmin)
const filterAppCode = ref('')
const { standardSkills, scanning, loadStandardSkills, scanSkills, refreshIndex } = skillStore

const importDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const previewSkillData = ref<{ frontmatter: Record<string, unknown>; body: string; rawContent: string } | null>(null)

const handleAppFilterChange = () => {
  loadStandardSkills(filterAppCode.value)
}

const handleScan = async () => {
  await scanSkills(filterAppCode.value)
}

const handleRefreshIndex = async () => {
  await refreshIndex()
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
</style>
