<template>
  <div class="help-tip" style="margin-bottom: 20px;">
    <div class="help-tip-title">💡 {{ $t('intentKeyword.helpTitle') }}</div>
    <ul>
      <li><strong>{{ $t('intentKeyword.helpItem1') }}</strong></li>
      <li><strong>{{ $t('intentKeyword.helpItem2') }}</strong></li>
      <li><strong>{{ $t('intentKeyword.helpItem3') }}</strong></li>
      <li><strong>{{ $t('intentKeyword.helpItem4') }}</strong></li>
    </ul>
  </div>

  <div class="card">
    <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <el-button type="primary" @click="handleAddKeyword">
        <el-icon><Plus /></el-icon>
        {{ $t('intentKeyword.addKeyword') }}
      </el-button>

      <el-button @click="showBatchImport = true">
        <el-icon><Upload /></el-icon>
        {{ $t('intentKeyword.batchImport') }}
      </el-button>

      <el-select v-model="keywordFilterIntent" :placeholder="$t('intentKeyword.intentType')" clearable style="width: 140px;" @change="loadKeywords">
        <el-option v-for="item in intentOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>

      <el-select v-model="keywordFilterStatus" :placeholder="$t('intentKeyword.status')" clearable style="width: 120px;" @change="loadKeywords">
        <el-option :label="$t('intentKeyword.enabled')" :value="true" />
        <el-option :label="$t('intentKeyword.disabled')" :value="false" />
      </el-select>

      <el-input v-model="keywordFilterText" :placeholder="$t('intentKeyword.searchKeyword')" clearable style="width: 200px;" @clear="loadKeywords" @keyup.enter="loadKeywords">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-button @click="loadKeywords">
        <el-icon><Refresh /></el-icon>
        {{ $t('common.refresh') }}
      </el-button>
    </div>

    <el-table :data="keywordList" stripe v-loading="keywordLoading">
      <el-table-column prop="intent" :label="$t('intentKeyword.intentType')" width="140">
        <template #default="{ row }">
          <el-tag :type="getKeywordIntentTagType(row.intent)">{{ getIntentLabel(row.intent) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="keyword" :label="$t('intentKeyword.keyword')" min-width="200">
        <template #default="{ row }">
          <code style="background: #f5f7fa; padding: 2px 8px; border-radius: 4px;">{{ row.keyword }}</code>
          <el-tag v-if="row.isRegex" type="warning" size="small" style="margin-left: 8px;">{{ $t('intentKeyword.isRegex') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="weight" :label="$t('intentKeyword.weight')" width="80" align="center" />
      <el-table-column prop="status" :label="$t('intentKeyword.status')" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status"
            @change="(val: boolean) => handleToggleKeywordStatus(row.id, val)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="description" :label="$t('intentKeyword.description')" min-width="150" show-overflow-tooltip />
      <el-table-column prop="updatedAt" :label="$t('intentKeyword.updateTime')" width="170">
        <template #default="{ row }">
          {{ formatKeywordTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column :label="$t('common.actions')" width="150" align="right" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleEditKeyword(row)">{{ $t('intentKeyword.edit') }}</el-button>
          <el-button size="small" type="danger" @click="handleDeleteKeyword(row.id)">{{ $t('intentKeyword.delete') }}</el-button>
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

  <el-dialog v-model="keywordDialogVisible" :title="editingKeyword ? $t('intentKeyword.editKeyword') : $t('intentKeyword.addKeywordTitle')" width="550px">
    <el-form :model="keywordForm" label-width="100px">
      <el-form-item :label="$t('intentKeyword.intentType')" required>
        <el-select v-model="keywordForm.intent" style="width: 100%;">
          <el-option v-for="item in fullIntentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('intentKeyword.keyword')" required>
        <el-input v-model="keywordForm.keyword" :placeholder="$t('intentKeyword.keywordPlaceholder')" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('intentKeyword.weight')">
            <el-input-number v-model="keywordForm.weight" :min="1" :max="100" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('intentKeyword.isRegex')">
            <el-switch v-model="keywordForm.isRegex" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('intentKeyword.description')">
        <el-input v-model="keywordForm.description" type="textarea" :rows="2" :placeholder="$t('intentKeyword.descriptionPlaceholder')" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="keywordDialogVisible = false">{{ $t('intentKeyword.cancel') }}</el-button>
      <el-button type="primary" :loading="keywordSubmitting" @click="handleSubmitKeyword">
        {{ editingKeyword ? $t('intentKeyword.update') : $t('intentKeyword.create') }}
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showBatchImport" :title="$t('intentKeyword.batchImportTitle')" width="650px">
    <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
      <template #title>
        {{ $t('intentKeyword.batchImportTip') }}<code>{{ $t('intentKeyword.intentType') }},{{ $t('intentKeyword.keyword') }},{{ $t('intentKeyword.weight') }},{{ $t('intentKeyword.isRegex') }},{{ $t('intentKeyword.description') }}</code>
      </template>
      <p style="margin-top: 4px;">{{ $t('intentKeyword.batchImportExample') }}<code>code,write code,5,false,code related</code></p>
    </el-alert>

    <el-input
      v-model="batchText"
      type="textarea"
      :rows="10"
      :placeholder="batchImportPlaceholder"
    />

    <template #footer>
      <el-button @click="showBatchImport = false">{{ $t('intentKeyword.cancel') }}</el-button>
      <el-button type="primary" :loading="batchImporting" @click="handleBatchImport">
        {{ $t('intentKeyword.import') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Search, Refresh } from '@element-plus/icons-vue'
import { intentKeywordApi, type IntentKeyword, type IntentKeywordForm } from '@/api/intent-keyword'

const { t } = useI18n()

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

const intentOptions = computed(() => [
  { label: `${t('intentLabel.general')}(general)`, value: 'general' },
  { label: `${t('intentLabel.code')}(code)`, value: 'code' },
  { label: `${t('intentLabel.math')}(math)`, value: 'math' },
  { label: `${t('intentLabel.creative')}(creative)`, value: 'creative' },
  { label: `${t('intentLabel.image')}(image)`, value: 'image' },
  { label: `${t('intentLabel.tts')}(tts)`, value: 'tts' },
  { label: `${t('intentLabel.asr')}(asr)`, value: 'asr' },
])

const fullIntentOptions = computed(() => [
  { label: `${t('intentLabel.general')} (general)`, value: 'general' },
  { label: `${t('intentLabel.code')} (code)`, value: 'code' },
  { label: `${t('intentLabel.math')} (math)`, value: 'math' },
  { label: `${t('intentLabel.creative')} (creative)`, value: 'creative' },
  { label: `${t('intentLabel.image')} (image)`, value: 'image' },
  { label: `${t('intentLabel.tts')} (tts)`, value: 'tts' },
  { label: `${t('intentLabel.asr')} (asr)`, value: 'asr' },
])

const batchImportPlaceholder = computed(() =>
  `code,${t('intentKeyword.keywordPlaceholder')},5,false,...\nmath,${t('intentKeyword.keywordPlaceholder')},3,false,...`
)

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

const getIntentLabel = (intent: string): string => {
  const map: Record<string, string> = {
    general: t('intentLabel.general'),
    code: t('intentLabel.code'),
    math: t('intentLabel.math'),
    creative: t('intentLabel.creative'),
    image: t('intentLabel.image'),
    tts: t('intentLabel.tts'),
    asr: t('intentLabel.asr')
  }
  return map[intent] || intent
}

const formatKeywordTime = (time: string): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

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
    ElMessage.error(t('intentKeyword.loadListFailed'))
  } finally {
    keywordLoading.value = false
  }
}

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

const handleSubmitKeyword = async () => {
  if (!keywordForm.intent || !keywordForm.keyword) {
    ElMessage.warning(t('intentKeyword.fillRequired'))
    return
  }

  keywordSubmitting.value = true
  try {
    if (editingKeyword.value && editingKeywordId.value) {
      await intentKeywordApi.update(editingKeywordId.value, keywordForm)
      ElMessage.success(t('intentKeyword.updateSuccess'))
    } else {
      await intentKeywordApi.create(keywordForm)
      ElMessage.success(t('intentKeyword.createSuccess'))
    }
    keywordDialogVisible.value = false
    await loadKeywords()
  } catch {
    ElMessage.error(t('intentKeyword.operationFailed'))
  } finally {
    keywordSubmitting.value = false
  }
}

const handleDeleteKeyword = async (id: number) => {
  try {
    await ElMessageBox.confirm(
      t('intentKeyword.deleteConfirm'),
      t('intentKeyword.deleteConfirmTitle'),
      { type: 'warning' }
    )
    await intentKeywordApi.delete(id)
    ElMessage.success(t('intentKeyword.deleted'))
    await loadKeywords()
  } catch {
    // cancelled
  }
}

const handleToggleKeywordStatus = async (id: number, status: boolean) => {
  try {
    await intentKeywordApi.toggleStatus(id, status)
    ElMessage.success(t('intentKeyword.toggleSuccess', {
      status: status ? t('intentKeyword.enabledStatus') : t('intentKeyword.disabledStatus')
    }))
    await loadKeywords()
  } catch {
    ElMessage.error(t('intentKeyword.toggleFailed'))
  }
}

const handleBatchImport = async () => {
  if (!batchText.value.trim()) {
    ElMessage.warning(t('intentKeyword.enterData'))
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
    ElMessage.warning(t('intentKeyword.noValidData'))
    return
  }

  batchImporting.value = true
  try {
    const res = await intentKeywordApi.batchImport({ keywords })
    const result = res.data.data
    ElMessage.success(t('intentKeyword.importResult', {
      created: result?.created || 0,
      skipped: result?.skipped || 0
    }))
    showBatchImport.value = false
    batchText.value = ''
    await loadKeywords()
  } catch {
    ElMessage.error(t('intentKeyword.importFailed'))
  } finally {
    batchImporting.value = false
  }
}

onMounted(() => {
  loadKeywords()
})
</script>
