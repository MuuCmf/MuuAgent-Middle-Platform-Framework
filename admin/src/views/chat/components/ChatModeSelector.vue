<template>
  <el-form :inline="true" style="margin-bottom: 16px;">
    <el-form-item label="对话模式">
      <el-select v-model="localChatMode" style="width: 200px;">
        <el-option label="MCP调度 (自动选择最优模型)" value="mcp" />
        <el-option label="选择模型 (手动指定模型)" value="model" />
        <el-option label="智能体对话 (使用智能体)" value="agent" />
        <el-option label="知识库检索 (向量检索)" value="kb-retrieval" />
        <el-option label="RAG问答 (知识库问答)" value="kb-rag" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="localChatMode === 'model'" label="选择模型">
      <el-select v-model="localSelectedModel" placeholder="请选择模型" style="width: 250px;">
        <el-option v-for="model in enabledModels" :key="model.id"
          :label="`${model.name} (${model.code}) - ${model.provider}`" :value="model.code" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="localChatMode === 'agent'" label="选择智能体">
      <el-select v-model="localSelectedAgent" placeholder="请选择智能体" style="width: 250px;">
        <el-option v-for="agent in enabledAgents" :key="agent.id" :label="`${agent.name} (${agent.code})`"
          :value="agent.id" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="localChatMode === 'kb-retrieval' || localChatMode === 'kb-rag'" label="选择知识库">
      <el-select v-model="localSelectedKb" placeholder="请选择知识库" style="width: 250px;">
        <el-option v-for="kb in enabledKbs" :key="kb.kbId" :label="`📚 ${kb.kbName} (${kb.kbCode})`"
          :value="kb.kbId" />
      </el-select>
    </el-form-item>
  </el-form>

  <ConversationSelector
    v-if="shouldShowConversationSelector"
    :conversation-type="currentConversationType"
    :target-id="currentTargetId"
    :model-value="currentConversationId"
    @update:model-value="$emit('update:currentConversationId', $event)"
    @change="handleConversationChange"
  />

  <div v-if="localChatMode === 'agent' && localSelectedAgent" style="margin-bottom: 16px;">
    <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
    <el-button v-for="q in quickQuestions" :key="q" size="small" @click="$emit('quick-question', q)">
      {{ q }}
    </el-button>
  </div>

  <div v-if="localChatMode === 'kb-retrieval' || localChatMode === 'kb-rag'" style="margin-bottom: 16px;">
    <el-form :inline="true" size="small">
      <el-form-item label="召回条数">
        <el-input-number v-model="localRetrievalTopN" :min="1" :max="20" style="width: 100px;" />
      </el-form-item>
      <el-form-item label="相似度阈值">
        <el-input-number v-model="localRetrievalThreshold" :min="0" :max="1" :step="0.1" :precision="1"
          style="width: 100px;" />
      </el-form-item>
    </el-form>
    <div style="margin-top: 8px;">
      <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
      <el-button v-for="q in kbQuickQuestions" :key="q" size="small" @click="$emit('quick-question', q)">
        {{ q }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KbInfo } from '@/api/kb'
import { ConversationType } from '@/api/conversation'
import ConversationSelector from './ConversationSelector.vue'

interface Props {
  chatMode: string
  selectedModel: string
  selectedAgent: string | null
  selectedKb: string
  retrievalTopN: number
  retrievalThreshold: number
  enabledModels: any[]
  enabledAgents: any[]
  enabledKbs: KbInfo[]
  quickQuestions: string[]
  kbQuickQuestions: string[]
  currentConversationId?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:chatMode': [value: string]
  'update:selectedModel': [value: string]
  'update:selectedAgent': [value: string | null]
  'update:selectedKb': [value: string]
  'update:retrievalTopN': [value: number]
  'update:retrievalThreshold': [value: number]
  'update:currentConversationId': [value: string | null]
  'quick-question': [value: string]
  'conversation-change': [value: string | null]
}>()

const localChatMode = ref(props.chatMode)
const localSelectedModel = ref(props.selectedModel)
const localSelectedAgent = ref(props.selectedAgent)
const localSelectedKb = ref(props.selectedKb)
const localRetrievalTopN = ref(props.retrievalTopN)
const localRetrievalThreshold = ref(props.retrievalThreshold)

watch(localChatMode, (newValue) => {
  emit('update:chatMode', newValue)
  emit('update:currentConversationId', null)
  emit('conversation-change', null)
})

watch(localSelectedModel, (newValue) => {
  emit('update:selectedModel', newValue)
  emit('update:currentConversationId', null)
  emit('conversation-change', null)
})

watch(localSelectedAgent, (newValue) => {
  emit('update:selectedAgent', newValue)
  emit('update:currentConversationId', null)
  emit('conversation-change', null)
})

watch(localSelectedKb, (newValue) => {
  emit('update:selectedKb', newValue)
  emit('update:currentConversationId', null)
  emit('conversation-change', null)
})

watch(localRetrievalTopN, (newValue) => {
  emit('update:retrievalTopN', newValue)
})

watch(localRetrievalThreshold, (newValue) => {
  emit('update:retrievalThreshold', newValue)
})

watch(() => props.chatMode, (newValue) => {
  localChatMode.value = newValue
})

watch(() => props.selectedModel, (newValue) => {
  localSelectedModel.value = newValue
})

watch(() => props.selectedAgent, (newValue) => {
  localSelectedAgent.value = newValue
})

watch(() => props.selectedKb, (newValue) => {
  localSelectedKb.value = newValue
})

watch(() => props.retrievalTopN, (newValue) => {
  localRetrievalTopN.value = newValue
})

watch(() => props.retrievalThreshold, (newValue) => {
  localRetrievalThreshold.value = newValue
})

const currentConversationType = computed((): ConversationType => {
  if (localChatMode.value === 'agent') {
    return ConversationType.AGENT
  } else if (localChatMode.value === 'kb-rag') {
    return ConversationType.KB_RAG
  } else {
    return ConversationType.MODEL
  }
})

const currentTargetId = computed((): string => {
  if (localChatMode.value === 'agent') {
    return localSelectedAgent.value || ''
  } else if (localChatMode.value === 'kb-rag') {
    return localSelectedKb.value
  } else if (localChatMode.value === 'model') {
    return localSelectedModel.value
  } else {
    return 'mcp-llm'
  }
})

const shouldShowConversationSelector = computed(() => {
  if (localChatMode.value === 'agent' && localSelectedAgent.value) {
    return true
  }
  if (localChatMode.value === 'model' && localSelectedModel.value) {
    return true
  }
  if (localChatMode.value === 'mcp') {
    return true
  }
  if (localChatMode.value === 'kb-rag' && localSelectedKb.value) {
    return true
  }
  return false
})

const handleConversationChange = (conversationId: string | null) => {
  emit('conversation-change', conversationId)
}
</script>
