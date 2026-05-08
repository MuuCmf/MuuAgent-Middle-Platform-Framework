<template>
  <div class="message" :class="message.role === 'user' ? 'message-user' : 'message-assistant'">
    <div class="message-content">
      <template v-if="message.role === 'assistant' && message.type === 'retrieval'">
        <RetrievalResult :results="message.results" />
      </template>
      <template v-else-if="message.role === 'assistant' && message.type === 'rag'">
        <RagAnswer :content="message.content || ''" :sources="message.sources" />
      </template>
      <template v-else-if="message.role === 'assistant' && message.reasoningMode !== 'NONE' && hasReasoning">
        <ReasoningProcess :steps="message.reasoningSteps" :final-answer="finalAnswer" />
        <FinalAnswerCard v-if="finalAnswer" :content="finalAnswer" />
        <div v-else-if="message.content" class="plain-content">{{ message.content }}</div>
      </template>
      <template v-else>
        <div class="plain-content">{{ message.content }}</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '../composables/useChat'
import ReasoningProcess from './ReasoningProcess.vue'
import FinalAnswerCard from './FinalAnswerCard.vue'
import RetrievalResult from './RetrievalResult.vue'
import RagAnswer from './RagAnswer.vue'

const props = defineProps<{
  message: ChatMessage
}>()

const hasReasoning = computed(() => {
  return (props.message.tools && props.message.tools!.length > 0) ||
         (props.message.reasoningSteps && props.message.reasoningSteps!.length > 0)
})

const finalAnswer = computed(() => {
  if (!props.message.reasoningSteps) return ''
  const finalStep = props.message.reasoningSteps.find(s => s.stepType === 'final_answer')
  if (finalStep) {
    return (finalStep.content || '').replace(/^(Final Answer|Final Answer:)\s*/i, '').trim()
  }
  return ''
})
</script>

<style lang="scss" scoped>
.message {
  margin-bottom: 16px;

  &.message-user {
    text-align: right;
  }
}

.message-content {
  display: inline-block;
  padding: 10px 16px;
  border-radius: 12px;
  max-width: 85%;
  word-wrap: break-word;
  white-space: pre-wrap;
  text-align: left;

  .message-user & {
    background: #667eea;
    color: white;
  }

  .message-assistant & {
    
  }
}

.plain-content {
  white-space: pre-wrap;
}
</style>
