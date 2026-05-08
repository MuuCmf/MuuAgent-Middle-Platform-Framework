<template>
  <el-form :inline="true" style="margin-bottom: 16px;">
    <el-form-item label="对话模式">
      <el-select :model-value="chatMode" @update:model-value="$emit('update:chatMode', $event)" style="width: 200px;">
        <el-option label="MCP调度 (自动选择最优模型)" value="mcp" />
        <el-option label="选择模型 (手动指定模型)" value="model" />
        <el-option label="智能体对话 (使用智能体)" value="agent" />
        <el-option label="知识库检索 (向量检索)" value="kb-retrieval" />
        <el-option label="RAG问答 (知识库问答)" value="kb-rag" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="chatMode === 'model'" label="选择模型">
      <el-select :model-value="selectedModel" @update:model-value="$emit('update:selectedModel', $event)" placeholder="请选择模型" style="width: 250px;">
        <el-option v-for="model in enabledModels" :key="model.id"
          :label="`${model.name} (${model.code}) - ${model.provider}`" :value="model.code" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="chatMode === 'agent'" label="选择智能体">
      <el-select :model-value="selectedAgent" @update:model-value="$emit('update:selectedAgent', $event)" placeholder="请选择智能体" style="width: 250px;">
        <el-option v-for="agent in enabledAgents" :key="agent.id" :label="`${agent.name} (${agent.code})`"
          :value="agent.id" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="chatMode === 'kb-retrieval' || chatMode === 'kb-rag'" label="选择知识库">
      <el-select :model-value="selectedKb" @update:model-value="$emit('update:selectedKb', $event)" placeholder="请选择知识库" style="width: 250px;">
        <el-option v-for="kb in enabledKbs" :key="kb.kbId" :label="`📚 ${kb.kbName} (${kb.kbCode})`"
          :value="kb.kbId" />
      </el-select>
    </el-form-item>
  </el-form>

  <div v-if="chatMode === 'agent' && selectedAgent" style="margin-bottom: 16px;">
    <span style="color: #666; font-size: 12px; margin-right: 8px;">快速测试：</span>
    <el-button v-for="q in quickQuestions" :key="q" size="small" @click="$emit('quick-question', q)">
      {{ q }}
    </el-button>
  </div>

  <div v-if="chatMode === 'kb-retrieval' || chatMode === 'kb-rag'" style="margin-bottom: 16px;">
    <el-form :inline="true" size="small">
      <el-form-item label="召回条数">
        <el-input-number :model-value="retrievalTopN" @update:model-value="$emit('update:retrievalTopN', $event)" :min="1" :max="20" style="width: 100px;" />
      </el-form-item>
      <el-form-item label="相似度阈值">
        <el-input-number :model-value="retrievalThreshold" @update:model-value="$emit('update:retrievalThreshold', $event)" :min="0" :max="1" :step="0.1" :precision="1"
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
import type { KbInfo } from '@/api/kb'

defineProps<{
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
}>()

defineEmits<{
  'update:chatMode': [value: string]
  'update:selectedModel': [value: string]
  'update:selectedAgent': [value: string | null]
  'update:selectedKb': [value: string]
  'update:retrievalTopN': [value: number]
  'update:retrievalThreshold': [value: number]
  'quick-question': [value: string]
}>()
</script>
