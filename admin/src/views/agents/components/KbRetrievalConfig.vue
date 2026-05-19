<template>
  <div class="kb-retrieval-config">
    <el-form-item label="绑定知识库">
      <div class="bind-wrapper">
        <el-button type="primary" plain @click="showKbSelectDialog = true">
          <el-icon>
            <Plus />
          </el-icon>
          选择知识库
        </el-button>
        <div class="bind-content">
          <div v-if="selectedKbCodes.length === 0" class="empty-tip">
            <el-icon>
              <Warning />
            </el-icon>
            <span>暂未绑定知识库</span>
          </div>
          <div v-else class="tag-list">
            <el-tag v-for="kbCode in selectedKbCodes" :key="kbCode" closable @close="removeKb(kbCode)">
              {{ getKbName(kbCode) }}
            </el-tag>
          </div>
        </div>
      </div>
      <div class="field-tip">检索时会合并使用此处绑定和技能声明的知识库</div>
    </el-form-item>

    <el-form-item label="检索策略">
      <el-select v-model="localConfig.strategy" placeholder="请选择检索策略" class="w-full">
        <el-option label="混合模式（推荐）" value="HYBRID">
          <div class="strategy-option">
            <span class="strategy-name">混合模式</span>
            <el-tag size="small" type="success">推荐</el-tag>
          </div>
          <div class="strategy-desc">自动检索 + 工具调用，兼顾效率和灵活性</div>
        </el-option>
        <el-option label="自动检索" value="AUTO">
          <div class="strategy-option">
            <span class="strategy-name">自动检索</span>
            <el-tag size="small" type="info">高效</el-tag>
          </div>
          <div class="strategy-desc">每次对话自动检索，结果注入系统提示词</div>
        </el-option>
        <el-option label="工具调用" value="TOOL">
          <div class="strategy-option">
            <span class="strategy-name">工具调用</span>
            <el-tag size="small" type="warning">灵活</el-tag>
          </div>
          <div class="strategy-desc">LLM自主决定是否调用kb_search工具</div>
        </el-option>
        <el-option label="禁用检索" value="DISABLED">
          <div class="strategy-option">
            <span class="strategy-name">禁用检索</span>
            <el-tag size="small">关闭</el-tag>
          </div>
          <div class="strategy-desc">不进行任何知识库检索</div>
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
      <el-form-item label="覆盖默认配置">
        <el-switch v-model="overrideDefaults" active-text="自定义配置" inactive-text="使用知识库默认值" />
        <div class="field-tip">关闭时使用各知识库自身的检索参数配置</div>
      </el-form-item>

      <template v-if="overrideDefaults">
        <el-divider content-position="left">检索参数覆盖</el-divider>

        <div v-if="showAutoRetrieval && localConfig.autoRetrieval" class="config-section">
          <div class="section-title">
            <el-icon>
              <Lightning />
            </el-icon>
            <span>自动检索配置</span>
          </div>

          <el-form-item label="启用自动检索">
            <el-switch v-model="localConfig.autoRetrieval.enabled" active-text="启用" inactive-text="禁用" />
          </el-form-item>

          <template v-if="localConfig.autoRetrieval.enabled">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="检索条数">
                  <el-input-number v-model="localConfig.autoRetrieval.topN" :min="1" :max="20" class="w-full" />
                  <div class="field-tip">每个知识库返回的最大条数</div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="相似度阈值">
                  <el-slider v-model="localConfig.autoRetrieval.similarityThresh" :min="0" :max="1" :step="0.1"
                    :marks="similarityMarks" />
                  <div class="field-tip">值越高结果越精确</div>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="显示来源">
              <el-switch v-model="localConfig.autoRetrieval.showSources" active-text="显示" inactive-text="隐藏" />
              <div class="field-tip">在系统提示词中标注信息来源</div>
            </el-form-item>

            <el-form-item label="触发条件">
              <el-select v-model="localConfig.autoRetrieval.trigger" class="w-full">
                <el-option label="每次对话" value="always">
                  <span>每次对话</span>
                  <span class="option-desc">所有消息都触发检索</span>
                </el-option>
                <el-option label="仅首次消息" value="first_message">
                  <span>仅首次消息</span>
                  <span class="option-desc">仅对话的第一条消息触发</span>
                </el-option>
                <el-option label="关键词触发" value="keyword">
                  <span>关键词触发</span>
                  <span class="option-desc">包含指定关键词时触发</span>
                </el-option>
              </el-select>
            </el-form-item>

            <el-form-item v-if="localConfig.autoRetrieval.trigger === 'keyword'" label="触发关键词">
              <el-input v-model="keywordsStr" placeholder="关键词1,关键词2,关键词3" @change="handleKeywordsChange" />
              <div class="field-tip">逗号分隔，用户消息包含任一关键词时触发检索</div>
            </el-form-item>
          </template>
        </div>

        <div v-if="showToolRetrieval && localConfig.toolRetrieval" class="config-section">
          <div class="section-title">
            <el-icon>
              <Tools />
            </el-icon>
            <span>工具调用配置</span>
          </div>

          <el-form-item label="启用工具检索">
            <el-switch v-model="localConfig.toolRetrieval.enabled" active-text="启用" inactive-text="禁用" />
          </el-form-item>

          <template v-if="localConfig.toolRetrieval.enabled">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="默认检索条数">
                  <el-input-number v-model="localConfig.toolRetrieval.defaultTopN" :min="1" :max="20" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="默认相似度阈值">
                  <el-slider v-model="localConfig.toolRetrieval.defaultSimilarityThresh" :min="0" :max="1"
                    :step="0.1" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="允许指定知识库">
              <el-switch v-model="localConfig.toolRetrieval.allowSpecifyKb" active-text="允许" inactive-text="禁止" />
              <div class="field-tip">允许LLM在调用工具时指定要检索的知识库</div>
            </el-form-item>
          </template>
        </div>
      </template>
    </template>

    <el-dialog v-model="showKbSelectDialog" title="选择知识库" width="600px" destroy-on-close>
      <el-table :data="availableKbs" v-loading="loadingKbs" @selection-change="handleKbSelectionChange"
        ref="kbTableRef">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="kbName" label="知识库名称" />
        <el-table-column prop="kbCode" label="标识" width="150" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="documentCount" label="文档数" width="80" />
      </el-table>
      <template #footer>
        <el-button @click="showKbSelectDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmKbSelection">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { InfoFilled, Lightning, Tools, Plus, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { KbRetrievalConfig, KbRetrievalStrategy } from '@/api/agent'
import { kbApi, type KbInfo } from '@/api/kb'

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
const selectedKbCodes = ref<string[]>([])
const tempSelectedKbs = ref<KbInfo[]>([])
const kbTableRef = ref()

const similarityMarks = {
  0: '0',
  0.5: '0.5',
  0.7: '推荐',
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
    HYBRID: '自动检索提供基础上下文，LLM可根据需要进行二次检索',
    AUTO: '每次对话自动检索知识库，适合FAQ问答、知识查询场景',
    TOOL: 'LLM自主决定检索时机，适合复杂推理、多步骤任务',
    DISABLED: '不使用知识库检索功能'
  }
  return tips[localConfig.value.strategy] || ''
})

const loadAvailableKbs = async () => {
  loadingKbs.value = true
  try {
    const { data } = await kbApi.getList({ pageSize: 100, status: true })
    availableKbs.value = data.data.list || []
  } catch (error) {
    ElMessage.error('获取知识库列表失败')
  } finally {
    loadingKbs.value = false
  }
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
  if (newVal && availableKbs.value.length > 0) {
    nextTick(() => {
      if (kbTableRef.value) {
        availableKbs.value.forEach(kb => {
          if (selectedKbCodes.value.includes(kb.kbCode)) {
            kbTableRef.value.toggleRowSelection(kb, true)
          }
        })
        tempSelectedKbs.value = availableKbs.value.filter(kb => selectedKbCodes.value.includes(kb.kbCode))
      }
    })
  }
})

onMounted(() => {
  loadAvailableKbs()
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
</style>
