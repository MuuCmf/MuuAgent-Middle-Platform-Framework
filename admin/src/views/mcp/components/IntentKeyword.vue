<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 关键词规则说明</div>
    <ul>
      <li><strong>意图类型</strong>：general(通用)、code(代码)、math(数学)、creative(创意)、image(生图)、tts(语音合成)、asr(语音识别)</li>
      <li><strong>关键词</strong>：用于匹配用户消息的关键词，支持正则表达式</li>
      <li><strong>权重</strong>：数值越大优先级越高，当多个意图同时匹配时，权重高的优先</li>
      <li><strong>修改后实时生效</strong>：增删改操作会自动刷新运行时缓存，无需重启服务</li>
    </ul>
  </div>

  <div class="card">
    <div class="card-title">
      关键词列表
      <el-tag type="info" size="small">{{ keywordTotal }} 条</el-tag>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <el-button type="primary" @click="handleAddKeyword">
        <el-icon><Plus /></el-icon>
        添加关键词
      </el-button>

      <el-button @click="showBatchImport = true">
        <el-icon><Upload /></el-icon>
        批量导入
      </el-button>

      <el-select v-model="keywordFilterIntent" placeholder="意图类型" clearable style="width: 140px;" @change="loadKeywords">
        <el-option label="通用(general)" value="general" />
        <el-option label="代码(code)" value="code" />
        <el-option label="数学(math)" value="math" />
        <el-option label="创意(creative)" value="creative" />
        <el-option label="生图(image)" value="image" />
        <el-option label="语音合成(tts)" value="tts" />
        <el-option label="语音识别(asr)" value="asr" />
      </el-select>

      <el-select v-model="keywordFilterStatus" placeholder="状态" clearable style="width: 120px;" @change="loadKeywords">
        <el-option label="启用" :value="true" />
        <el-option label="禁用" :value="false" />
      </el-select>

      <el-input v-model="keywordFilterText" placeholder="搜索关键词" clearable style="width: 200px;" @clear="loadKeywords" @keyup.enter="loadKeywords">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-button @click="loadKeywords">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-table :data="keywordList" stripe v-loading="keywordLoading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="intent" label="意图类型" width="140">
        <template #default="{ row }">
          <el-tag :type="getKeywordIntentTagType(row.intent)">{{ getKeywordIntentLabel(row.intent) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="keyword" label="关键词" min-width="200">
        <template #default="{ row }">
          <code style="background: #f5f7fa; padding: 2px 8px; border-radius: 4px;">{{ row.keyword }}</code>
          <el-tag v-if="row.isRegex" type="warning" size="small" style="margin-left: 8px;">正则</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="weight" label="权重" width="80" align="center" />
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status"
            @change="(val: boolean) => handleToggleKeywordStatus(row.id, val)"
            active-text="启用"
            inactive-text="禁用"
          />
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
      <el-table-column prop="updatedAt" label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatKeywordTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="right" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditKeyword(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDeleteKeyword(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
      <el-pagination
        v-model:current-page="keywordPage"
        v-model:page-size="keywordPageSize"
        :total="keywordTotal"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="loadKeywords"
      />
    </div>
  </div>

  <el-dialog v-model="keywordDialogVisible" :title="editingKeyword ? '编辑关键词' : '添加关键词'" width="550px">
    <el-form :model="keywordForm" label-width="100px">
      <el-form-item label="意图类型" required>
        <el-select v-model="keywordForm.intent" style="width: 100%;">
          <el-option label="通用 (general)" value="general" />
          <el-option label="代码 (code)" value="code" />
          <el-option label="数学 (math)" value="math" />
          <el-option label="创意 (creative)" value="creative" />
          <el-option label="生图 (image)" value="image" />
          <el-option label="语音合成 (tts)" value="tts" />
          <el-option label="语音识别 (asr)" value="asr" />
        </el-select>
      </el-form-item>

      <el-form-item label="关键词" required>
        <el-input v-model="keywordForm.keyword" placeholder="输入关键词，如：写代码、画图、翻译" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="权重">
            <el-input-number v-model="keywordForm.weight" :min="1" :max="100" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="正则表达式">
            <el-switch v-model="keywordForm.isRegex" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="描述">
        <el-input v-model="keywordForm.description" type="textarea" :rows="2" placeholder="可选，描述该关键词的用途" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="keywordDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="keywordSubmitting" @click="handleSubmitKeyword">
        {{ editingKeyword ? '更新' : '创建' }}
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showBatchImport" title="批量导入关键词" width="650px">
    <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
      <template #title>
        每行一条，格式：<code>意图类型,关键词,权重,是否正则,描述</code>
      </template>
      <p style="margin-top: 4px;">示例：<code>code,写代码,5,false,代码相关</code></p>
    </el-alert>

    <el-input
      v-model="batchText"
      type="textarea"
      :rows="10"
      placeholder="code,写代码,5,false,代码相关&#10;math,计算,3,false,数学计算&#10;image,/画.*图/,8,true,图像生成"
    />

    <template #footer>
      <el-button @click="showBatchImport = false">取消</el-button>
      <el-button type="primary" :loading="batchImporting" @click="handleBatchImport">
        导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Search, Refresh } from '@element-plus/icons-vue'
import { intentKeywordApi, type IntentKeyword, type IntentKeywordForm } from '@/api/intent-keyword'

const keywordList = ref<IntentKeyword[]>([])
const keywordTotal = ref(0)
const keywordPage = ref(1)
const keywordPageSize = ref(20)
const keywordLoading = ref(false)
const keywordSubmitting = ref(false)
const keywordDialogVisible = ref(false)
const editingKeyword = ref(false)
const editingKeywordId = ref<number | null>(null)

const keywordFilterIntent = ref<string>()
const keywordFilterStatus = ref<boolean>()
const keywordFilterText = ref<string>()

const showBatchImport = ref(false)
const batchText = ref('')
const batchImporting = ref(false)

const keywordForm = reactive<IntentKeywordForm>({
  intent: 'general',
  keyword: '',
  weight: 1,
  isRegex: false,
  description: ''
})

/**
 * 关键词意图标签类型
 */
const getKeywordIntentTagType = (intent: string): string => {
  const map: Record<string, string> = {
    general: 'primary',
    code: 'success',
    math: 'warning',
    creative: 'danger',
    image: 'info',
    tts: 'info',
    asr: 'warning'
  }
  return map[intent] || 'primary'
}

/**
 * 关键词意图标签文本
 */
const getKeywordIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: '通用',
    code: '代码',
    math: '数学',
    creative: '创意',
    image: '生图',
    tts: '语音合成',
    asr: '语音识别'
  }
  return map[intent] || intent
}

/**
 * 格式化关键词时间
 */
const formatKeywordTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

/**
 * 加载关键词列表
 */
const loadKeywords = async () => {
  keywordLoading.value = true
  try {
    const res = await intentKeywordApi.getList({
      intent: keywordFilterIntent.value,
      status: keywordFilterStatus.value,
      keyword: keywordFilterText.value || undefined,
      page: keywordPage.value,
      pageSize: keywordPageSize.value
    })
    keywordList.value = res.data.data?.list || []
    keywordTotal.value = res.data.data?.total || 0
  } catch {
    ElMessage.error('加载关键词列表失败')
  } finally {
    keywordLoading.value = false
  }
}

/**
 * 添加关键词
 */
const handleAddKeyword = () => {
  editingKeyword.value = false
  editingKeywordId.value = null
  keywordForm.intent = 'general'
  keywordForm.keyword = ''
  keywordForm.weight = 1
  keywordForm.isRegex = false
  keywordForm.description = ''
  keywordDialogVisible.value = true
}

/**
 * 编辑关键词
 */
const handleEditKeyword = (row: IntentKeyword) => {
  editingKeyword.value = true
  editingKeywordId.value = row.id
  keywordForm.intent = row.intent
  keywordForm.keyword = row.keyword
  keywordForm.weight = row.weight
  keywordForm.isRegex = row.isRegex
  keywordForm.description = row.description || ''
  keywordDialogVisible.value = true
}

/**
 * 提交关键词表单
 */
const handleSubmitKeyword = async () => {
  if (!keywordForm.intent || !keywordForm.keyword) {
    ElMessage.warning('请填写意图类型和关键词')
    return
  }

  keywordSubmitting.value = true
  try {
    if (editingKeyword.value && editingKeywordId.value) {
      await intentKeywordApi.update(editingKeywordId.value, keywordForm)
      ElMessage.success('关键词更新成功')
    } else {
      await intentKeywordApi.create(keywordForm)
      ElMessage.success('关键词创建成功')
    }
    keywordDialogVisible.value = false
    await loadKeywords()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    keywordSubmitting.value = false
  }
}

/**
 * 删除关键词
 */
const handleDeleteKeyword = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除该关键词吗？', '确认删除', {
      type: 'warning'
    })
    await intentKeywordApi.delete(id)
    ElMessage.success('关键词已删除')
    await loadKeywords()
  } catch {
    // 取消删除
  }
}

/**
 * 切换关键词状态
 */
const handleToggleKeywordStatus = async (id: number, status: boolean) => {
  try {
    await intentKeywordApi.toggleStatus(id, status)
    ElMessage.success(status ? '关键词已启用' : '关键词已禁用')
    await loadKeywords()
  } catch {
    ElMessage.error('状态切换失败')
  }
}

/**
 * 批量导入关键词
 */
const handleBatchImport = async () => {
  if (!batchText.value.trim()) {
    ElMessage.warning('请输入导入数据')
    return
  }

  const lines = batchText.value.trim().split('\n').filter(line => line.trim())
  const keywords: IntentKeywordForm[] = []

  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim())
    if (parts.length < 2) continue

    keywords.push({
      intent: parts[0],
      keyword: parts[1],
      weight: parts[2] ? parseInt(parts[2]) : 1,
      isRegex: parts[3] === 'true',
      description: parts[4] || undefined
    })
  }

  if (keywords.length === 0) {
    ElMessage.warning('没有有效的导入数据')
    return
  }

  batchImporting.value = true
  try {
    const res = await intentKeywordApi.batchImport({ keywords })
    const result = res.data.data
    ElMessage.success(`导入完成：新增 ${result?.created || 0} 条，跳过 ${result?.skipped || 0} 条`)
    showBatchImport.value = false
    batchText.value = ''
    await loadKeywords()
  } catch {
    ElMessage.error('批量导入失败')
  } finally {
    batchImporting.value = false
  }
}

onMounted(() => {
  loadKeywords()
})
</script>