<template>
  <div class="kb-retrieval-config">
    <el-form-item :label="$t('kbRetrieval.bindKnowledgeBase')">
      <div class="bind-wrapper">
        <el-button type="primary" plain @click="showKbSelectDialog = true">
          <el-icon>
            <Plus />
          </el-icon>
          {{ $t('kbRetrieval.selectKnowledgeBase') }}
        </el-button>
        <div class="bind-content">
          <div v-if="selectedKbCodes.length === 0" class="empty-tip">
            <el-icon>
              <Warning />
            </el-icon>
            <span>{{ $t('kbRetrieval.noKnowledgeBase') }}</span>
          </div>
          <div v-else class="tag-list">
            <el-tag v-for="kbCode in selectedKbCodes" :key="kbCode" closable @close="removeKb(kbCode)">
              {{ getKbName(kbCode) }}
            </el-tag>
          </div>
        </div>
      </div>
      <div class="field-tip">{{ $t('kbRetrieval.retrievalTip') }}</div>
    </el-form-item>

    <el-form-item :label="$t('kbRetrieval.retrievalStrategy')">
      <el-select v-model="localConfig.strategy" :placeholder="$t('kbRetrieval.pleaseSelectRetrievalStrategy')" class="w-full">
        <el-option :label="$t('kbRetrieval.hybridMode') + ' (' + $t('kbRetrieval.recommended') + ')'" value="HYBRID">
          <div class="strategy-option">
            <span class="strategy-name">{{ $t('kbRetrieval.hybridMode') }}</span>
            <el-tag size="small" type="success">{{ $t('kbRetrieval.recommended') }}</el-tag>
          </div>
          <div class="strategy-desc">{{ $t('kbRetrieval.hybridModeDesc') }}</div>
        </el-option>
        <el-option :label="$t('kbRetrieval.autoRetrieval')" value="AUTO">
          <div class="strategy-option">
            <span class="strategy-name">{{ $t('kbRetrieval.autoRetrieval') }}</span>
            <el-tag size="small" type="info">{{ $t('kbRetrieval.efficient') }}</el-tag>
          </div>
          <div class="strategy-desc">{{ $t('kbRetrieval.autoRetrievalDesc') }}</div>
        </el-option>
        <el-option :label="$t('kbRetrieval.toolCall')" value="TOOL">
          <div class="strategy-option">
            <span class="strategy-name">{{ $t('kbRetrieval.toolCall') }}</span>
            <el-tag size="small" type="warning">{{ $t('kbRetrieval.flexible') }}</el-tag>
          </div>
          <div class="strategy-desc">{{ $t('kbRetrieval.toolCallDesc') }}</div>
        </el-option>
        <el-option :label="$t('kbRetrieval.disableRetrieval')" value="DISABLED">
          <div class="strategy-option">
            <span class="strategy-name">{{ $t('kbRetrieval.disableRetrieval') }}</span>
            <el-tag size="small">{{ $t('kbRetrieval.closed') }}</el-tag>
          </div>
          <div class="strategy-desc">{{ $t('kbRetrieval.disableRetrievalDesc') }}</div>
        </el-option>
      </el-select>
      <div class="strategy-tip" v-if="localConfig.strategy">
        <el-icon>
          <InfoFilled />
        </el-icon>
        <span>{{ strategyTip }}</span>
      </div>
    </el-form-item>

    <template v-if="localConfig.strategy !== 'DISABLED'">
      <el-form-item :label="$t('kbRetrieval.overrideDefaultConfig')">
        <el-switch v-model="overrideDefaults" :active-text="$t('kbRetrieval.customConfig')" :inactive-text="$t('kbRetrieval.useKbDefault')" />
        <div class="field-tip">{{ $t('kbRetrieval.overrideDefaultTip') }}</div>
      </el-form-item>

      <template v-if="overrideDefaults">
        <el-divider content-position="left">{{ $t('kbRetrieval.retrievalParamsOverride') }}</el-divider>

        <div v-if="showAutoRetrieval && localConfig.autoRetrieval" class="config-section">
          <div class="section-title">
            <el-icon>
              <Lightning />
            </el-icon>
            <span>{{ $t('kbRetrieval.autoRetrievalConfig') }}</span>
          </div>

          <el-form-item :label="$t('kbRetrieval.enableAutoRetrieval')">
            <el-switch v-model="localConfig.autoRetrieval.enabled" :active-text="$t('agent.enable')" :inactive-text="$t('agent.disable')" />
          </el-form-item>

          <template v-if="localConfig.autoRetrieval.enabled">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item :label="$t('kbRetrieval.retrievalCount')">
                  <el-input-number v-model="localConfig.autoRetrieval.topN" :min="1" :max="20" class="w-full" />
                  <div class="field-tip">{{ $t('kbRetrieval.retrievalCountTip') }}</div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item :label="$t('kbRetrieval.similarityThreshold')">
                  <el-slider v-model="localConfig.autoRetrieval.similarityThresh" :min="0" :max="1" :step="0.1"
                    :marks="similarityMarks" />
                  <div class="field-tip">{{ $t('kbRetrieval.similarityThresholdTip') }}</div>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item :label="$t('kbRetrieval.showSource')">
              <el-switch v-model="localConfig.autoRetrieval.showSources" :active-text="$t('kbRetrieval.show')" :inactive-text="$t('kbRetrieval.hide')" />
              <div class="field-tip">{{ $t('kbRetrieval.showSourceTip') }}</div>
            </el-form-item>

            <el-form-item :label="$t('kbRetrieval.triggerCondition')">
              <el-select v-model="localConfig.autoRetrieval.trigger" class="w-full">
                <el-option :label="$t('kbRetrieval.everyConversation')" value="always">
                  <span>{{ $t('kbRetrieval.everyConversation') }}</span>
                  <span class="option-desc">{{ $t('kbRetrieval.everyConversationDesc') }}</span>
                </el-option>
                <el-option :label="$t('kbRetrieval.firstMessageOnly')" value="first_message">
                  <span>{{ $t('kbRetrieval.firstMessageOnly') }}</span>
                  <span class="option-desc">{{ $t('kbRetrieval.firstMessageOnlyDesc') }}</span>
                </el-option>
                <el-option :label="$t('kbRetrieval.keywordTrigger')" value="keyword">
                  <span>{{ $t('kbRetrieval.keywordTrigger') }}</span>
                  <span class="option-desc">{{ $t('kbRetrieval.keywordTriggerDesc') }}</span>
                </el-option>
              </el-select>
            </el-form-item>

            <el-form-item v-if="localConfig.autoRetrieval.trigger === 'keyword'" :label="$t('kbRetrieval.triggerKeywords')">
              <el-input v-model="keywordsStr" :placeholder="$t('kbRetrieval.triggerKeywordsPlaceholder')" @change="handleKeywordsChange" />
              <div class="field-tip">{{ $t('kbRetrieval.triggerKeywordsTip') }}</div>
            </el-form-item>
          </template>
        </div>

        <div v-if="showToolRetrieval && localConfig.toolRetrieval" class="config-section">
          <div class="section-title">
            <el-icon>
              <Tools />
            </el-icon>
            <span>{{ $t('kbRetrieval.toolCallConfig') }}</span>
          </div>

          <el-form-item :label="$t('kbRetrieval.enableToolRetrieval')">
            <el-switch v-model="localConfig.toolRetrieval.enabled" :active-text="$t('agent.enable')" :inactive-text="$t('agent.disable')" />
          </el-form-item>

          <template v-if="localConfig.toolRetrieval.enabled">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item :label="$t('kbRetrieval.defaultRetrievalCount')">
                  <el-input-number v-model="localConfig.toolRetrieval.defaultTopN" :min="1" :max="20" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item :label="$t('kbRetrieval.defaultSimilarityThreshold')">
                  <el-slider v-model="localConfig.toolRetrieval.defaultSimilarityThresh" :min="0" :max="1"
                    :step="0.1" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item :label="$t('kbRetrieval.allowSpecifyKb')">
              <el-switch v-model="localConfig.toolRetrieval.allowSpecifyKb" :active-text="$t('kbRetrieval.allow')" :inactive-text="$t('kbRetrieval.forbid')" />
              <div class="field-tip">{{ $t('kbRetrieval.allowSpecifyKbTip') }}</div>
            </el-form-item>
          </template>
        </div>
      </template>
    </template>

    <el-dialog v-model="showKbSelectDialog" :title="$t('kbRetrieval.selectKnowledgeBase')" width="700px" destroy-on-close>
      <div class="kb-filter">
        <el-input
          v-model="kbSearchForm.keyword"
          :placeholder="$t('kbRetrieval.searchKbName')"
          clearable
          style="width: 200px"
          @input="handleKbSearch"
        />
      </div>
      <el-table :data="availableKbs" v-loading="loadingKbs" @selection-change="handleKbSelectionChange"
        ref="kbTableRef" max-height="400">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="kbName" :label="$t('kbRetrieval.kbName')" width="150" />
        <el-table-column prop="kbCode" :label="$t('kbRetrieval.kbCode')" width="150" />
        <el-table-column prop="description" :label="$t('common.description')" show-overflow-tooltip />
        <el-table-column prop="documentCount" :label="$t('kbRetrieval.documentCount')" width="80" />
      </el-table>
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="kbSearchForm.pageNum"
          v-model:page-size="kbSearchForm.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="kbTotal"
          layout="total, sizes, prev, pager, next"
          small
          @size-change="loadAvailableKbs"
          @current-change="loadAvailableKbs"
        />
      </div>
      <template #footer>
        <el-button @click="showKbSelectDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmKbSelection">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, reactive } from 'vue'
import { InfoFilled, Lightning, Tools, Plus, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { KbRetrievalConfig, KbRetrievalStrategy } from '@/api/agent'
import { kbApi, type KbInfo } from '@/api/kb'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue?: KbRetrievalConfig
  knowledgeBases?: string
}

interface Emits {
  (e: 'update:modelValue', value: KbRetrievalConfig): void
  (e: 'update:knowledgeBases', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({
    strategy: 'HYBRID',
    autoRetrieval: {
      enabled: true,
      showSources: true,
      trigger: 'always',
      keywords: [],
    },
    toolRetrieval: {
      enabled: true,
      allowSpecifyKb: true,
    },
  }),
  knowledgeBases: '[]',
})

const emit = defineEmits<Emits>()

const localConfig = ref<KbRetrievalConfig>(JSON.parse(JSON.stringify(props.modelValue)))

const overrideDefaults = ref(false)

const keywordsStr = ref((localConfig.value.autoRetrieval?.keywords || []).join(','))

const showKbSelectDialog = ref(false)
const availableKbs = ref<KbInfo[]>([])
const loadingKbs = ref(false)
const kbTotal = ref(0)
const selectedKbCodes = ref<string[]>([])
const tempSelectedKbs = ref<KbInfo[]>([])
const kbTableRef = ref()
const kbSearchForm = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10,
})

const similarityMarks = {
  0: '0',
  0.5: '0.5',
  0.7: t('kbRetrieval.recommended'),
  1: '1'
}

const showAutoRetrieval = computed(() => {
  return localConfig.value.strategy === 'AUTO' || localConfig.value.strategy === 'HYBRID'
})

const showToolRetrieval = computed(() => {
  return localConfig.value.strategy === 'TOOL' || localConfig.value.strategy === 'HYBRID'
})

const strategyTip = computed(() => {
  const tips: Record<KbRetrievalStrategy, string> = {
    HYBRID: t('kbRetrieval.hybridTip'),
    AUTO: t('kbRetrieval.autoTip'),
    TOOL: t('kbRetrieval.toolTip'),
    DISABLED: t('kbRetrieval.disabledTip')
  }
  return tips[localConfig.value.strategy] || ''
})

const loadAvailableKbs = async () => {
  loadingKbs.value = true
  try {
    const { data } = await kbApi.getList({
      pageNum: kbSearchForm.pageNum,
      pageSize: kbSearchForm.pageSize,
      status: true,
      keyword: kbSearchForm.keyword || undefined,
    })
    availableKbs.value = data.data.list || []
    kbTotal.value = data.data.total || 0

    if (kbTableRef.value && availableKbs.value.length > 0) {
      nextTick(() => {
        availableKbs.value.forEach(kb => {
          if (selectedKbCodes.value.includes(kb.kbCode)) {
            kbTableRef.value.toggleRowSelection(kb, true)
          }
        })
        tempSelectedKbs.value = availableKbs.value.filter(kb => selectedKbCodes.value.includes(kb.kbCode))
      })
    }
  } catch (error) {
    ElMessage.error(t('kbRetrieval.getKbListFailed'))
  } finally {
    loadingKbs.value = false
  }
}

const handleKbSearch = () => {
  kbSearchForm.pageNum = 1
  loadAvailableKbs()
}

const getKbName = (kbCode: string) => {
  const kb = availableKbs.value.find(k => k.kbCode === kbCode)
  return kb?.kbName || kbCode
}

const removeKb = (kbCode: string) => {
  const index = selectedKbCodes.value.indexOf(kbCode)
  if (index > -1) {
    selectedKbCodes.value.splice(index, 1)
    emit('update:knowledgeBases', JSON.stringify(selectedKbCodes.value))
  }
}

const handleKbSelectionChange = (selection: KbInfo[]) => {
  tempSelectedKbs.value = selection
}

const confirmKbSelection = () => {
  selectedKbCodes.value = tempSelectedKbs.value.map(kb => kb.kbCode)
  emit('update:knowledgeBases', JSON.stringify(selectedKbCodes.value))
  showKbSelectDialog.value = false
}

const handleKeywordsChange = () => {
  if (localConfig.value.autoRetrieval) {
    localConfig.value.autoRetrieval.keywords = keywordsStr.value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }
}

watch(showKbSelectDialog, (newVal) => {
  if (newVal) {
    loadAvailableKbs()
  }
})

onMounted(() => {
  if (props.knowledgeBases) {
    try {
      selectedKbCodes.value = JSON.parse(props.knowledgeBases)
    } catch {
      selectedKbCodes.value = []
    }
  }
  if (props.modelValue) {
    const hasOverride =
      props.modelValue.autoRetrieval?.topN !== undefined ||
      props.modelValue.autoRetrieval?.similarityThresh !== undefined ||
      props.modelValue.toolRetrieval?.defaultTopN !== undefined ||
      props.modelValue.toolRetrieval?.defaultSimilarityThresh !== undefined
    overrideDefaults.value = hasOverride
  }
})

watch(overrideDefaults, (newVal) => {
  if (!newVal) {
    if (localConfig.value.autoRetrieval) {
      delete localConfig.value.autoRetrieval.topN
      delete localConfig.value.autoRetrieval.similarityThresh
    }
    if (localConfig.value.toolRetrieval) {
      delete localConfig.value.toolRetrieval.defaultTopN
      delete localConfig.value.toolRetrieval.defaultSimilarityThresh
    }
  } else {
    if (localConfig.value.autoRetrieval) {
      localConfig.value.autoRetrieval.topN = 5
      localConfig.value.autoRetrieval.similarityThresh = 0.7
    }
    if (localConfig.value.toolRetrieval) {
      localConfig.value.toolRetrieval.defaultTopN = 5
      localConfig.value.toolRetrieval.defaultSimilarityThresh = 0.7
    }
  }
})

let isUpdating = false

watch(localConfig, (newVal) => {
  if (isUpdating) return
  isUpdating = true
  emit('update:modelValue', JSON.parse(JSON.stringify(newVal)))
  setTimeout(() => { isUpdating = false }, 0)
}, { deep: true })

watch(() => props.modelValue, (newVal) => {
  if (isUpdating) return
  if (newVal) {
    isUpdating = true
    localConfig.value = JSON.parse(JSON.stringify(newVal))
    keywordsStr.value = (newVal.autoRetrieval?.keywords || []).join(',')
    setTimeout(() => { isUpdating = false }, 0)
  }
}, { deep: true })
</script>

<style lang="scss" scoped>
.kb-retrieval-config {
  border-radius: 6px;
}

.bind-wrapper {
  width: 100%;
}

.bind-content {
  margin-top: 12px;
}

.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  color: #909399;
  font-size: 13px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.w-full {
  width: 100%;
}

.strategy-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strategy-name {
  font-weight: 500;
}

.strategy-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.strategy-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;

  .el-icon {
    font-size: 14px;
  }
}

.option-desc {
  float: right;
  font-size: 12px;
  color: #909399;
}

.config-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

:deep(.el-slider__marks-text) {
  &:nth-child(3) {
    color: #409eff;
    font-weight: 500;
  }
}

.kb-filter {
  margin-bottom: 12px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
