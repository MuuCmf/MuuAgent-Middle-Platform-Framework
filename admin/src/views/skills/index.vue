<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">技能管理</h1>
      <p class="page-description">管理智能体可调用的技能工具</p>
    </div>

    <div class="card">
      <div class="card-title">
        <span>技能列表</span>
        <el-tag type="info" size="small">{{ skills.length }} 个</el-tag>
        <AppSelector
          v-if="isSuperAdmin"
          v-model="filterAppCode"
          placeholder="筛选应用"
          style="margin-left: 16px;"
          @change="handleAppFilterChange"
        />
      </div>

      <div class="help-tip">
        <div class="help-tip-title">💡 技能管理说明</div>
        <ul>
          <li><strong>HTTP类型</strong>：调用外部HTTP API，如天气接口、查询服务等</li>
          <li><strong>函数类型</strong>：内置函数，如获取时间、随机数等</li>
          <li><strong>数据库类型</strong>：执行数据库查询（需配置连接）</li>
          <li><strong>MCP类型</strong>：调用第三方MCP Server提供的工具，支持Model Context Protocol协议</li>
          <li><strong>文件类型</strong>：文件操作技能，支持上传、下载、处理等操作</li>
          <li><strong>功能描述</strong>：给AI看的描述，AI根据描述决定是否调用此技能</li>
          <li><strong>参数描述</strong>：描述技能需要的参数格式，帮助AI正确传参</li>
        </ul>
      </div>
      <el-space style="margin-bottom: 16px;">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          添加技能
        </el-button>
        <el-button type="success" @click="selectSkillDialogVisible = true">
          <el-icon><MagicStick /></el-icon>
          智能选择技能
        </el-button>
        <el-button @click="handleImport">
          <el-icon><Upload /></el-icon>
          导入技能
        </el-button>
        <el-button @click="handleScan" :loading="scanning">
          <el-icon><Refresh /></el-icon>
          扫描标准技能
        </el-button>
      </el-space>

      <!-- 来源筛选 -->
      <el-radio-group v-model="sourceFilter" size="small" style="margin-bottom: 12px; margin-left: 8px;">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="database">数据库</el-radio-button>
        <el-radio-button label="filesystem">文件系统</el-radio-button>
      </el-radio-group>

      <el-table :data="skills" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" width="120" />
        <el-table-column prop="code" label="标识" width="150">
          <template #default="{ row }">
            <el-tag type="info">{{ row.code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source === 'filesystem' ? 'success' : ''">
              {{ row.source === 'filesystem' ? '文件系统' : '数据库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="appCode" label="所属应用" width="100" v-if="isSuperAdmin">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" type="warning" size="small">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999">全局</span>
          </template>
        </el-table-column>
        <el-table-column prop="isPublic" label="公开状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">
              {{ row.isPublic ? '公开' : '私有' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="150">
          <template #default="{ row }">
            {{ row.description?.substring(0, 50) }}{{ row.description?.length > 50 ? '...' : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'" size="small">
              {{ row.status ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleTest(row)">测试</el-button>
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-if="!row.source || row.source === 'database'"
              size="small"
              type="warning"
              @click="handleExport(row)"
            >导出</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 文件系统技能表 -->
    <div v-if="standardSkills.length > 0 && sourceFilter !== 'database'" class="card" style="margin-top: 16px;">
      <div class="card-title">
        <span>标准技能（文件系统）</span>
        <el-tag type="success" size="small">{{ standardSkills.length }} 个</el-tag>
        <span style="font-size: 12px; color: #909399; margin-left: 12px;">基于 Agent Skills 开放标准，从 skills/standard/ 目录扫描发现</span>
      </div>
      <el-table :data="standardSkills" stripe size="small">
        <el-table-column prop="name" label="名称" width="150">
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
        <el-table-column prop="appCode" label="所属应用" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.appCode" size="small" type="warning">{{ row.appCode }}</el-tag>
            <span v-else style="color: #999; font-size: 12px;">公开</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 技能导入对话框 -->
    <SkillImportDialog v-model:visible="importDialogVisible" @imported="handleImported" />

    <!-- SKILL.md 预览对话框 -->
    <el-dialog v-model="previewDialogVisible" title="SKILL.md 预览" width="700px">
      <SkillMdPreview
        v-if="previewSkillData"
        :frontmatter="previewSkillData.frontmatter"
        :body="previewSkillData.body"
        :raw-content="previewSkillData.rawContent"
      />
      <el-empty v-else description="加载中..." />
    </el-dialog>

    <SkillEditDrawer v-model:visible="drawerVisible" :skill="editingSkill" @save="handleSave" />

    <el-dialog v-model="testDialogVisible" title="🧪 测试技能" width="600px">
      <div class="test-dialog-content">
        <div class="test-skill-info">
          <p><strong>技能名称：</strong>{{ testingSkill?.name }}</p>
          <p><strong>技能标识：</strong><el-tag type="info" size="small">{{ testingSkill?.code }}</el-tag></p>
          <p><strong>技能类型：</strong><el-tag size="small">{{ testingSkill?.type }}</el-tag></p>
          <p><strong>功能描述：</strong>{{ testingSkill?.description }}</p>
        </div>

        <el-divider />

        <el-form label-width="80px">
          <el-form-item label="测试参数">
            <el-input v-model="testParams" type="textarea" :rows="5" placeholder='请输入JSON格式的参数，如：{"city": "北京"}' />
            <div class="test-params-help">
              <el-alert type="info" :closable="false" style="margin-top: 8px;">
                <template #title>
                  <strong>📝 参数说明</strong>
                </template>
                <div v-if="testingSkill?.params">
                  <p style="margin: 0;">该技能定义的参数格式：</p>
                  <pre class="params-example">{{ testingSkill.params }}</pre>
                </div>
                <div v-else>
                  <p style="margin: 0; color: #999;">该技能无需参数</p>
                </div>
              </el-alert>
            </div>
          </el-form-item>
        </el-form>

        <el-divider />

        <div v-if="testResult" class="test-result">
          <p><strong>执行结果：</strong></p>
          <pre class="result-content" :class="{ 'is-error': testError }">{{ testResult }}</pre>
        </div>
      </div>

      <template #footer>
        <div style="text-align: right;">
          <el-button @click="testDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="executeTest" :loading="testLoading">
            执行测试
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="selectSkillDialogVisible" title="智能选择技能" width="700px">
      <div class="select-dialog-content">
        <el-form label-width="100px">
          <el-form-item label="用户请求">
            <el-input v-model="selectUserRequest" type="textarea" :rows="3" placeholder="请输入用户请求，如：帮我查询北京的天气" />
          </el-form-item>

          <el-form-item label="可用技能">
            <el-checkbox-group v-model="selectedSkillCodes">
              <el-checkbox v-for="skill in skills" :key="skill.code" :label="skill.code">
                {{ skill.name }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>

        <el-divider />

        <div v-if="selectSkillResult" class="select-result">
          <h4>选择结果</h4>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="技能标识">
              <el-tag type="primary">{{ selectSkillResult.skillCode }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="参数">
              <pre class="params-json">{{ JSON.stringify(selectSkillResult.params, null, 2) }}</pre>
            </el-descriptions-item>
            <el-descriptions-item v-if="selectSkillResult.reason" label="选择理由">
              {{ selectSkillResult.reason }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template #footer>
        <el-button @click="selectSkillDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="executeSelectSkill" :loading="selectSkillLoading">
          智能选择
        </el-button>
      </template>
    </el-dialog>


  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, Upload, Refresh } from '@element-plus/icons-vue'
import { useSkillStore, useUserStore } from '@/stores'
import { skillApi } from '@/api/skill'
import type { Skill, SkillForm } from '@/api/skill'
import SkillEditDrawer from './components/SkillEditDrawer.vue'
import SkillImportDialog from './components/SkillImportDialog.vue'
import SkillMdPreview from './components/SkillMdPreview.vue'
import AppSelector from '@/components/AppSelector.vue'

const skillStore = useSkillStore()
const userStore = useUserStore()
const { loadSkills, createSkill, updateSkill, deleteSkill } = skillStore

const skills = computed(() => skillStore.skills)
const loading = computed(() => skillStore.loading)
const isSuperAdmin = computed(() => userStore.isSuperAdmin)
const filterAppCode = ref('')


const drawerVisible = ref(false)
const editingSkill = ref<Skill | null>(null)

const testDialogVisible = ref(false)
const testingSkill = ref<Skill | null>(null)
const testParams = ref('{}')
const testResult = ref('')
const testError = ref(false)
const testLoading = ref(false)

const selectSkillDialogVisible = ref(false)
const selectUserRequest = ref('')
const selectedSkillCodes = ref<string[]>([])
const selectSkillResult = ref<{ skillCode: string; params: Record<string, unknown>; reason?: string } | null>(null)
const selectSkillLoading = ref(false)

// 标准技能 & 导入导出
const sourceFilter = ref('all')
const importDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const previewSkillData = ref<{ frontmatter: Record<string, unknown>; body: string; rawContent: string } | null>(null)
const { standardSkills, scanning, loadStandardSkills, scanSkills, exportSkill } = skillStore

const handleAppFilterChange = () => {
  loadSkills()
}

const handleAdd = () => {
  editingSkill.value = null
  drawerVisible.value = true
}

const handleEdit = (skill: Skill) => {
  editingSkill.value = skill
  drawerVisible.value = true
}

const handleSave = async (form: SkillForm, callback: () => void) => {
  try {
    if (editingSkill.value) {
      await updateSkill(editingSkill.value.id, form)
    } else {
      await createSkill(form)
    }
    callback()
  } catch (error) {
    console.error('保存失败', error)
  }
}

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除该技能？', '提示', {
      type: 'warning'
    })
    await deleteSkill(id)
    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除失败', error)
  }
}

const handleTest = (skill: Skill) => {
  testingSkill.value = skill
  testParams.value = skill.params || '{}'
  testResult.value = ''
  testError.value = false
  testDialogVisible.value = true
}

const executeTest = async () => {
  if (!testingSkill.value) return

  let params = {}
  try {
    params = JSON.parse(testParams.value)
  } catch {
    ElMessage.error('参数格式错误，请输入有效的JSON')
    return
  }

  testLoading.value = true
  testResult.value = ''
  testError.value = false

  try {
    const res = await skillApi.execute(testingSkill.value.code, params)
    testResult.value = JSON.stringify(res.data?.data || res.data, null, 2)
    ElMessage.success('执行成功')
  } catch (error: any) {
    testError.value = true
    testResult.value = error.response?.data?.message || error.message || '执行失败'
    ElMessage.error('执行失败')
  } finally {
    testLoading.value = false
  }
}

const executeSelectSkill = async () => {
  if (!selectUserRequest.value.trim()) {
    ElMessage.warning('请输入用户请求')
    return
  }

  if (selectedSkillCodes.value.length === 0) {
    ElMessage.warning('请至少选择一个可用技能')
    return
  }

  selectSkillLoading.value = true
  selectSkillResult.value = null
  try {
    const response = await skillApi.selectSkill({
      userRequest: selectUserRequest.value,
      availableSkills: selectedSkillCodes.value,
    })
    selectSkillResult.value = response.data.data
    ElMessage.success('智能选择成功')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || error.message || '智能选择失败')
  } finally {
    selectSkillLoading.value = false
  }
}

const handleImport = () => {
  importDialogVisible.value = true
}

const handleScan = async () => {
  await scanSkills()
}

const handleExport = async (skill: Skill) => {
  await exportSkill(skill.id, skill.code)
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
  loadSkills()
  loadStandardSkills()
}

onMounted(() => {
  loadSkills()
  loadStandardSkills()
})
</script>

<style lang="scss" scoped>
.test-dialog-content {
  max-height: 65vh;
  overflow-y: auto;
  padding-right: 4px;

  .test-skill-info {
    p {
      margin: 8px 0;
      line-height: 1.6;
    }
  }

  .test-params-help {
    .params-example {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      margin-top: 8px;
      max-height: 200px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .test-result {
    .result-content {
      background: #f0f9eb;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #e1f3d8;

      &.is-error {
        background: #fef0f0;
        border-color: #fde2e2;
        color: #f56c6c;
      }
    }
  }
}

.render-dialog-content {
  .render-skill-info {
    p {
      margin: 8px 0;
      line-height: 1.6;
    }
  }

  .render-result {
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
  }
}

.select-dialog-content {
  .select-result {
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }

    .params-json {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      margin: 0;
      overflow-x: auto;
    }
  }
}
</style>
